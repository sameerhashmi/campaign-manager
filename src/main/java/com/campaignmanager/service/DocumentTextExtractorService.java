package com.campaignmanager.service;

import com.campaignmanager.model.CampaignPlanDocument;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Extracts plain text from uploaded campaign plan documents.
 * Supports HTML, plain text, PDF, DOCX, and DOC.
 * Returns a single concatenated corpus string suitable for inclusion in a Gemini prompt.
 */
@Service
@Slf4j
public class DocumentTextExtractorService {

    private static final int MAX_CHARS_PER_FILE = 30_000;

    /**
     * Extracts text from all documents and returns a single corpus string,
     * with each file labeled by name.
     */
    public String extractAll(List<CampaignPlanDocument> docs) {
        if (docs == null || docs.isEmpty()) return "";

        StringBuilder corpus = new StringBuilder();
        for (CampaignPlanDocument doc : docs) {
            String text = extractOne(doc);
            if (text != null && !text.isBlank()) {
                corpus.append("\n\n=== Document: ").append(doc.getOriginalFileName()).append(" ===\n");
                if (text.length() > MAX_CHARS_PER_FILE) {
                    corpus.append(text, 0, MAX_CHARS_PER_FILE).append("\n[...truncated]");
                } else {
                    corpus.append(text);
                }
            }
        }
        return corpus.toString();
    }

    private String extractOne(CampaignPlanDocument doc) {
        if (doc.getFileContent() == null || doc.getFileContent().length == 0) return null;

        String mime = doc.getMimeType() != null ? doc.getMimeType().toLowerCase() : "";
        String name = doc.getOriginalFileName() != null ? doc.getOriginalFileName().toLowerCase() : "";

        try {
            if (mime.contains("html") || name.endsWith(".html") || name.endsWith(".htm")) {
                return stripHtml(new String(doc.getFileContent(), StandardCharsets.UTF_8));
            }

            if (mime.contains("text/plain") || name.endsWith(".txt")) {
                return new String(doc.getFileContent(), StandardCharsets.UTF_8);
            }

            if (mime.contains("pdf") || name.endsWith(".pdf")) {
                return extractPdf(doc.getFileContent());
            }

            if (mime.contains("wordprocessingml") || name.endsWith(".docx")) {
                return extractDocx(doc.getFileContent());
            }

            log.debug("Unsupported file type '{}' ({}), skipping", doc.getOriginalFileName(), mime);
            return null;

        } catch (Exception e) {
            log.warn("Failed to extract text from '{}': {}", doc.getOriginalFileName(), e.getMessage());
            return null;
        }
    }

    private String stripHtml(String html) {
        // Remove script and style blocks entirely
        String stripped = html
                .replaceAll("(?is)<script[^>]*>.*?</script>", " ")
                .replaceAll("(?is)<style[^>]*>.*?</style>", " ")
                .replaceAll("<[^>]+>", " ")           // strip all tags
                .replaceAll("&nbsp;", " ")
                .replaceAll("&amp;", "&")
                .replaceAll("&lt;", "<")
                .replaceAll("&gt;", ">")
                .replaceAll("&quot;", "\"")
                .replaceAll("&#[0-9]+;", " ")
                .replaceAll("\\s{2,}", " ")           // collapse whitespace
                .trim();
        return stripped;
    }

    private String extractPdf(byte[] bytes) throws Exception {
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(doc);
        }
    }

    private String extractDocx(byte[] bytes) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes));
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            return extractor.getText();
        }
    }

}
