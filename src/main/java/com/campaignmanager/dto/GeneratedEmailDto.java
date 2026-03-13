package com.campaignmanager.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GeneratedEmailDto {
    private Long id;
    private Long prospectContactId;
    private Integer stepNumber;
    private String subject;
    private String body;
    private LocalDateTime scheduledAt;
}
