package com.campaignmanager.service;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches a private Google Doc (plain-text export) via the stored Gmail BrowserContext
 * (same Google account cookies = same access to Google Docs) and parses out up to 7
 * email sections structured as:
 *
 * <pre>
 * Email 1:
 * Subject: Your subject here
 * Body line 1
 * Body line 2
 *
 * Email 2:
 * ...
 * </pre>
 *
 * If the doc has no "Subject:" line in a section, the first non-blank line is used as subject
 * and the remaining lines as body.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleDocParserService {

    private static final Pattern SECTION_HEADER = Pattern.compile(
            "(?i)^email\\s*(\\d+)\\s*:?\\s*$");
    private static final Pattern SUBJECT_LINE = Pattern.compile(
            "(?i)^subject:\\s*(.+)");
    private static final Pattern DOC_ID = Pattern.compile(
            "/document/d/([a-zA-Z0-9_-]+)");

    private final PlaywrightSessionService sessionService;

    public record ParsedEmail(String subject, String body) {}

    /**
     * Fetches and parses the Google Doc at {@code docUrl}.
     *
     * @return map from step number (1–7) to {@link ParsedEmail}; never null
     * @throws Exception if the doc cannot be fetched or is empty
     */
    public Map<Integer, ParsedEmail> parseDoc(String docUrl) throws Exception {
        String exportUrl = buildExportUrl(docUrl);
        log.info("Fetching Google Doc: {}", exportUrl);

        BrowserContext ctx = sessionService.getSessionContext();
        Page page = ctx.newPage();
        try {
            page.navigate(exportUrl);
            // The plain-text export renders inside <pre> or directly in <body>
            String text = (String) page.evaluate("() => document.body.innerText");
            if (text == null || text.isBlank()) {
                throw new Exception("Google Doc is empty or could not be read: " + exportUrl);
            }
            return parseText(text);
        } finally {
            try { page.close(); } catch (Exception ignored) {}
        }
    }

    // ── URL handling ──────────────────────────────────────────────────────────

    private String buildExportUrl(String docUrl) throws Exception {
        Matcher m = DOC_ID.matcher(docUrl);
        if (!m.find()) {
            throw new Exception("Cannot extract Google Doc ID from URL: " + docUrl);
        }
        String docId = m.group(1);
        return "https://docs.google.com/document/d/" + docId + "/export?format=txt";
    }

    // ── Text parsing ──────────────────────────────────────────────────────────

    Map<Integer, ParsedEmail> parseText(String text) {
        String[] lines = text.split("\\r?\\n");

        Map<Integer, List<String>> sections = new HashMap<>();
        int currentSection = -1;

        for (String raw : lines) {
            String line = raw.stripTrailing();
            Matcher header = SECTION_HEADER.matcher(line);
            if (header.matches()) {
                currentSection = Integer.parseInt(header.group(1));
                sections.put(currentSection, new ArrayList<>());
            } else if (currentSection > 0) {
                sections.get(currentSection).add(line);
            }
        }

        Map<Integer, ParsedEmail> result = new HashMap<>();
        for (Map.Entry<Integer, List<String>> entry : sections.entrySet()) {
            ParsedEmail pe = buildParsedEmail(entry.getValue());
            if (pe != null) result.put(entry.getKey(), pe);
        }
        return result;
    }

    private ParsedEmail buildParsedEmail(List<String> sectionLines) {
        // Remove leading blank lines
        int start = 0;
        while (start < sectionLines.size() && sectionLines.get(start).isBlank()) start++;
        if (start >= sectionLines.size()) return null;

        String subject = null;
        List<String> bodyLines = new ArrayList<>();

        // Check first non-blank line for "Subject: ..."
        String firstLine = sectionLines.get(start);
        Matcher sm = SUBJECT_LINE.matcher(firstLine);
        if (sm.matches()) {
            subject = sm.group(1).trim();
            start++;
        }

        // Collect remaining lines as body (skip initial blank after subject)
        boolean bodyStarted = (subject == null); // if no Subject: line, first line IS first body line
        for (int i = start; i < sectionLines.size(); i++) {
            String l = sectionLines.get(i);
            if (!bodyStarted && l.isBlank()) continue;
            bodyStarted = true;
            bodyLines.add(l);
        }

        // If no Subject: line, use first body line as subject
        if (subject == null && !bodyLines.isEmpty()) {
            subject = bodyLines.remove(0).trim();
        }

        // Trim trailing blank lines from body
        while (!bodyLines.isEmpty() && bodyLines.get(bodyLines.size() - 1).isBlank()) {
            bodyLines.remove(bodyLines.size() - 1);
        }

        String body = String.join("\n", bodyLines);
        return new ParsedEmail(subject != null ? subject : "", body);
    }
}
