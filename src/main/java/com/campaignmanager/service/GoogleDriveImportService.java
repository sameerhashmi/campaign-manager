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
 * Downloads Google Docs / Slides / Sheets / Drive files from individual share URLs.
 *
 * Uses ctx.request().get() with docs.google.com export endpoints — CF's corporate proxy
 * blocks drive.google.com (folder listing) but allows docs.google.com requests (same
 * pattern as ExcelImportService's Google Sheets download).
 *
 * Usage: users paste individual Google Docs / Slides / Drive file share links.
 * The service extracts the file ID from each URL and downloads via the appropriate
 * docs.google.com export endpoint.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleDriveImportService {

    private static final long MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file

    private final PlaywrightSessionService sessionService;
    private final CampaignPlanDocumentRepository documentRepository;

    /**
     * Extracts a Drive/Docs file ID from a share URL.
     * Supports:
     *   https://docs.google.com/document/d/{id}/...
     *   https://docs.google.com/presentation/d/{id}/...
     *   https://docs.google.com/spreadsheets/d/{id}/...
     *   https://drive.google.com/file/d/{id}/...
     *   https://drive.google.com/open?id={id}
     */
    public String extractFileIdFromUrl(String url) {
        if (url == null) return null;
        Matcher m1 = Pattern.compile("/d/([a-zA-Z0-9_-]{25,})").matcher(url);
        if (m1.find()) return m1.group(1);
        Matcher m2 = Pattern.compile("[?&]id=([a-zA-Z0-9_-]{25,})").matcher(url);
        if (m2.find()) return m2.group(1);
        return null;
    }

    /**
     * Downloads each file identified by the provided share URLs using the connected Gmail session.
     * Saves each as a CampaignPlanDocument linked to the given plan.
     *
     * Download order per file:
     *   1. Google Doc export  (docs.google.com — CF-proxy-safe)
     *   2. Google Slides export (docs.google.com — CF-proxy-safe)
     *   3. Google Sheets export (docs.google.com — CF-proxy-safe)
     *   4. drive.usercontent.google.com (PDF, DOCX, etc.)
     */
    public List<CampaignPlanDocument> importFiles(List<String> fileUrls, CampaignPlan plan) {
        if (fileUrls == null || fileUrls.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file URLs provided.");
        }

        BrowserContext ctx = sessionService.getSessionContext();
        List<CampaignPlanDocument> created = new ArrayList<>();

        for (String url : fileUrls) {
            if (url == null || url.isBlank()) continue;

            String fileId = extractFileIdFromUrl(url.trim());
            if (fileId == null) {
                log.warn("Could not extract file ID from URL: {}", url.trim());
                continue;
            }

            try {
                byte[] content = null;
                String effectiveMime = "application/octet-stream";
                String effectiveName = fileId;

                // ── 1. Google Doc export ──
                String docExport = "https://docs.google.com/document/d/" + fileId + "/export?format=txt";
                APIResponse resp = ctx.request().get(docExport);
                if (resp.ok() && resp.body().length > 0) {
                    content = resp.body();
                    effectiveMime = "text/plain";
                    effectiveName = fileId + ".txt";
                    log.info("Imported Google Doc {} as text ({} bytes)", fileId, content.length);
                }

                // ── 2. Google Slides export ──
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

                // ── 3. Google Sheets export ──
                if (content == null) {
                    String sheetsExport = "https://docs.google.com/spreadsheets/d/" + fileId + "/export?format=csv";
                    resp = ctx.request().get(sheetsExport);
                    if (resp.ok() && resp.body().length > 0) {
                        content = resp.body();
                        effectiveMime = "text/plain";
                        effectiveName = fileId + ".txt";
                        log.info("Imported Google Sheets {} as CSV ({} bytes)", fileId, content.length);
                    }
                }

                // ── 4. Drive usercontent download (PDF, DOCX, etc.) ──
                if (content == null) {
                    String dlUrl = "https://drive.usercontent.google.com/download?id=" + fileId +
                                   "&export=download&authuser=0";
                    resp = ctx.request().get(dlUrl);
                    if (resp.ok() && resp.body().length > 0) {
                        content = resp.body();
                        String ct = resp.headers().getOrDefault("content-type", "application/octet-stream");
                        effectiveMime = ct.contains(";") ? ct.substring(0, ct.indexOf(';')).trim() : ct;
                        String cd = resp.headers().getOrDefault("content-disposition", "");
                        effectiveName = extractFilename(cd, fileId, effectiveMime);
                        log.info("Imported file {} ({} bytes, {})", effectiveName, content.length, effectiveMime);
                    }
                }

                if (content == null || content.length == 0) {
                    log.warn("Could not download {} — tried Doc/Slides/Sheets/Drive export", fileId);
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
                log.warn("Failed to download file from URL {}: {}", url, e.getMessage());
            }
        }

        return created;
    }

    private String extractFilename(String contentDisposition, String fallbackId, String mime) {
        if (contentDisposition != null) {
            Matcher m = Pattern.compile("filename[^;=\\n]*=(['\"]?)([^'\"\\n;]+)\\1").matcher(contentDisposition);
            if (m.find()) return m.group(2).trim();
            m = Pattern.compile("filename\\*=UTF-8''([^\\s;]+)").matcher(contentDisposition);
            if (m.find()) return java.net.URLDecoder.decode(m.group(1), java.nio.charset.StandardCharsets.UTF_8);
        }
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
