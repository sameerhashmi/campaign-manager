package com.campaignmanager.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EmailTemplateDto {
    private Long id;
    private Long campaignId;

    @NotNull
    private Integer stepNumber;

    @NotBlank
    private String subject;

    @NotBlank
    private String bodyTemplate;
}
