package com.campaignmanager.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DashboardStatsDto {
    private long totalCampaigns;
    private long activeCampaigns;
    private long draftCampaigns;
    private long totalContacts;
    private long emailsSentToday;
    private long emailsScheduled;
    private long emailsFailed;
    private long totalEmailsSent;
}
