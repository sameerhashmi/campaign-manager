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

    /** Optional — display/reference only. Sending uses the stored Playwright session. */
    private String gmailEmail;

    private CampaignStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime launchedAt;
    private List<EmailTemplateDto> templates;
    private long contactCount;
    private long jobCount;
}
