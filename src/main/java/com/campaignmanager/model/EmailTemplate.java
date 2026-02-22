package com.campaignmanager.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "email_templates")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmailTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private Campaign campaign;

    /** Step number (1-based) defining the order of emails in the sequence. */
    @Column(name = "step_number", nullable = false)
    private Integer stepNumber;

    @Column(nullable = false)
    private String subject;

    /**
     * Body template supporting tokens: {{name}}, {{role}}, {{company}}, {{category}}
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String bodyTemplate;

    /** The exact date and time this email step should be sent. */
    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;
}
