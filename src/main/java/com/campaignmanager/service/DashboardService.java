package com.campaignmanager.service;

import com.campaignmanager.dto.DashboardStatsDto;
import com.campaignmanager.model.CampaignStatus;
import com.campaignmanager.model.EmailJobStatus;
import com.campaignmanager.model.User;
import com.campaignmanager.repository.CampaignRepository;
import com.campaignmanager.repository.ContactRepository;
import com.campaignmanager.repository.EmailJobRepository;
import com.campaignmanager.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CampaignRepository campaignRepository;
    private final ContactRepository contactRepository;
    private final EmailJobRepository emailJobRepository;
    private final UserRepository userRepository;

    public DashboardStatsDto getStats(Authentication auth) {
        boolean admin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (admin) return getGlobalStats();
        User owner = userRepository.findByUsername(auth.getName()).orElse(null);
        if (owner == null) return getGlobalStats();
        return getOwnerStats(owner);
    }

    private DashboardStatsDto getGlobalStats() {
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

    private DashboardStatsDto getOwnerStats(User owner) {
        DashboardStatsDto stats = new DashboardStatsDto();
        stats.setTotalCampaigns(campaignRepository.countByOwner(owner));
        stats.setActiveCampaigns(campaignRepository.countByStatusAndOwner(CampaignStatus.ACTIVE, owner));
        stats.setDraftCampaigns(campaignRepository.countByStatusAndOwner(CampaignStatus.DRAFT, owner));
        stats.setTotalContacts(contactRepository.countByOwner(owner));
        stats.setEmailsSentToday(emailJobRepository.countSentSinceByOwner(
                LocalDateTime.now().toLocalDate().atStartOfDay(), owner));
        stats.setEmailsScheduled(emailJobRepository.countByStatusAndOwner(EmailJobStatus.SCHEDULED, owner));
        stats.setEmailsFailed(emailJobRepository.countByStatusAndOwner(EmailJobStatus.FAILED, owner));
        stats.setTotalEmailsSent(emailJobRepository.countByStatusAndOwner(EmailJobStatus.SENT, owner));
        return stats;
    }
}
