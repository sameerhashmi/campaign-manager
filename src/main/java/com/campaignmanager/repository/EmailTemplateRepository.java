package com.campaignmanager.repository;

import com.campaignmanager.model.EmailTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long> {
    List<EmailTemplate> findByCampaignIdOrderByStepNumber(Long campaignId);
    void deleteByCampaignId(Long campaignId);
}
