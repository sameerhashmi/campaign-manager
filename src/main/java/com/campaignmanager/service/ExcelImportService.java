package com.campaignmanager.service;

import com.campaignmanager.dto.ExcelImportResultDto;
import com.campaignmanager.model.*;
import com.campaignmanager.repository.*;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.BrowserContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses an Excel workbook and imports contacts + email templates for a campaign.
 *
 * <h2>Format 1 — Legacy 2-sheet format</h2>
 * Sheet 1 — "Contacts":  headers → name | email | role | company
 * Sheet 2 — "Templates": headers → step_number | subject | body | scheduled_at
 * Contacts are upserted by email. Templates are inserted (existing ones not removed).
 *
 * <h2>Format 2 — Direct per-contact format (auto-detected)</h2>
 * Single sheet. Detected when headers include both "Email Link" and "Email 1".
 * Columns: Name | Title | Email | Phone | Play | Sub Play | [Why Target] | AE/SA |
 *          [Email Campaign] | Email Link | Email 1–7 | Opt Out
 * Each row = 1 contact with their own Google Doc (Email Link) containing 7 email bodies
 * and 7 individual scheduled dates (Email 1–Email 7 columns).
 * Opt Out = "Y" rows are skipped.
 * Creates EmailJob records directly — no shared templates needed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private static final Pattern SHEET_ID = Pattern.compile(
            "/spreadsheets/d/([a-zA-Z0-9_-]+)");

    private final ContactRepository contactRepository;
    private final CampaignRepository campaignRepository;
    private final CampaignContactRepository campaignContactRepository;
    private final EmailTemplateRepository templateRepository;
    private final EmailJobRepository emailJobRepository;
    private final GoogleDocParserService googleDocParser;
    private final PlaywrightSessionService sessionService;

    public ExcelImportResultDto importFromExcel(Long campaignId, MultipartFile file) throws Exception {
        return importFromExcel(campaignId, file, false);
    }

    /**
     * @param replace if true, removes all existing CampaignContacts before importing.
     *
     * NOTE: Not annotated with @Transactional intentionally — each row's saves are committed
     * immediately at the repository level. This prevents holding an open DB transaction during
     * Playwright I/O (Google Doc fetches), which can cause connection timeouts.
     */
    public ExcelImportResultDto importFromExcel(Long campaignId, MultipartFile file, boolean replace) throws Exception {
        try (InputStream is = file.getInputStream()) {
            return importFromStream(campaignId, is, replace);
        }
    }

    /**
     * Downloads a Google Sheet via the saved Gmail/Google session and imports it.
     * Accepts any Google Sheets URL (view, edit, etc.) — the sheet ID is extracted automatically.
     *
     * @param sheetUrl any Google Sheets URL
     * @param replace  if true, clears existing campaign contacts first
     */
    public ExcelImportResultDto importFromGoogleSheet(Long campaignId, String sheetUrl, boolean replace) throws Exception {
        Matcher m = SHEET_ID.matcher(sheetUrl);
        if (!m.find()) {
            throw new IllegalArgumentException("Cannot extract Google Sheet ID from URL: " + sheetUrl);
        }
        String exportUrl = "https://docs.google.com/spreadsheets/d/" + m.group(1) + "/export?format=xlsx";
        log.info("Downloading Google Sheet for campaign {}: {}", campaignId, exportUrl);

        BrowserContext ctx = sessionService.getSessionContext();
        APIResponse response = ctx.request().get(exportUrl);
        if (!response.ok()) {
            throw new RuntimeException(
                    "Failed to download Google Sheet (HTTP " + response.status() + "). " +
                    "Make sure the Gmail session is active and the sheet is shared with the signed-in account.");
        }

        byte[] body = response.body();
        // XLSX is a ZIP file — magic bytes are PK (0x50 0x4B). If Google returned HTML
        // (e.g. a login page or permission error) the bytes won't match.
        if (body.length < 4 || body[0] != 0x50 || body[1] != 0x4B) {
            String preview = new String(body, 0, Math.min(body.length, 200));
            throw new RuntimeException(
                    "Google Sheet download did not return a valid Excel file. " +
                    "The Gmail session may have expired — re-upload it in Settings. " +
                    "Response preview: " + preview);
        }

        try (InputStream is = new ByteArrayInputStream(body)) {
            return importFromStream(campaignId, is, replace);
        }
    }

    // ── Shared workbook processing ────────────────────────────────────────────

    private ExcelImportResultDto importFromStream(Long campaignId, InputStream is, boolean replace) throws Exception {
        ExcelImportResultDto result = new ExcelImportResultDto();

        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + campaignId));

        if (replace) {
            doDeleteByCampaignId(campaignId);
            log.info("Replace mode: removed all existing contacts from campaign {}", campaignId);
        }

        try (Workbook workbook = WorkbookFactory.create(is)) {

            Sheet firstSheet = workbook.getSheetAt(0);

            // Auto-detect format based on headers in first sheet
            if (isDirectFormat(firstSheet)) {
                log.info("Direct per-contact format detected for campaign {}", campaignId);
                importDirectFormat(firstSheet, campaign, result);
                return result;
            }

            // --- Legacy 2-sheet format ---

            Sheet contactSheet = workbook.getSheet("Contacts");
            if (contactSheet == null && workbook.getNumberOfSheets() > 0) {
                contactSheet = firstSheet;
            }
            if (contactSheet != null) {
                importContacts(contactSheet, campaign, result);
            } else {
                result.getErrors().add("No 'Contacts' sheet found in the workbook.");
            }

            Sheet templateSheet = workbook.getSheet("Templates");
            if (templateSheet == null && workbook.getNumberOfSheets() > 1) {
                templateSheet = workbook.getSheetAt(1);
            }
            if (templateSheet != null) {
                importTemplates(templateSheet, campaign, result);
            }
        }

        result.setMessage(String.format(
                "Import complete: %d contact(s) added/updated, %d email template(s) imported.",
                result.getContactsImported(), result.getTemplatesImported()));
        return result;
    }

    /** Wrapped in its own transaction so the delete commits before per-row saves start. */
    @Transactional
    protected void doDeleteByCampaignId(Long campaignId) {
        campaignContactRepository.deleteByCampaignId(campaignId);
    }

    // ─── Format detection ─────────────────────────────────────────────────────

    private boolean isDirectFormat(Sheet sheet) {
        Row header = sheet.getRow(0);
        if (header == null) return false;
        boolean hasEmailLink = false, hasEmail1 = false;
        for (Cell cell : header) {
            String h = getCellStringRaw(cell);
            if (h == null) continue;
            String norm = h.trim().toLowerCase();
            if (norm.equals("email link")) hasEmailLink = true;
            if (norm.equals("email 1"))    hasEmail1    = true;
        }
        return hasEmailLink && hasEmail1;
    }

    // ─── Direct per-contact format ────────────────────────────────────────────

    private void importDirectFormat(Sheet sheet, Campaign campaign, ExcelImportResultDto result) {
        Iterator<Row> rows = sheet.iterator();
        if (!rows.hasNext()) return;

        Row header = rows.next();

        // Column index map
        int nameCol = -1, titleCol = -1, emailCol = -1, phoneCol = -1;
        int playCol = -1, subPlayCol = -1, aeRoleCol = -1;
        int emailLinkCol = -1, optOutCol = -1;
        int[] emailDateCols = new int[]{-1, -1, -1, -1, -1, -1, -1}; // Email 1–7

        for (Cell cell : header) {
            String h = getCellStringRaw(cell);
            if (h == null) continue;
            String norm = h.trim().toLowerCase();
            int col = cell.getColumnIndex();
            switch (norm) {
                case "name"      -> nameCol      = col;
                case "title"     -> titleCol     = col;
                case "email"     -> emailCol     = col;
                case "phone"     -> phoneCol     = col;
                case "play"      -> playCol      = col;
                case "sub play"  -> subPlayCol   = col;
                case "ae/sa", "ae_sa", "ae role", "aerole" -> aeRoleCol = col;
                case "email link" -> emailLinkCol = col;
                case "opt out", "opt_out", "optout"        -> optOutCol  = col;
                default -> {
                    // "Email 1" … "Email 7"
                    if (norm.matches("email\\s*[1-7]")) {
                        int step = Integer.parseInt(norm.replaceAll("\\D", "")) - 1;
                        emailDateCols[step] = col;
                    }
                }
            }
        }

        if (emailCol == -1) {
            result.getErrors().add("Direct format sheet must have an 'Email' column.");
            return;
        }

        log.info("Direct format columns: name={} title={} email={} emailLink={} optOut={} emailDates={}",
                nameCol, titleCol, emailCol, emailLinkCol, optOutCol, java.util.Arrays.toString(emailDateCols));

        // AE/SA email filtering: only import rows whose AE/SA column matches the
        // connected Gmail session email. If no rows match, fail with a clear message.
        String sessionEmail = sessionService.getConnectedEmail();
        boolean filterByAeSa = aeRoleCol >= 0 && sessionEmail != null;
        if (aeRoleCol >= 0 && sessionEmail == null) {
            log.warn("AE/SA column found but connected Gmail email is unknown — skipping AE/SA filter. " +
                     "Re-upload the Gmail session to enable sender filtering.");
        }
        log.info("AE/SA filter: sessionEmail={} filterEnabled={}", sessionEmail, filterByAeSa);

        LocalDateTime now = LocalDateTime.now();
        int rowNum = 1;
        int aeSaFilteredOut = 0;

        while (rows.hasNext()) {
            Row row = rows.next();
            rowNum++;

            String email = getCellString(row, emailCol);
            if (email == null || email.isBlank()) continue;

            // Opt Out check
            String optOut = getCellString(row, optOutCol);
            if ("y".equalsIgnoreCase(optOut != null ? optOut.trim() : null)) {
                result.setSkipped(result.getSkipped() + 1);
                log.debug("Row {}: opted out ({}), skipping", rowNum, email);
                continue;
            }

            // AE/SA sender filter: skip rows whose AE/SA email doesn't match the session
            if (filterByAeSa) {
                String aeEmail = getCellString(row, aeRoleCol);
                if (aeEmail == null || !sessionEmail.equalsIgnoreCase(aeEmail.trim())) {
                    log.info("Row {}: AE/SA '{}' != session '{}' — skipping", rowNum, aeEmail, sessionEmail);
                    aeSaFilteredOut++;
                    continue;
                }
            }

            try {
                // Upsert contact — each save() is its own auto-transaction at repo level
                Contact contact = contactRepository.findByEmail(email).orElse(new Contact());
                contact.setEmail(email);
                String name = getCellString(row, nameCol);
                if (name != null) contact.setName(name);
                else if (contact.getName() == null) contact.setName(email); // fallback
                if (titleCol    >= 0) contact.setRole(getCellString(row, titleCol));
                if (phoneCol    >= 0) contact.setPhone(getCellString(row, phoneCol));
                if (playCol     >= 0) contact.setPlay(getCellString(row, playCol));
                if (subPlayCol  >= 0) contact.setSubPlay(getCellString(row, subPlayCol));
                if (aeRoleCol   >= 0) contact.setAeRole(getCellString(row, aeRoleCol));
                String emailLink = getCellString(row, emailLinkCol);
                if (emailLink   != null) contact.setEmailLink(emailLink);
                if (contact.getCreatedAt() == null) contact.setCreatedAt(LocalDateTime.now());
                final Contact savedContact = contactRepository.save(contact);
                log.info("Row {}: saved contact id={} email={}", rowNum, savedContact.getId(), email);

                // Enroll in campaign — immediate commit via repo-level transaction
                final Long campaignId    = campaign.getId();
                final Long contactId     = savedContact.getId();
                final int  currentRowNum = rowNum;
                CampaignContact cc = campaignContactRepository
                        .findByCampaignIdAndContactId(campaignId, contactId)
                        .orElseGet(() -> {
                            CampaignContact n = new CampaignContact();
                            n.setCampaign(campaign);
                            n.setContact(savedContact);
                            n.setEnrolledAt(LocalDateTime.now());
                            CampaignContact saved = campaignContactRepository.save(n);
                            log.info("Row {}: enrolled contact {} in campaign {}", currentRowNum, contactId, campaignId);
                            return saved;
                        });

                result.setContactsImported(result.getContactsImported() + 1);

                // Fetch Google Doc
                if (emailLink == null || emailLink.isBlank()) {
                    result.getErrors().add("Row " + rowNum + " (" + email + "): no Email Link — skipping job creation.");
                    continue;
                }

                Map<Integer, GoogleDocParserService.ParsedEmail> parsedEmails;
                try {
                    parsedEmails = googleDocParser.parseDoc(emailLink);
                } catch (Exception e) {
                    result.getErrors().add("Row " + rowNum + " (" + email + "): could not fetch Google Doc — " + e.getMessage());
                    log.warn("Row {}: Google Doc fetch failed for {}: {}", rowNum, emailLink, e.getMessage());
                    continue;
                }

                // Create up to 7 EmailJob records
                log.info("Row {}: {} email section(s) parsed from doc", rowNum, parsedEmails.size());
                for (int step = 1; step <= 7; step++) {
                    LocalDateTime scheduledAt = readDateCell(row, emailDateCols[step - 1]);
                    if (scheduledAt == null) {
                        log.debug("Row {}: step {} has no date (col={}), skipping", rowNum, step, emailDateCols[step - 1]);
                        continue; // column empty — skip this step
                    }

                    GoogleDocParserService.ParsedEmail pe = parsedEmails.get(step);
                    if (pe == null) {
                        String msg = "Row " + rowNum + " (" + email + "): Email " + step + " section not found in Google Doc.";
                        result.getErrors().add(msg);
                        log.warn(msg);
                        continue;
                    }

                    // Skip if job already exists for this cc + step
                    boolean jobExists = emailJobRepository.existsByCampaignContactIdAndStepNumber(
                            cc.getId(), step);
                    if (jobExists) continue;

                    String resolvedSubject = resolveTokens(pe.subject(), savedContact);
                    String resolvedBody    = resolveTokens(pe.body(),    savedContact);

                    EmailJobStatus status = scheduledAt.isBefore(now)
                            ? EmailJobStatus.SKIPPED
                            : EmailJobStatus.SCHEDULED;

                    EmailJob job = new EmailJob();
                    job.setCampaignContact(cc);
                    job.setStepNumber(step);
                    job.setSubject(resolvedSubject);
                    job.setBody(resolvedBody);
                    job.setScheduledAt(scheduledAt);
                    job.setStatus(status);
                    emailJobRepository.save(job);
                    log.info("Row {}: created email job step={} scheduledAt={} status={}", rowNum, step, scheduledAt, status);

                    result.setTemplatesImported(result.getTemplatesImported() + 1);
                }

            } catch (Exception e) {
                result.getErrors().add("Row " + rowNum + ": " + e.getMessage());
                log.warn("Failed to import row {}: {}", rowNum, e.getMessage());
            }
        }

        // Post-loop AE/SA filter check: if filter was active but nothing matched, set error message
        if (filterByAeSa && result.getContactsImported() == 0 && aeSaFilteredOut > 0) {
            result.getErrors().add(0,
                    "Gmail Session and Sender email address doesn't match. " +
                    "Connected session: " + sessionEmail + ". " +
                    "None of the " + aeSaFilteredOut + " row(s) had a matching AE/SA email address.");
            result.setMessage("Import failed: no rows matched the connected Gmail account.");
            return;
        }

        // Set final message (includes AE/SA skip note if applicable)
        String filterNote = (filterByAeSa && aeSaFilteredOut > 0)
                ? ", " + aeSaFilteredOut + " row(s) skipped (AE/SA mismatch)" : "";
        result.setMessage(String.format(
                "Import complete: %d contact(s) added/updated, %d email job(s) created%s%s.",
                result.getContactsImported(),
                result.getTemplatesImported(),
                result.getSkipped() > 0 ? ", " + result.getSkipped() + " opted out/skipped" : "",
                filterNote));
    }

    // ─── Token resolution ─────────────────────────────────────────────────────

    private String resolveTokens(String template, Contact contact) {
        if (template == null) return "";
        return template
                .replace("{{name}}",    contact.getName()    != null ? contact.getName()    : "")
                .replace("{{Name}}",    contact.getName()    != null ? contact.getName()    : "")
                .replace("{{title}}",   contact.getRole()    != null ? contact.getRole()    : "")
                .replace("{{Title}}",   contact.getRole()    != null ? contact.getRole()    : "")
                .replace("{{role}}",    contact.getRole()    != null ? contact.getRole()    : "")
                .replace("{{company}}", contact.getCompany() != null ? contact.getCompany() : "")
                .replace("{{play}}",    contact.getPlay()    != null ? contact.getPlay()    : "");
    }

    // ─── Legacy 2-sheet: Contacts ─────────────────────────────────────────────

    private void importContacts(Sheet sheet, Campaign campaign, ExcelImportResultDto result) {
        Iterator<Row> rows = sheet.iterator();
        if (!rows.hasNext()) return;

        Row header = rows.next();
        int nameCol = -1, emailCol = -1, roleCol = -1, companyCol = -1;

        for (Cell cell : header) {
            String h = cell.getStringCellValue().trim().toLowerCase();
            switch (h) {
                case "name"    -> nameCol    = cell.getColumnIndex();
                case "email"   -> emailCol   = cell.getColumnIndex();
                case "role"    -> roleCol    = cell.getColumnIndex();
                case "company" -> companyCol = cell.getColumnIndex();
            }
        }

        if (emailCol == -1) {
            result.getErrors().add("Contacts sheet must have an 'email' column.");
            return;
        }

        int rowNum = 1;
        while (rows.hasNext()) {
            Row row = rows.next();
            rowNum++;

            String email = getCellString(row, emailCol);
            if (email == null || email.isBlank()) continue;

            try {
                Contact contact = contactRepository.findByEmail(email).orElse(new Contact());
                contact.setEmail(email);
                if (nameCol    >= 0) contact.setName(getCellString(row, nameCol));
                if (roleCol    >= 0) contact.setRole(getCellString(row, roleCol));
                if (companyCol >= 0) contact.setCompany(getCellString(row, companyCol));
                if (contact.getCreatedAt() == null) contact.setCreatedAt(LocalDateTime.now());
                contact = contactRepository.save(contact);

                boolean alreadyEnrolled = campaignContactRepository
                        .existsByCampaignIdAndContactId(campaign.getId(), contact.getId());
                if (!alreadyEnrolled) {
                    CampaignContact cc = new CampaignContact();
                    cc.setCampaign(campaign);
                    cc.setContact(contact);
                    cc.setEnrolledAt(LocalDateTime.now());
                    campaignContactRepository.save(cc);
                }

                result.setContactsImported(result.getContactsImported() + 1);
            } catch (Exception e) {
                result.getErrors().add("Row " + rowNum + ": " + e.getMessage());
                log.warn("Failed to import contact at row {}: {}", rowNum, e.getMessage());
            }
        }
    }

    // ─── Legacy 2-sheet: Templates ────────────────────────────────────────────

    private static final List<DateTimeFormatter> DT_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("M/d/yyyy H:mm:ss"),
            DateTimeFormatter.ofPattern("M/d/yyyy H:mm"),
            DateTimeFormatter.ofPattern("M/d/yy H:mm:ss"),
            DateTimeFormatter.ofPattern("M/d/yy H:mm")
    );

    private void importTemplates(Sheet sheet, Campaign campaign, ExcelImportResultDto result) {
        Iterator<Row> rows = sheet.iterator();
        if (!rows.hasNext()) return;

        Row header = rows.next();
        int stepCol = -1, subjectCol = -1, bodyCol = -1, scheduledAtCol = -1;

        for (Cell cell : header) {
            String h = cell.getStringCellValue().trim().toLowerCase()
                    .replace(" ", "_").replace("-", "_");
            switch (h) {
                case "step_number", "step" -> stepCol         = cell.getColumnIndex();
                case "subject"             -> subjectCol      = cell.getColumnIndex();
                case "body", "body_template" -> bodyCol       = cell.getColumnIndex();
                case "scheduled_at", "scheduled_date", "send_at", "send_date"
                                           -> scheduledAtCol  = cell.getColumnIndex();
            }
        }

        if (subjectCol == -1 || bodyCol == -1) {
            result.getErrors().add("Templates sheet must have 'subject' and 'body' columns.");
            return;
        }

        int rowNum = 1;
        int stepCounter = 1;
        while (rows.hasNext()) {
            Row row = rows.next();
            rowNum++;

            String subject = getCellString(row, subjectCol);
            String body    = getCellString(row, bodyCol);
            if ((subject == null || subject.isBlank()) && (body == null || body.isBlank())) continue;

            try {
                int stepNumber = stepCounter;
                if (stepCol >= 0) {
                    String sv = getCellString(row, stepCol);
                    if (sv != null && !sv.isBlank()) {
                        stepNumber = (int) Double.parseDouble(sv);
                    }
                }

                LocalDateTime scheduledAt = null;
                if (scheduledAtCol >= 0) {
                    Cell dtCell = row.getCell(scheduledAtCol, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    if (dtCell != null) {
                        if (dtCell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(dtCell)) {
                            scheduledAt = dtCell.getLocalDateTimeCellValue();
                        } else {
                            String sv = getCellString(row, scheduledAtCol);
                            if (sv != null && !sv.isBlank()) {
                                scheduledAt = parseDateTime(sv);
                                if (scheduledAt == null) {
                                    result.getErrors().add("Template row " + rowNum +
                                            ": could not parse scheduled_at value '" + sv +
                                            "'. Use format: yyyy-MM-dd HH:mm");
                                }
                            }
                        }
                    }
                }

                EmailTemplate template = new EmailTemplate();
                template.setCampaign(campaign);
                template.setStepNumber(stepNumber);
                template.setSubject(subject != null ? subject : "");
                template.setBodyTemplate(body != null ? body : "");
                template.setScheduledAt(scheduledAt);
                templateRepository.save(template);

                result.setTemplatesImported(result.getTemplatesImported() + 1);
                stepCounter = stepNumber + 1;
            } catch (Exception e) {
                result.getErrors().add("Template row " + rowNum + ": " + e.getMessage());
                log.warn("Failed to import template at row {}: {}", rowNum, e.getMessage());
            }
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private LocalDateTime readDateCell(Row row, int col) {
        if (col < 0) return null;
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue();
        }
        String sv = getCellStringRaw(cell);
        if (sv == null || sv.isBlank()) return null;
        return parseDateTime(sv);
    }

    private LocalDateTime parseDateTime(String value) {
        for (DateTimeFormatter fmt : DT_FORMATTERS) {
            try {
                return LocalDateTime.parse(value.trim(), fmt);
            } catch (DateTimeParseException ignored) {}
        }
        return null;
    }

    private String getCellString(Row row, int col) {
        if (col < 0) return null;
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        return getCellStringRaw(cell);
    }

    private String getCellStringRaw(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double v = cell.getNumericCellValue();
                yield (v == Math.floor(v)) ? String.valueOf((long) v) : String.valueOf(v);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> cell.getCellFormula();
            default -> null;
        };
    }
}
