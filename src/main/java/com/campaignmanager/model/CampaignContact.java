package com.campaignmanager.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "campaign_contacts",
    uniqueConstraints = @UniqueConstraint(columnNames = {"campaign_id", "contact_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CampaignContact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private Campaign campaign;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "contact_id", nullable = false)
    private Contact contact;

    @Column(name = "enrolled_at", nullable = false)
    private LocalDateTime enrolledAt = LocalDateTime.now();

    @OneToMany(mappedBy = "campaignContact", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EmailJob> emailJobs = new ArrayList<>();
}
