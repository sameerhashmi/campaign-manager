package com.campaignmanager.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GmailSessionStatusDto {
    private boolean connected;
    private boolean connecting;   // true while browser is open waiting for login
    private String connectError;  // last error from a failed connect attempt
    private LocalDateTime sessionCreatedAt;
    private String message;
    private String connectedEmail;    // Gmail account email of the active session
    private boolean cloudEnvironment; // true when running on CF / headless (no display server)
}
