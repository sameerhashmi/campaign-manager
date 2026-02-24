package com.campaignmanager.service;

import com.campaignmanager.dto.ExcelImportResultDto;
import com.campaignmanager.model.*;
import com.campaignmanager.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

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

    private final ContactRepository contactRepository;
    private final CampaignRepository campaignRepository;
    private final CampaignContactRepository campaignContactRepository;
    private final EmailTemplateRepository templateRepository;
    private final EmailJobRepository emailJobRepository;
    private final GoogleDocParserService googleDocParser;

    @Transactional
    public ExcelImportResultDto importFromExcel(Long campaignId, MultipartFile file) throws Exception {
        return importFromExcel(campaignId, file, false);
    }

    /**
     * @param replace if true, removes all existing CampaignContacts before importing.
     */
    @Transactional
    public ExcelImportResultDto importFromExcel(Long campaignId, MultipartFile file, boolean replace) throws Exception {
        ExcelImportResultDto result = new ExcelImportResultDto();

        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + campaignId));

        if (replace) {
            campaignContactRepository.deleteByCampaignId(campaignId);
            log.info("Replace mode: removed all existing contacts from campaign {}", campaignId);
        }

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet firstSheet = workbook.getSheetAt(0);

            // Auto-detect format based on headers in first sheet
            if (isDirectFormat(firstSheet)) {
                log.info("Direct per-contact format detected for campaign {}", campaignId);
                importDirectFormat(firstSheet, campaign, result);
                result.setMessage(String.format(
                        "Import complete: %d contact(s) added/updated, %d email job(s) created%s.",
                        result.getContactsImported(),
                        result.getTemplatesImported(),
                        result.getSkipped() > 0 ? ", " + result.getSkipped() + " opted out/skipped" : ""));
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

        LocalDateTime now = LocalDateTime.now();
        int rowNum = 1;

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

            try {
                // Upsert contact
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

                // Enroll in campaign
                CampaignContact cc = campaignContactRepository
                        .findByCampaignIdAndContactId(campaign.getId(), savedContact.getId())
                        .orElseGet(() -> {
                            CampaignContact n = new CampaignContact();
                            n.setCampaign(campaign);
                            n.setContact(savedContact);
                            n.setEnrolledAt(LocalDateTime.now());
                            return campaignContactRepository.save(n);
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
                for (int step = 1; step <= 7; step++) {
                    LocalDateTime scheduledAt = readDateCell(row, emailDateCols[step - 1]);
                    if (scheduledAt == null) continue; // column empty — skip this step

                    GoogleDocParserService.ParsedEmail pe = parsedEmails.get(step);
                    if (pe == null) {
                        result.getErrors().add("Row " + rowNum + " (" + email + "): Email " + step + " section not found in Google Doc.");
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

                    result.setTemplatesImported(result.getTemplatesImported() + 1);
                }

            } catch (Exception e) {
                result.getErrors().add("Row " + rowNum + ": " + e.getMessage());
                log.warn("Failed to import row {}: {}", rowNum, e.getMessage());
            }
        }
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
            DateTimeFormatter.ofPattern("M/d/yyyy H:mm"),
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
