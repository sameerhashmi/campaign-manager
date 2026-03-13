package com.campaignmanager.repository;

import com.campaignmanager.model.Campaign;
import com.campaignmanager.model.CampaignStatus;
import com.campaignmanager.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    List<Campaign> findByStatus(CampaignStatus status);
    long countByStatus(CampaignStatus status);
    long countByGmailEmail(String gmailEmail);

    List<Campaign> findAllByOwner(User owner);
    List<Campaign> findByStatusAndOwner(CampaignStatus status, User owner);
    long countByOwner(User owner);
    long countByStatusAndOwner(CampaignStatus status, User owner);
}
