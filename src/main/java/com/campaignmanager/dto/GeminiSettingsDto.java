package com.campaignmanager.dto;

import lombok.Data;

@Data
public class GeminiSettingsDto {
    private boolean connected;
    private String maskedKey; // e.g. "••••••••1234"
}
