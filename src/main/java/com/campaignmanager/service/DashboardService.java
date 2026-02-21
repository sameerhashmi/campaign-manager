package com.campaignmanager.service;

import com.campaignmanager.dto.DashboardStatsDto;
import com.campaignmanager.model.CampaignStatus;
import com.campaignmanager.model.EmailJobStatus;
import com.campaignmanager.repository.CampaignRepository;
import com.campaignmanager.repository.ContactRepository;
import com.campaignmanager.repository.EmailJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CampaignRepository campaignRepository;
    private final ContactRepository contactRepository;
    private final EmailJobRepository emailJobRepository;

    public DashboardStatsDto getStats() {
        DashboardStatsDto stats = new DashboardStatsDto();
        stats.setTotalCampaigns(campaignRepository.count());
        stats.setActiveCampaigns(campaignRepository.countByStatus(CampaignStatus.ACTIVE));
        stats.setDraftCampaigns(campaignRepository.countByStatus(CampaignStatus.DRAFT));
        stats.setTotalContacts(contactRepository.count());
        stats.setEmailsSentToday(emailJobRepository.countSentSince(LocalDateTime.now().toLocalDate().atStartOfDay()));
        stats.setEmailsScheduled(emailJobRepository.countByStatus(EmailJobStatus.SCHEDULED));
        stats.setEmailsFailed(emailJobRepository.countByStatus(EmailJobStatus.FAILED));
        stats.setTotalEmailsSent(emailJobRepository.countByStatus(EmailJobStatus.SENT));
        return stats;
    }
}
