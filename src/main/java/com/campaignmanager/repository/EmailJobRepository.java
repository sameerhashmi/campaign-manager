package com.campaignmanager.repository;

import com.campaignmanager.model.EmailJob;
import com.campaignmanager.model.EmailJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface EmailJobRepository extends JpaRepository<EmailJob, Long> {

    @Query("SELECT ej FROM EmailJob ej WHERE ej.status = 'SCHEDULED' AND ej.scheduledAt <= :now")
    List<EmailJob> findDueJobs(@Param("now") LocalDateTime now);

    List<EmailJob> findByCampaignContactCampaignId(Long campaignId);

    List<EmailJob> findByCampaignContactCampaignIdAndStatus(Long campaignId, EmailJobStatus status);

    List<EmailJob> findByCampaignContactContactId(Long contactId);

    @Query("SELECT COUNT(ej) FROM EmailJob ej WHERE ej.status = :status")
    long countByStatus(@Param("status") EmailJobStatus status);

    @Query("SELECT COUNT(ej) FROM EmailJob ej WHERE ej.status = 'SENT' AND ej.sentAt >= :since")
    long countSentSince(@Param("since") LocalDateTime since);

    List<EmailJob> findByStatus(EmailJobStatus status);

    List<EmailJob> findAllByOrderByScheduledAtDesc();

    boolean existsByCampaignContactIdAndStepNumber(Long campaignContactId, int stepNumber);

    @Query("SELECT ej FROM EmailJob ej WHERE ej.campaignContact.campaign.id = :campaignId " +
           "ORDER BY ej.scheduledAt DESC")
    List<EmailJob> findByCampaignIdOrdered(@Param("campaignId") Long campaignId);
}
