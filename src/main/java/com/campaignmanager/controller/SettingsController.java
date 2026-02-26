package com.campaignmanager.controller;

import com.campaignmanager.dto.GmailSessionStatusDto;
import com.campaignmanager.service.PlaywrightSessionService;
import com.campaignmanager.service.PlaywrightSystemDepsInstaller;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
    private final PlaywrightSystemDepsInstaller systemDepsInstaller;

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
     *
     * Not available in headless/cloud environments (no display server). In those
     * environments the user must upload a gmail-session.json via the upload endpoint.
     */
    @PostMapping("/gmail/connect")
    public ResponseEntity<GmailSessionStatusDto> connect() {
        if (systemDepsInstaller.isCloudFoundry()) {
            GmailSessionStatusDto dto = buildStatus();
            dto.setMessage("Connect Gmail is not available in this environment — no display server. " +
                    "Generate a gmail-session.json locally and upload it using the 'Upload Session File' button below.");
            return ResponseEntity.badRequest().body(dto);
        }
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
            // Detect the Gmail account email from the uploaded session in the background
            sessionService.detectEmailInBackground();
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

    /**
     * Accepts cookies exported by the "Cookie Editor" Chrome extension (a JSON array)
     * and converts them to the Playwright storageState format ({cookies:[...],origins:[]}).
     * This allows non-technical users to establish a Gmail session with zero local installs:
     * install Cookie Editor → log into Gmail → Export → paste here.
     *
     * Also accepts a pre-converted Playwright session JSON (passed through unchanged).
     */
    @PostMapping("/gmail/import-cookies")
    public ResponseEntity<GmailSessionStatusDto> importCookies(@RequestBody String cookieEditorJson) {
        try {
            String playwrightJson = convertCookieEditorToPlaywright(cookieEditorJson);
            Path sessionPath = sessionService.getSessionPath();
            Files.createDirectories(sessionPath.getParent());
            Files.writeString(sessionPath, playwrightJson);
            sessionService.invalidateCachedContext();
            log.info("Gmail session imported from Cookie Editor JSON ({} chars)", playwrightJson.length());
            sessionService.detectEmailInBackground();
            GmailSessionStatusDto dto = buildStatus();
            dto.setMessage("Gmail cookies imported successfully. Gmail is now connected.");
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            log.error("Cookie import failed: {}", e.getMessage());
            GmailSessionStatusDto dto = new GmailSessionStatusDto();
            dto.setConnected(false);
            dto.setMessage("Cookie import failed: " + e.getMessage());
            return ResponseEntity.badRequest().body(dto);
        }
    }

    /**
     * Converts a Cookie Editor JSON array to Playwright storageState format.
     * If the input is already a Playwright object (has "cookies" key), returns it unchanged.
     */
    private String convertCookieEditorToPlaywright(String json) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(json);

        // Already Playwright format — pass through
        if (root.isObject() && root.has("cookies")) {
            return json;
        }
        if (!root.isArray()) {
            throw new IllegalArgumentException(
                    "Expected a JSON array from Cookie Editor export, or a Playwright session object.");
        }

        ArrayNode playwrightCookies = mapper.createArrayNode();
        for (JsonNode c : root) {
            ObjectNode pc = mapper.createObjectNode();
            pc.put("name",     c.path("name").asText());
            pc.put("value",    c.path("value").asText());
            pc.put("domain",   c.path("domain").asText());
            pc.put("path",     c.path("path").asText("/"));
            pc.put("httpOnly", c.path("httpOnly").asBoolean(false));
            pc.put("secure",   c.path("secure").asBoolean(false));
            // session cookies have no persistent expiry → -1 means session-scoped in Playwright
            if (c.has("expirationDate") && !c.path("session").asBoolean(false)) {
                pc.put("expires", c.path("expirationDate").asLong());
            } else {
                pc.put("expires", -1L);
            }
            String sameSite = c.path("sameSite").asText("no_restriction");
            pc.put("sameSite", switch (sameSite.toLowerCase()) {
                case "strict" -> "Strict";
                case "lax"    -> "Lax";
                default       -> "None";
            });
            playwrightCookies.add(pc);
        }

        ObjectNode result = mapper.createObjectNode();
        result.set("cookies", playwrightCookies);
        result.putArray("origins");
        return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(result);
    }

    private GmailSessionStatusDto buildStatus() {
        GmailSessionStatusDto dto = new GmailSessionStatusDto();
        dto.setConnected(sessionService.isSessionActive());
        dto.setConnecting(sessionService.isConnecting());
        dto.setConnectError(sessionService.getConnectError());
        dto.setSessionCreatedAt(sessionService.getSessionCreatedAt());
        dto.setConnectedEmail(sessionService.getConnectedEmail());
        dto.setCloudEnvironment(systemDepsInstaller.isCloudFoundry());

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
