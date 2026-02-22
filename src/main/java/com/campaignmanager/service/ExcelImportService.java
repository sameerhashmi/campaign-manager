package com.campaignmanager.service;

import com.campaignmanager.dto.ExcelImportResultDto;
import com.campaignmanager.model.*;
import com.campaignmanager.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.Iterator;

/**
 * Parses an Excel workbook and imports contacts + email templates for a campaign.
 *
 * Expected workbook format (two sheets):
 *
 * Sheet 1 — "Contacts"  (or the first sheet):
 *   Row 1: headers → name | email | role | company
 *   Row 2+: data rows
 *
 * Sheet 2 — "Templates"  (or the second sheet):
 *   Row 1: headers → step_number | subject | body
 *   Row 2+: data rows (step_number is 1-based integer)
 *
 * Contacts are upserted by email address.
 * Templates are inserted (existing templates for the campaign are NOT removed).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private final ContactRepository contactRepository;
    private final CampaignRepository campaignRepository;
    private final CampaignContactRepository campaignContactRepository;
    private final EmailTemplateRepository templateRepository;

    @Transactional
    public ExcelImportResultDto importFromExcel(Long campaignId, MultipartFile file) throws Exception {
        ExcelImportResultDto result = new ExcelImportResultDto();

        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + campaignId));

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            // --- Sheet 1: Contacts ---
            Sheet contactSheet = workbook.getSheet("Contacts");
            if (contactSheet == null && workbook.getNumberOfSheets() > 0) {
                contactSheet = workbook.getSheetAt(0);
            }
            if (contactSheet != null) {
                importContacts(contactSheet, campaign, result);
            } else {
                result.getErrors().add("No 'Contacts' sheet found in the workbook.");
            }

            // --- Sheet 2: Templates ---
            Sheet templateSheet = workbook.getSheet("Templates");
            if (templateSheet == null && workbook.getNumberOfSheets() > 1) {
                templateSheet = workbook.getSheetAt(1);
            }
            if (templateSheet != null) {
                importTemplates(templateSheet, campaign, result);
            }
            // Templates sheet is optional — no error if absent
        }

        result.setMessage(String.format(
                "Import complete: %d contact(s) added/updated, %d email template(s) imported.",
                result.getContactsImported(), result.getTemplatesImported()));
        return result;
    }

    private void importContacts(Sheet sheet, Campaign campaign, ExcelImportResultDto result) {
        Iterator<Row> rows = sheet.iterator();
        if (!rows.hasNext()) return;

        // Parse header row to find column indices
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
                // Upsert contact by email
                Contact contact = contactRepository.findByEmail(email)
                        .orElse(new Contact());
                contact.setEmail(email);
                if (nameCol    >= 0) contact.setName(getCellString(row, nameCol));
                if (roleCol    >= 0) contact.setRole(getCellString(row, roleCol));
                if (companyCol >= 0) contact.setCompany(getCellString(row, companyCol));
                contact = contactRepository.save(contact);

                // Enroll in campaign if not already enrolled
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

    private void importTemplates(Sheet sheet, Campaign campaign, ExcelImportResultDto result) {
        Iterator<Row> rows = sheet.iterator();
        if (!rows.hasNext()) return;

        // Parse header row
        Row header = rows.next();
        int stepCol = -1, subjectCol = -1, bodyCol = -1;

        for (Cell cell : header) {
            String h = cell.getStringCellValue().trim().toLowerCase()
                    .replace(" ", "_").replace("-", "_");
            switch (h) {
                case "step_number", "step" -> stepCol    = cell.getColumnIndex();
                case "subject"            -> subjectCol = cell.getColumnIndex();
                case "body", "body_template" -> bodyCol = cell.getColumnIndex();
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

                EmailTemplate template = new EmailTemplate();
                template.setCampaign(campaign);
                template.setStepNumber(stepNumber);
                template.setSubject(subject != null ? subject : "");
                template.setBodyTemplate(body != null ? body : "");
                templateRepository.save(template);

                result.setTemplatesImported(result.getTemplatesImported() + 1);
                stepCounter = stepNumber + 1;
            } catch (Exception e) {
                result.getErrors().add("Template row " + rowNum + ": " + e.getMessage());
                log.warn("Failed to import template at row {}: {}", rowNum, e.getMessage());
            }
        }
    }

    private String getCellString(Row row, int col) {
        if (col < 0) return null;
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
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
