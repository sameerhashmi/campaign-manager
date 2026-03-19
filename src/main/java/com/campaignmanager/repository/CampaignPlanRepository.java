package com.campaignmanager.repository;

import com.campaignmanager.model.CampaignPlan;
import com.campaignmanager.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CampaignPlanRepository extends JpaRepository<CampaignPlan, Long> {
    List<CampaignPlan> findAllByOwnerOrderByCreatedAtDesc(User owner);
    Optional<CampaignPlan> findByIdAndOwner(Long id, User owner);

    @Modifying
    @Query("UPDATE CampaignPlan p SET p.resultCampaign = null WHERE p.resultCampaign.id = :campaignId")
    void clearResultCampaignById(Long campaignId);
}
