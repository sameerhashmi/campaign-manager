package com.campaignmanager.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CampaignPlanDto {
    private Long id;
    private String name;
    private String customer;
    private String tanzuContact;
    private String driveFolderUrl;
    private Long contactGemId;
    private String contactGemName;
    private Long emailGemId;
    private String emailGemName;
    private String status;
    private Long resultCampaignId;
    private LocalDateTime createdAt;
}
