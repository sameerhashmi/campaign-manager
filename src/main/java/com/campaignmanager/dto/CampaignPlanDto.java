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
    private String gmailEmail;
    private String emailFormat;
    private Long contactGemId;
    private String contactGemName;
    private Long emailGemId;
    private String emailGemName;
    private String status;
    private String emailError;
    private Long resultCampaignId;
    private LocalDateTime createdAt;
}
