package com.campaignmanager.dto;

import com.campaignmanager.model.CampaignStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class CampaignDto {
    private Long id;

    @NotBlank
    private String name;

    private String description;

    @NotBlank
    private String gmailEmail;

    private String gmailPassword;

    @NotBlank
    private String intervalDays;

    private CampaignStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime launchedAt;
    private List<EmailTemplateDto> templates;
    private long contactCount;
    private long jobCount;
}
