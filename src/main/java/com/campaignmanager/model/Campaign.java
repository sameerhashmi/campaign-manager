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

    @Column(name = "gmail_email")
    private String gmailEmail;

    @Column(name = "gmail_password")
    private String gmailPassword;

    /**
     * Comma-separated interval days, e.g. "0,3,7,14,21,30"
     * Each value represents days from enrollment to send that step's email.
     */
    @Column(name = "interval_days", nullable = false)
    private String intervalDays = "0,3,7,14,21,30";

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
