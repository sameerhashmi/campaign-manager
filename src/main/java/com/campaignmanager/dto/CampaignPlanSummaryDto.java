package com.campaignmanager.dto;

import lombok.Data;

@Data
public class CampaignPlanSummaryDto {
    private String campaignName;
    private String customer;
    private String tanzuContact;
    private String contactGemName;
    private String emailGemName;
    private int contactCount;
    private int emailCount;
    private String scheduleStart; // e.g. "Wed, Mar 18, 2026"
    private String scheduleEnd;   // e.g. "Thu, May 7, 2026"
}
