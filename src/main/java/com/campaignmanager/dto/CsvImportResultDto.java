package com.campaignmanager.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class CsvImportResultDto {
    private int imported;
    private int updated;
    private int failed;
    private List<String> errors;
}
