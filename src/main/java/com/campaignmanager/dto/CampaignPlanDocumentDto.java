package com.campaignmanager.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CampaignPlanDocumentDto {
    private Long id;
    private String originalFileName;
    private String mimeType;
    private LocalDateTime createdAt;
}
