package com.campaignmanager.repository;

import com.campaignmanager.model.CampaignPlan;
import com.campaignmanager.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CampaignPlanRepository extends JpaRepository<CampaignPlan, Long> {
    List<CampaignPlan> findAllByOwnerOrderByCreatedAtDesc(User owner);
    Optional<CampaignPlan> findByIdAndOwner(Long id, User owner);
}
