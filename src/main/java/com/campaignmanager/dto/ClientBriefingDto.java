package com.campaignmanager.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ClientBriefingDto {

    private Long id;

    @NotBlank
    private String clientName;

    private String documentLink;

    private String uploadedFileName;

    private String originalFileName;

    /** Computed by service: /api/client-briefings/{id}/document when uploadedFileName is set. */
    private String documentUrl;

    private LocalDateTime createdAt;
}
