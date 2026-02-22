package com.campaignmanager.controller;

import com.campaignmanager.dto.GmailSessionStatusDto;
import com.campaignmanager.service.PlaywrightSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
@Slf4j
public class SettingsController {

    private final PlaywrightSessionService sessionService;

    /**
     * Returns the current Gmail session status.
     */
    @GetMapping("/gmail/status")
    public GmailSessionStatusDto getStatus() {
        GmailSessionStatusDto dto = new GmailSessionStatusDto();
        dto.setConnected(sessionService.isSessionActive());
        dto.setSessionCreatedAt(sessionService.getSessionCreatedAt());
        dto.setMessage(dto.isConnected()
                ? "Gmail session is active. Emails will be sent using the saved session."
                : "No Gmail session. Click 'Connect Gmail' to log in.");
        return dto;
    }

    /**
     * Opens a visible browser window so the user can log into Gmail.
     * Waits up to 90 seconds for login, then saves the session.
     * This is a long-running request — the frontend should use a 120-second timeout.
     */
    @PostMapping("/gmail/connect")
    public ResponseEntity<GmailSessionStatusDto> connect() {
        try {
            sessionService.connectSession();
            return ResponseEntity.ok(getStatus());
        } catch (Exception e) {
            log.error("Gmail session setup failed: {}", e.getMessage());
            GmailSessionStatusDto dto = new GmailSessionStatusDto();
            dto.setConnected(false);
            dto.setMessage("Failed to establish Gmail session: " + e.getMessage());
            return ResponseEntity.internalServerError().body(dto);
        }
    }

    /**
     * Removes the saved Gmail session.
     */
    @DeleteMapping("/gmail/disconnect")
    public ResponseEntity<GmailSessionStatusDto> disconnect() {
        try {
            sessionService.disconnectSession();
            GmailSessionStatusDto dto = new GmailSessionStatusDto();
            dto.setConnected(false);
            dto.setMessage("Gmail session disconnected.");
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            log.error("Disconnect failed: {}", e.getMessage());
            GmailSessionStatusDto dto = new GmailSessionStatusDto();
            dto.setConnected(false);
            dto.setMessage("Disconnect failed: " + e.getMessage());
            return ResponseEntity.internalServerError().body(dto);
        }
    }
}
