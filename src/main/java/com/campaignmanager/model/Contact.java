package com.campaignmanager.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.ToString;

import java.time.LocalDateTime;

@Entity
@Table(name = "contacts",
       uniqueConstraints = @UniqueConstraint(name = "uk_contact_email_owner", columnNames = {"email", "owner_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User owner;

    private String role;

    private String company;

    private String category;

    private String phone;

    private String play;

    @Column(name = "sub_play")
    private String subPlay;

    @Column(name = "ae_role")
    private String aeRole;

    @Column(name = "email_link", length = 2048)
    private String emailLink;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
