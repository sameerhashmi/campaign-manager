package com.campaignmanager.service;

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.BrowserContext;
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
 * and parses out up to 7 email sections.
 *
 * <p>Supported doc formats:
 *
 * <p><b>Multi-line format</b> (one line per paragraph):
 * <pre>
 * Email 1: Initial Outreach (Day 1)
 * Subject: Your subject here
 * Hi Name,
 * Body text...
 *
 * Email 2: Follow-up (Day 4)
 * Subject: ...
 * </pre>
 *
 * <p><b>Single-line format</b> (each email on one line):
 * <pre>
 * Email 1: Initial Outreach (Day 1) Subject: Your subject Hi Name, body...
 * Email 2: Follow-up (Day 4) Subject: ...
 * </pre>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GoogleDocParserService {

    // Matches "Email N" at the START of a line (N = any digit).
    // Uses find() — does NOT require the whole line to match.
    private static final Pattern SECTION_HEADER = Pattern.compile(
            "(?i)^email\\s*(\\d+)\\b");

    // Strip Unicode invisible/format characters (zero-width spaces, BOM, etc.)
    private static final Pattern INVISIBLE = Pattern.compile(
            "[\\p{Cf}\\p{Zs}\\p{Co}\\p{Cs}]+");

    private static final Pattern SUBJECT_LINE = Pattern.compile(
            "(?i)^subject:\\s*(.+)");

    // Detects an email greeting at a word boundary (Hi/Hello/Dear + name).
    // Used to split inline "Subject: X Hi Name, body" into subject + body.
    private static final Pattern BODY_GREETING = Pattern.compile(
            "(?i)\\b(Hi|Hello|Dear)\\s+[A-Z]");

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
        log.info("Fetching Google Doc via API request: {}", exportUrl);

        BrowserContext ctx = sessionService.getSessionContext();
        APIResponse response = ctx.request().get(exportUrl);
        if (!response.ok()) {
            throw new Exception("Google Doc returned HTTP " + response.status() +
                    " for " + exportUrl +
                    ". Ensure the Gmail session is active and the doc is shared with the signed-in account.");
        }
        String text = response.text();
        if (text == null || text.isBlank()) {
            throw new Exception("Google Doc is empty or could not be read: " + exportUrl);
        }
        log.info("Google Doc fetched ({} chars), parsing sections", text.length());
        return parseText(text);
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

        // Log first 5 non-blank lines so we can see the actual structure
        String firstLines = java.util.Arrays.stream(lines)
                .filter(l -> !l.isBlank()).limit(5)
                .map(l -> "[" + l.strip() + "]")
                .collect(java.util.stream.Collectors.joining(", "));
        log.info("Doc first 5 non-blank lines: {}", firstLines);

        Map<Integer, List<String>> sections = new HashMap<>();
        int currentSection = -1;

        for (String raw : lines) {
            // Normalize: replace invisible Unicode chars with space, then strip.
            // This handles BOM (U+FEFF), zero-width spaces, non-breaking spaces, etc.
            String line = INVISIBLE.matcher(raw).replaceAll(" ").strip();

            Matcher header = SECTION_HEADER.matcher(line);
            if (header.find()) {
                // Line starts with "Email N" — start a new section
                currentSection = Integer.parseInt(header.group(1));
                sections.put(currentSection, new ArrayList<>());
                log.info("Doc parser: found section 'Email {}' (line: [{}])", currentSection, line);

                // Extract content from the same line (after "Email N: <description>")
                String rest = line.substring(header.end()).strip();
                // Strip leading ":" and the description (text before "Subject:")
                int subjectIdx = rest.toLowerCase().indexOf("subject:");
                if (subjectIdx > 0) {
                    // Inline format: "description Subject: ..." → keep from "Subject:" onward
                    rest = rest.substring(subjectIdx);
                } else if (subjectIdx < 0) {
                    // No inline Subject — rest is just a description like ": Initial Outreach (Day 1)"
                    // Discard it; real content starts on the next lines
                    rest = "";
                }
                // subjectIdx == 0 means the line is exactly "Subject: ..." (rare but fine)

                if (!rest.isBlank()) {
                    sections.get(currentSection).add(rest);
                }
            } else if (currentSection > 0) {
                sections.get(currentSection).add(line);
            }
        }

        log.info("Doc parser: found {} section(s): {}", sections.size(), sections.keySet());

        Map<Integer, ParsedEmail> result = new HashMap<>();
        for (Map.Entry<Integer, List<String>> entry : sections.entrySet()) {
            ParsedEmail pe = buildParsedEmail(entry.getValue());
            if (pe != null) result.put(entry.getKey(), pe);
        }
        return result;
    }

    private ParsedEmail buildParsedEmail(List<String> sectionLines) {
        // Skip leading blank lines
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
        boolean bodyStarted = (subject == null);
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

        // If subject contains an inline greeting (e.g. "Subject: Some text Hi Karl, body..."),
        // split at the greeting — works whether body lines follow or not.
        if (subject != null) {
            Matcher gm = BODY_GREETING.matcher(subject);
            if (gm.find()) {
                String inlineBody = subject.substring(gm.start()).strip();
                subject = subject.substring(0, gm.start()).strip();
                if (!inlineBody.isEmpty()) {
                    bodyLines.add(0, inlineBody); // prepend inline body before any remaining lines
                }
            }
        }

        // Trim trailing blank lines and section-separator lines ("—", "---", etc.)
        while (!bodyLines.isEmpty()) {
            String last = bodyLines.get(bodyLines.size() - 1);
            if (last.isBlank() || last.matches("[\\-—–=*]+")) {
                bodyLines.remove(bodyLines.size() - 1);
            } else {
                break;
            }
        }

        String body = String.join("\n", bodyLines);
        return new ParsedEmail(subject != null ? subject : "", body);
    }
}
