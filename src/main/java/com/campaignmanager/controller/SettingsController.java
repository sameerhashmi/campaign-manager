package com.campaignmanager.controller;

import com.campaignmanager.dto.GmailSessionStatusDto;
import com.campaignmanager.service.PlaywrightSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
@Slf4j
public class SettingsController {

    private final PlaywrightSessionService sessionService;

    /**
     * Returns current Gmail session status.
     * The frontend polls this endpoint every few seconds while connecting.
     */
    @GetMapping("/gmail/status")
    public GmailSessionStatusDto getStatus() {
        return buildStatus();
    }

    /**
     * Starts the Gmail session setup asynchronously.
     * Opens a browser in a background thread — returns immediately (202 Accepted).
     * The frontend polls GET /status to detect completion.
     */
    @PostMapping("/gmail/connect")
    public ResponseEntity<GmailSessionStatusDto> connect() {
        if (sessionService.isConnecting()) {
            return ResponseEntity.ok(buildStatus());
        }
        sessionService.startConnectSession();
        GmailSessionStatusDto dto = buildStatus();
        dto.setConnecting(true);
        dto.setMessage("Browser window opened — please log into Gmail. This page will update automatically.");
        return ResponseEntity.ok(dto);
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

    /**
     * Accepts an uploaded gmail-session.json file (exported from a local machine where
     * Gmail login was completed). This is the only way to establish a Gmail session
     * in a headless/cloud environment where a visible browser cannot be opened.
     *
     * Usage: cf curl /api/settings/gmail/upload-session -X POST -F "file=@./data/gmail-session.json"
     * Or use the Settings page upload button.
     */
    @PostMapping("/gmail/upload-session")
    public ResponseEntity<GmailSessionStatusDto> uploadSession(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            GmailSessionStatusDto dto = new GmailSessionStatusDto();
            dto.setConnected(false);
            dto.setMessage("Uploaded file is empty.");
            return ResponseEntity.badRequest().body(dto);
        }
        try {
            Path sessionPath = sessionService.getSessionPath();
            Files.createDirectories(sessionPath.getParent());
            // Use InputStream copy so the absolute path is honoured regardless of
            // Tomcat's working directory (transferTo(File) resolves relative paths
            // against Tomcat's temp dir, not the Spring Boot app root).
            try (var in = file.getInputStream()) {
                Files.copy(in, sessionPath, StandardCopyOption.REPLACE_EXISTING);
            }
            sessionService.invalidateCachedContext();
            log.info("Gmail session uploaded via file upload ({} bytes)", file.getSize());
            GmailSessionStatusDto dto = buildStatus();
            dto.setMessage("Session file uploaded successfully. Gmail is now connected.");
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            log.error("Session file upload failed: {}", e.getMessage());
            GmailSessionStatusDto dto = new GmailSessionStatusDto();
            dto.setConnected(false);
            dto.setMessage("Upload failed: " + e.getMessage());
            return ResponseEntity.internalServerError().body(dto);
        }
    }

    private GmailSessionStatusDto buildStatus() {
        GmailSessionStatusDto dto = new GmailSessionStatusDto();
        dto.setConnected(sessionService.isSessionActive());
        dto.setConnecting(sessionService.isConnecting());
        dto.setConnectError(sessionService.getConnectError());
        dto.setSessionCreatedAt(sessionService.getSessionCreatedAt());

        if (dto.isConnecting()) {
            dto.setMessage("Browser is open — please log into Gmail. Do not close the browser window.");
        } else if (dto.getConnectError() != null) {
            dto.setMessage("Last attempt failed: " + dto.getConnectError());
        } else if (dto.isConnected()) {
            dto.setMessage("Gmail session is active. Emails will be sent using the saved session.");
        } else {
            dto.setMessage("No Gmail session. Click 'Connect Gmail' to log in.");
        }
        return dto;
    }
}
