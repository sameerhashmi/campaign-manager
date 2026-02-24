package com.campaignmanager.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ContactDto {
    private Long id;

    @NotBlank
    private String name;

    @NotBlank
    @Email
    private String email;

    private String role;
    private String company;
    private String category;
    private String phone;
    private String play;
    private String subPlay;
    private String aeRole;
    private String emailLink;
    private LocalDateTime createdAt;
    private boolean enrolledInCampaign;
}
