package com.campaignmanager.service;

import com.campaignmanager.model.CampaignPlan;
import com.campaignmanager.model.CampaignPlanDocument;
import com.campaignmanager.repository.CampaignPlanDocumentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Downloads files from a Google Drive folder using the connected Gmail/Google session
 * (same Playwright-based auth as Google Sheets import in Campaign 1.0).
 * The folder must be accessible to the connected Gmail account — no public sharing required.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleDriveImportService {

    private static final long MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file

    private final PlaywrightSessionService sessionService;
    private final ObjectMapper objectMapper;
    private final CampaignPlanDocumentRepository documentRepository;

    /**
     * Extracts the folder ID from a Google Drive folder URL.
     * Supports: https://drive.google.com/drive/folders/{id}
     *           https://drive.google.com/drive/u/0/folders/{id}
     */
    public String extractFolderId(String folderUrl) {
        if (folderUrl == null) return null;
        Pattern p = Pattern.compile("/folders/([a-zA-Z0-9_-]+)");
        Matcher m = p.matcher(folderUrl);
        return m.find() ? m.group(1) : null;
    }

    /**
     * Downloads all supported files from the given Drive folder using the connected Gmail session.
     * Saves each as a CampaignPlanDocument linked to the given plan.
     */
    public List<CampaignPlanDocument> importFolder(String folderId, CampaignPlan plan) {
        BrowserContext ctx = sessionService.getSessionContext();
        Page page = ctx.newPage();
        List<CampaignPlanDocument> created = new ArrayList<>();

        try {
            // Navigate to the folder to trigger Google auth and load file metadata
            String folderUrl = "https://drive.google.com/drive/folders/" + folderId;
            log.info("Navigating to Drive folder: {}", folderUrl);
            page.navigate(folderUrl);
            page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE,
                    new Page.WaitForLoadStateOptions().setTimeout(30_000));
            // Give the Drive SPA a moment to finish rendering file rows
            page.waitForTimeout(3_000);

            // Extract file IDs and names from the DOM using multiple selector strategies
            String script = """
                (() => {
                    const files = new Map();
                    // Strategy 1: [data-id] elements — Drive list/grid view file entries
                    document.querySelectorAll('[data-id]').forEach(el => {
                        const id = el.getAttribute('data-id');
                        if (!id || !/^[a-zA-Z0-9_\\-]{20,}$/.test(id)) return;
                        const name =
                            el.getAttribute('data-filename') ||
                            el.querySelector('[data-filename]')?.getAttribute('data-filename') ||
                            el.querySelector('[data-tooltip]')?.getAttribute('data-tooltip') ||
                            el.querySelector('[title]')?.getAttribute('title') ||
                            el.querySelector('div[tabindex]')?.textContent?.trim() || '';
                        if (name && name.length > 0 && !name.includes('\\n') && name.length < 256) {
                            files.set(id, { id, name });
                        }
                    });
                    // Strategy 2: anchor hrefs in file rows
                    document.querySelectorAll('a[href*="/file/d/"], a[href*="/document/d/"], a[href*="/presentation/d/"]').forEach(a => {
                        const href = a.getAttribute('href') || '';
                        const m = href.match(/\\/(?:file|document|presentation)\\/d\\/([a-zA-Z0-9_\\-]{20,})/);
                        if (!m) return;
                        const id = m[1];
                        const name = a.getAttribute('aria-label') || a.textContent.trim();
                        if (name && !files.has(id)) files.set(id, { id, name });
                    });
                    return JSON.stringify(Array.from(files.values()));
                })()
            """;

            String json = (String) page.evaluate(script);
            log.info("Drive folder DOM extracted: {}", json);

            if (json == null || json.equals("[]") || json.equals("null")) {
                throw new RuntimeException(
                    "No files found in the Drive folder. Make sure: (1) the folder URL is correct, " +
                    "(2) the folder is shared with the connected Gmail account, and " +
                    "(3) it contains supported files (Google Docs, PDF, DOCX, TXT, HTML).");
            }

            JsonNode fileArray = objectMapper.readTree(json);
            if (!fileArray.isArray() || fileArray.size() == 0) {
                throw new RuntimeException("Drive folder appears empty or inaccessible to the connected Gmail account.");
            }

            // Download each file using the authenticated session
            for (JsonNode fileNode : fileArray) {
                String fileId = fileNode.path("id").asText();
                String name   = fileNode.path("name").asText("unknown");
                if (fileId.isBlank()) continue;

                try {
                    byte[] content = null;
                    String effectiveMime = "application/octet-stream";
                    String effectiveName = name;

                    // Determine download URL based on file name extension or guessing
                    if (looksLikeGoogleDoc(name)) {
                        // Google Doc — export as plain text
                        String exportUrl = "https://docs.google.com/document/d/" + fileId + "/export?format=txt";
                        APIResponse resp = ctx.request().get(exportUrl);
                        if (resp.ok()) {
                            content = resp.body();
                            effectiveMime = "text/plain";
                            effectiveName = stripExtension(name) + ".txt";
                        } else {
                            log.warn("Doc export failed for '{}' (HTTP {}), trying direct download", name, resp.status());
                        }
                    }

                    if (content == null && looksLikeGoogleSlides(name)) {
                        // Google Slides — export as plain text
                        String exportUrl = "https://docs.google.com/presentation/d/" + fileId + "/export/txt";
                        APIResponse resp = ctx.request().get(exportUrl);
                        if (resp.ok()) {
                            content = resp.body();
                            effectiveMime = "text/plain";
                            effectiveName = stripExtension(name) + ".txt";
                        }
                    }

                    if (content == null) {
                        // Regular file — try direct download via Drive's uc endpoint
                        String downloadUrl = "https://drive.google.com/uc?id=" + fileId + "&export=download";
                        APIResponse resp = ctx.request().get(downloadUrl);
                        if (resp.ok()) {
                            content = resp.body();
                            // Detect mime from content-type or name extension
                            String ct = resp.headers().getOrDefault("content-type", "application/octet-stream");
                            effectiveMime = ct.contains(";") ? ct.substring(0, ct.indexOf(';')).trim() : ct;
                        } else {
                            log.warn("Skipping '{}' — could not download (HTTP {})", name, resp.status());
                            continue;
                        }
                    }

                    if (content == null || content.length == 0) {
                        log.warn("Empty content for file '{}', skipping", name);
                        continue;
                    }
                    if (content.length > MAX_FILE_BYTES) {
                        log.warn("Skipping '{}' — too large ({} bytes)", name, content.length);
                        continue;
                    }
                    if (!isSupportedMime(effectiveMime) && !isSupportedByExtension(effectiveName)) {
                        log.debug("Skipping '{}' — unsupported type ({})", effectiveName, effectiveMime);
                        continue;
                    }

                    CampaignPlanDocument doc = new CampaignPlanDocument();
                    doc.setCampaignPlan(plan);
                    doc.setOriginalFileName(effectiveName);
                    doc.setMimeType(effectiveMime);
                    doc.setFileContent(content);
                    created.add(documentRepository.save(doc));
                    log.info("Imported '{}' ({} bytes) from Drive folder", effectiveName, content.length);

                } catch (Exception e) {
                    log.warn("Failed to download '{}' from Drive: {}", name, e.getMessage());
                }
            }

        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Drive folder import failed: " + e.getMessage(), e);
        } finally {
            page.close();
        }

        return created;
    }

    private boolean looksLikeGoogleDoc(String name) {
        // No extension → likely a Google Doc
        return !name.contains(".") || name.endsWith(".gdoc");
    }

    private boolean looksLikeGoogleSlides(String name) {
        return name.endsWith(".gslides");
    }

    private boolean isSupportedMime(String mime) {
        return mime.startsWith("text/") ||
               mime.contains("pdf") ||
               mime.contains("wordprocessingml") ||
               mime.contains("html");
    }

    private boolean isSupportedByExtension(String name) {
        String lower = name.toLowerCase();
        return lower.endsWith(".pdf") || lower.endsWith(".docx") ||
               lower.endsWith(".txt") || lower.endsWith(".html") || lower.endsWith(".htm");
    }

    private String stripExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
