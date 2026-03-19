package com.campaignmanager.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "campaign_plans")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CampaignPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String customer;

    @Column(name = "tanzu_contact")
    private String tanzuContact;

    @Column(name = "drive_folder_url", length = 2048)
    private String driveFolderUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contact_gem_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Gem contactGem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "email_gem_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Gem emailGem;

    /** DRAFT | CONTACTS_READY | EMAILS_READY | COMPLETED */
    @Column(nullable = false, length = 20)
    private String status = "DRAFT";

    /** Set after convert() creates the live Campaign */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "result_campaign_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Campaign resultCampaign;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User owner;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "campaignPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProspectContact> prospectContacts = new ArrayList<>();

    @OneToMany(mappedBy = "campaignPlan", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CampaignPlanDocument> documents = new ArrayList<>();
}
