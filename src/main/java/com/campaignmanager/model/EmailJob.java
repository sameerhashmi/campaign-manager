package com.campaignmanager.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "email_jobs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmailJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_contact_id", nullable = false)
    private CampaignContact campaignContact;

    @Column(name = "step_number", nullable = false)
    private Integer stepNumber;

    @Column(nullable = false)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EmailJobStatus status = EmailJobStatus.SCHEDULED;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
}
