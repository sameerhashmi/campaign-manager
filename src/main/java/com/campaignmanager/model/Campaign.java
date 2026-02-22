package com.campaignmanager.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "campaigns")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Campaign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;

    /** Optional — used for display/reference only. Actual sending uses the stored Playwright session. */
    @Column(name = "gmail_email")
    private String gmailEmail;

    /**
     * Retained for database compatibility. Each email template now carries
     * its own {@code scheduled_at} datetime; this field is no longer used.
     * Default empty string satisfies the existing NOT NULL constraint in H2.
     */
    @Column(name = "interval_days", nullable = false)
    private String intervalDays = "";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CampaignStatus status = CampaignStatus.DRAFT;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "launched_at")
    private LocalDateTime launchedAt;

    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EmailTemplate> templates = new ArrayList<>();

    @OneToMany(mappedBy = "campaign", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CampaignContact> campaignContacts = new ArrayList<>();
}
