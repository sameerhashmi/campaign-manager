package com.campaignmanager.repository;

import com.campaignmanager.model.Campaign;
import com.campaignmanager.model.CampaignStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    List<Campaign> findByStatus(CampaignStatus status);
    long countByStatus(CampaignStatus status);
}
