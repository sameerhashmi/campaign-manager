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
@Table(name = "prospect_contacts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProspectContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_plan_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private CampaignPlan campaignPlan;

    @Column(nullable = false)
    private String name;

    private String title;

    private String email;

    @Column(name = "role_type")
    private String roleType;

    @Column(name = "team_domain")
    private String teamDomain;

    @Column(name = "technical_strengths", columnDefinition = "TEXT")
    private String technicalStrengths;

    @Column(name = "seniority_signal")
    private String senioritySignal;

    @Column(name = "influence_indicators", columnDefinition = "TEXT")
    private String influenceIndicators;

    private String source;

    @Column(name = "tanzu_relevance")
    private String tanzuRelevance;

    @Column(name = "tanzu_team")
    private String tanzuTeam;

    @Column(nullable = false)
    private Boolean selected = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "prospectContact", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GeneratedEmail> generatedEmails = new ArrayList<>();
}
