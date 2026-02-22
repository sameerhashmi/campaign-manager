package com.campaignmanager.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GmailSessionStatusDto {
    private boolean connected;
    private LocalDateTime sessionCreatedAt;
    private String message;
}
