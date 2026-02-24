package com.campaignmanager.repository;

import com.campaignmanager.model.CampaignContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CampaignContactRepository extends JpaRepository<CampaignContact, Long> {
    List<CampaignContact> findByCampaignId(Long campaignId);
    Optional<CampaignContact> findByCampaignIdAndContactId(Long campaignId, Long contactId);
    boolean existsByCampaignIdAndContactId(Long campaignId, Long contactId);

    @Query("SELECT COUNT(cc) FROM CampaignContact cc WHERE cc.campaign.id = :campaignId")
    long countByCampaignId(@Param("campaignId") Long campaignId);

    void deleteByCampaignId(Long campaignId);
}
