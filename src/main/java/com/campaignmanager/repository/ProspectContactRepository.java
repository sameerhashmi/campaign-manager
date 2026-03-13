package com.campaignmanager.repository;

import com.campaignmanager.model.CampaignPlan;
import com.campaignmanager.model.ProspectContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProspectContactRepository extends JpaRepository<ProspectContact, Long> {
    List<ProspectContact> findAllByCampaignPlanOrderByName(CampaignPlan campaignPlan);
    List<ProspectContact> findAllByCampaignPlanAndSelectedTrue(CampaignPlan campaignPlan);
    void deleteAllByCampaignPlan(CampaignPlan campaignPlan);
}
