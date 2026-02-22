package com.campaignmanager.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

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

    /** The exact date and time this email step should be sent. */
    private LocalDateTime scheduledAt;
}
