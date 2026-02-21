package com.campaignmanager.service;

import com.campaignmanager.dto.ContactDto;
import com.campaignmanager.dto.CsvImportResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CsvImportService {

    private final ContactService contactService;

    public CsvImportResultDto importContacts(MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename != null && (filename.endsWith(".xlsx") || filename.endsWith(".xls"))) {
            return importFromExcel(file);
        }
        return importFromCsv(file);
    }

    private CsvImportResultDto importFromCsv(MultipartFile file) {
        int imported = 0, updated = 0, failed = 0;
        List<String> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()));
             CSVParser parser = CSVFormat.DEFAULT
                     .withFirstRecordAsHeader()
                     .withIgnoreHeaderCase()
                     .withTrim()
                     .parse(reader)) {

            for (CSVRecord record : parser) {
                try {
                    ContactDto dto = recordToDto(record);
                    boolean existed = contactService.findAll(dto.getEmail()).stream()
                            .anyMatch(c -> c.getEmail().equalsIgnoreCase(dto.getEmail()));
                    contactService.upsertByEmail(dto);
                    if (existed) updated++; else imported++;
                } catch (Exception e) {
                    failed++;
                    errors.add("Row " + record.getRecordNumber() + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            errors.add("Failed to parse CSV: " + e.getMessage());
        }

        return new CsvImportResultDto(imported, updated, failed, errors);
    }

    private CsvImportResultDto importFromExcel(MultipartFile file) {
        int imported = 0, updated = 0, failed = 0;
        List<String> errors = new ArrayList<>();

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                try {
                    ContactDto dto = rowToDto(row, headerRow);
                    boolean existed = contactService.findAll(dto.getEmail()).stream()
                            .anyMatch(c -> c.getEmail().equalsIgnoreCase(dto.getEmail()));
                    contactService.upsertByEmail(dto);
                    if (existed) updated++; else imported++;
                } catch (Exception e) {
                    failed++;
                    errors.add("Row " + (i + 1) + ": " + e.getMessage());
                }
            }
        } catch (Exception e) {
            errors.add("Failed to parse Excel: " + e.getMessage());
        }

        return new CsvImportResultDto(imported, updated, failed, errors);
    }

    private ContactDto recordToDto(CSVRecord record) {
        ContactDto dto = new ContactDto();
        dto.setEmail(getField(record, "email"));
        dto.setName(getField(record, "name"));
        dto.setRole(getField(record, "role"));
        dto.setCompany(getField(record, "company"));
        dto.setCategory(getField(record, "category"));
        if (dto.getEmail() == null || dto.getEmail().isBlank()) {
            throw new RuntimeException("Email is required");
        }
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new RuntimeException("Name is required");
        }
        return dto;
    }

    private String getField(CSVRecord record, String field) {
        try {
            return record.get(field);
        } catch (Exception e) {
            return null;
        }
    }

    private ContactDto rowToDto(Row row, Row headerRow) {
        ContactDto dto = new ContactDto();
        for (int col = 0; col < headerRow.getLastCellNum(); col++) {
            String header = headerRow.getCell(col).getStringCellValue().toLowerCase().trim();
            Cell cell = row.getCell(col);
            String value = cell != null ? getCellValue(cell) : null;
            switch (header) {
                case "email" -> dto.setEmail(value);
                case "name" -> dto.setName(value);
                case "role" -> dto.setRole(value);
                case "company" -> dto.setCompany(value);
                case "category" -> dto.setCategory(value);
            }
        }
        if (dto.getEmail() == null || dto.getEmail().isBlank()) throw new RuntimeException("Email is required");
        if (dto.getName() == null || dto.getName().isBlank()) throw new RuntimeException("Name is required");
        return dto;
    }

    private String getCellValue(Cell cell) {
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> null;
        };
    }
}
