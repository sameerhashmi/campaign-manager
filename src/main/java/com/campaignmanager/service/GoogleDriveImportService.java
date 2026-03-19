package com.campaignmanager.service;

import com.campaignmanager.model.CampaignPlan;
import com.campaignmanager.model.CampaignPlanDocument;
import com.campaignmanager.repository.CampaignPlanDocumentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Downloads files from a publicly-shared Google Drive folder using a Google API key
 * (the same key stored as the Gemini API key, which is a standard Google Cloud API key).
 * Requires the folder to be shared as "Anyone with the link can view".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleDriveImportService {

    private static final String DRIVE_API = "https://www.googleapis.com/drive/v3";
    private static final long MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file
    private static final int MAX_FILES = 20;

    // Supported native MIME types
    private static final List<String> SUPPORTED_MIME_TYPES = List.of(
            "application/pdf",
            "text/html", "text/plain",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    // Google Workspace types we can export as plain text
    private static final List<String> EXPORTABLE_GOOGLE_TYPES = List.of(
            "application/vnd.google-apps.document",
            "application/vnd.google-apps.presentation"
    );

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final CampaignPlanDocumentRepository documentRepository;

    /**
     * Extracts the folder ID from a Google Drive folder URL.
     * Supports formats like:
     *   https://drive.google.com/drive/folders/{id}
     *   https://drive.google.com/drive/u/0/folders/{id}
     */
    public String extractFolderId(String folderUrl) {
        if (folderUrl == null) return null;
        Pattern p = Pattern.compile("/folders/([a-zA-Z0-9_-]+)");
        Matcher m = p.matcher(folderUrl);
        return m.find() ? m.group(1) : null;
    }

    /**
     * Lists and downloads all supported files from the given public Drive folder.
     * Saves each as a CampaignPlanDocument linked to the given plan.
     * Returns the newly created documents.
     */
    public List<CampaignPlanDocument> importFolder(String folderId, String apiKey, CampaignPlan plan) {
        List<CampaignPlanDocument> created = new ArrayList<>();

        // 1. List files in the folder
        String listUrl = DRIVE_API + "/files"
                + "?q='" + folderId + "'+in+parents"
                + "&fields=files(id,name,mimeType,size)"
                + "&pageSize=" + MAX_FILES
                + "&key=" + apiKey;

        String listBody;
        try {
            ResponseEntity<String> resp = restTemplate.getForEntity(listUrl, String.class);
            listBody = resp.getBody();
        } catch (Exception e) {
            throw new RuntimeException("Could not list Drive folder. Make sure the folder is shared as 'Anyone with the link can view'. Error: " + e.getMessage(), e);
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(listBody);
        } catch (Exception e) {
            throw new RuntimeException("Unexpected response from Drive API", e);
        }

        if (root.has("error")) {
            String msg = root.path("error").path("message").asText("Drive API error");
            int code = root.path("error").path("code").asInt(0);
            if (code == 403 || msg.toLowerCase().contains("forbidden") || msg.toLowerCase().contains("accessNotConfigured")) {
                throw new RuntimeException("Drive API access denied. Enable the Google Drive API for your API key in Google Cloud Console, and ensure the folder is publicly shared.");
            }
            throw new RuntimeException("Drive API error: " + msg);
        }

        JsonNode files = root.path("files");
        if (!files.isArray() || files.size() == 0) {
            throw new RuntimeException("No files found in the Drive folder. Make sure the folder is shared as 'Anyone with the link can view' and contains supported files (PDF, DOCX, TXT, HTML, Google Docs).");
        }

        // 2. Download each supported file
        for (JsonNode file : files) {
            String fileId = file.path("id").asText();
            String name = file.path("name").asText("unknown");
            String mime = file.path("mimeType").asText("");

            try {
                byte[] content;
                String effectiveMime;

                if (EXPORTABLE_GOOGLE_TYPES.contains(mime)) {
                    // Export Google Docs/Slides as plain text
                    String exportUrl = DRIVE_API + "/files/" + fileId + "/export"
                            + "?mimeType=text/plain&key=" + apiKey;
                    ResponseEntity<byte[]> resp = restTemplate.getForEntity(exportUrl, byte[].class);
                    content = resp.getBody();
                    effectiveMime = "text/plain";
                    name = name + ".txt";
                } else if (SUPPORTED_MIME_TYPES.contains(mime) || isSupportedByExtension(name)) {
                    long size = file.path("size").asLong(0);
                    if (size > MAX_FILE_BYTES) {
                        log.warn("Skipping '{}' — too large ({} bytes)", name, size);
                        continue;
                    }
                    String downloadUrl = DRIVE_API + "/files/" + fileId + "?alt=media&key=" + apiKey;
                    ResponseEntity<byte[]> resp = restTemplate.getForEntity(downloadUrl, byte[].class);
                    content = resp.getBody();
                    effectiveMime = mime;
                } else {
                    log.debug("Skipping unsupported file '{}' ({})", name, mime);
                    continue;
                }

                if (content == null || content.length == 0) {
                    log.warn("Empty content for file '{}', skipping", name);
                    continue;
                }

                CampaignPlanDocument doc = new CampaignPlanDocument();
                doc.setCampaignPlan(plan);
                doc.setOriginalFileName(name);
                doc.setMimeType(effectiveMime);
                doc.setFileContent(content);
                created.add(documentRepository.save(doc));
                log.info("Imported '{}' ({} bytes) from Drive folder", name, content.length);

            } catch (Exception e) {
                log.warn("Failed to download '{}' from Drive: {}", name, e.getMessage());
            }
        }

        return created;
    }

    private boolean isSupportedByExtension(String name) {
        String lower = name.toLowerCase();
        return lower.endsWith(".pdf") || lower.endsWith(".docx")
                || lower.endsWith(".txt") || lower.endsWith(".html") || lower.endsWith(".htm");
    }
}
