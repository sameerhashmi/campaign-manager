package com.campaignmanager.service;

import com.campaignmanager.model.CampaignPlan;
import com.campaignmanager.model.CampaignPlanDocument;
import com.campaignmanager.repository.CampaignPlanDocumentRepository;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.BrowserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Downloads files from a Google Drive folder using the connected Gmail/Google session.
 * Uses ctx.request().get() (same pattern as ExcelImportService's Google Sheets download)
 * rather than page.navigate() — avoids the ERR_CONNECTION_RESET that full browser
 * navigation triggers on CF's corporate proxy.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleDriveImportService {

    private static final long MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file

    private final PlaywrightSessionService sessionService;
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
        List<CampaignPlanDocument> created = new ArrayList<>();

        // ── Step 1: Fetch the folder page HTML via HTTP request (not browser nav) ──
        // This mirrors how ExcelImportService downloads Google Sheets — ctx.request().get()
        // uses an HTTP client that works through CF's proxy, unlike page.navigate() which
        // triggers ERR_CONNECTION_RESET on drive.google.com.
        String folderUrl = "https://drive.google.com/drive/folders/" + folderId;
        log.info("Fetching Drive folder via HTTP: {}", folderUrl);

        APIResponse folderResp = ctx.request().get(folderUrl);
        if (!folderResp.ok()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Could not access Drive folder (HTTP " + folderResp.status() + "). " +
                "Make sure the folder is shared with your connected Gmail account.");
        }
        String html = folderResp.text();
        log.debug("Drive folder HTML length: {}", html.length());

        // ── Step 2: Extract file IDs from the HTML ──
        // Drive embeds file IDs in several places in the raw HTML:
        //   - As /file/d/ID, /document/d/ID, /presentation/d/ID URL patterns
        //   - As /open?id=ID patterns
        //   - As "id":"ID" in embedded JSON
        Set<String> fileIds = extractFileIds(html, folderId);
        log.info("Drive folder HTML extracted {} candidate file IDs", fileIds.size());

        if (fileIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                "No files found in the Drive folder. Make sure: (1) the folder URL is correct, " +
                "(2) the folder is shared with the connected Gmail account, and " +
                "(3) it contains supported files (Google Docs, PDF, DOCX, TXT, HTML).");
        }

        // ── Step 3: Download each file ──
        for (String fileId : fileIds) {
            try {
                byte[] content = null;
                String effectiveMime = "application/octet-stream";
                String effectiveName = fileId;

                // Try Google Doc export first
                String docExport = "https://docs.google.com/document/d/" + fileId + "/export?format=txt";
                APIResponse resp = ctx.request().get(docExport);
                if (resp.ok() && resp.body().length > 0) {
                    content = resp.body();
                    effectiveMime = "text/plain";
                    effectiveName = fileId + ".txt";
                    log.info("Imported Google Doc {} as text ({} bytes)", fileId, content.length);
                }

                // Try Google Slides export
                if (content == null) {
                    String slidesExport = "https://docs.google.com/presentation/d/" + fileId + "/export/txt";
                    resp = ctx.request().get(slidesExport);
                    if (resp.ok() && resp.body().length > 0) {
                        content = resp.body();
                        effectiveMime = "text/plain";
                        effectiveName = fileId + ".txt";
                        log.info("Imported Google Slides {} as text ({} bytes)", fileId, content.length);
                    }
                }

                // Try Drive usercontent download (works for PDF, DOCX, etc.)
                if (content == null) {
                    String dlUrl = "https://drive.usercontent.google.com/download?id=" + fileId +
                                   "&export=download&authuser=0";
                    resp = ctx.request().get(dlUrl);
                    if (resp.ok() && resp.body().length > 0) {
                        content = resp.body();
                        String ct = resp.headers().getOrDefault("content-type", "application/octet-stream");
                        effectiveMime = ct.contains(";") ? ct.substring(0, ct.indexOf(';')).trim() : ct;
                        // Try to get filename from Content-Disposition
                        String cd = resp.headers().getOrDefault("content-disposition", "");
                        effectiveName = extractFilename(cd, fileId, effectiveMime);
                        log.info("Imported file {} ({} bytes, {})", effectiveName, content.length, effectiveMime);
                    }
                }

                // Fallback: classic Drive uc endpoint
                if (content == null) {
                    String ucUrl = "https://drive.google.com/uc?id=" + fileId + "&export=download";
                    resp = ctx.request().get(ucUrl);
                    if (resp.ok() && resp.body().length > 0) {
                        content = resp.body();
                        String ct = resp.headers().getOrDefault("content-type", "application/octet-stream");
                        effectiveMime = ct.contains(";") ? ct.substring(0, ct.indexOf(';')).trim() : ct;
                        String cd = resp.headers().getOrDefault("content-disposition", "");
                        effectiveName = extractFilename(cd, fileId, effectiveMime);
                        log.info("Imported file {} via uc ({} bytes)", effectiveName, content.length);
                    }
                }

                if (content == null || content.length == 0) {
                    log.debug("Skipping {} — could not download via any method", fileId);
                    continue;
                }
                if (content.length > MAX_FILE_BYTES) {
                    log.warn("Skipping {} — too large ({} bytes)", effectiveName, content.length);
                    continue;
                }
                if (!isSupportedMime(effectiveMime) && !isSupportedByExtension(effectiveName)) {
                    log.debug("Skipping {} — unsupported type ({})", effectiveName, effectiveMime);
                    continue;
                }

                CampaignPlanDocument doc = new CampaignPlanDocument();
                doc.setCampaignPlan(plan);
                doc.setOriginalFileName(effectiveName);
                doc.setMimeType(effectiveMime);
                doc.setFileContent(content);
                created.add(documentRepository.save(doc));

            } catch (Exception e) {
                log.warn("Failed to download file {} from Drive: {}", fileId, e.getMessage());
            }
        }

        return created;
    }

    /**
     * Extracts Drive file IDs from a folder page HTML response.
     * Looks for /file/d/ID, /document/d/ID, /open?id=ID, and "id":"ID" patterns.
     * Excludes the folder ID itself.
     */
    private Set<String> extractFileIds(String html, String folderId) {
        Set<String> ids = new LinkedHashSet<>();
        // Pattern 1: /file/d/ID, /document/d/ID, /presentation/d/ID in URLs
        Matcher m1 = Pattern.compile("/(?:file|document|presentation|spreadsheets)/d/([a-zA-Z0-9_-]{25,})").matcher(html);
        while (m1.find()) ids.add(m1.group(1));

        // Pattern 2: /open?id=ID or ?id=ID&
        Matcher m2 = Pattern.compile("[?&]id=([a-zA-Z0-9_-]{25,})").matcher(html);
        while (m2.find()) ids.add(m2.group(1));

        // Pattern 3: "id":"ID" in embedded JSON
        Matcher m3 = Pattern.compile("\"id\"\\s*:\\s*\"([a-zA-Z0-9_-]{25,})\"").matcher(html);
        while (m3.find()) ids.add(m3.group(1));

        // Pattern 4: bare IDs in data-id attributes
        Matcher m4 = Pattern.compile("data-id=\"([a-zA-Z0-9_-]{25,})\"").matcher(html);
        while (m4.find()) ids.add(m4.group(1));

        ids.remove(folderId); // don't try to download the folder itself
        return ids;
    }

    private String extractFilename(String contentDisposition, String fallbackId, String mime) {
        if (contentDisposition != null) {
            Matcher m = Pattern.compile("filename[^;=\\n]*=(['\"]?)([^'\"\\n;]+)\\1").matcher(contentDisposition);
            if (m.find()) return m.group(2).trim();
            m = Pattern.compile("filename\\*=UTF-8''([^\\s;]+)").matcher(contentDisposition);
            if (m.find()) return java.net.URLDecoder.decode(m.group(1), java.nio.charset.StandardCharsets.UTF_8);
        }
        // Derive extension from MIME
        String ext = mime.contains("pdf") ? ".pdf"
                   : mime.contains("wordprocessingml") ? ".docx"
                   : mime.contains("html") ? ".html"
                   : mime.startsWith("text/") ? ".txt"
                   : "";
        return fallbackId + ext;
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
}
