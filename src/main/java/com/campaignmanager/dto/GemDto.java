package com.campaignmanager.dto;

import lombok.Data;

@Data
public class GemDto {
    private Long id;
    private String name;
    private String description;
    private String systemInstructions;
    private String gemType; // CONTACT_RESEARCH | EMAIL_GENERATION
}
