package com.campaignmanager.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ExcelImportResultDto {
    private int contactsImported;
    private int templatesImported;
    private List<String> errors = new ArrayList<>();
    private String message;
}
