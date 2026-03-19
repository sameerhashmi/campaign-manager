package com.campaignmanager.repository;

import com.campaignmanager.model.CampaignPlan;
import com.campaignmanager.model.CampaignPlanDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CampaignPlanDocumentRepository extends JpaRepository<CampaignPlanDocument, Long> {

    List<CampaignPlanDocument> findAllByCampaignPlan(CampaignPlan plan);

    Optional<CampaignPlanDocument> findByIdAndCampaignPlan(Long id, CampaignPlan plan);
}
