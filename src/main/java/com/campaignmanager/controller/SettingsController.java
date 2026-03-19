package com.campaignmanager.controller;

import com.campaignmanager.dto.ConnectedSessionDto;
import com.campaignmanager.dto.GeminiSettingsDto;
import com.campaignmanager.dto.GmailSessionStatusDto;
import com.campaignmanager.model.User;
import com.campaignmanager.model.UserGeminiSettings;
import com.campaignmanager.repository.CampaignRepository;
import com.campaignmanager.repository.UserGeminiSettingsRepository;
import com.campaignmanager.repository.UserRepository;
import com.campaignmanager.service.GeminiApiService;
import com.campaignmanager.service.PlaywrightSessionService;
import com.campaignmanager.service.PlaywrightSystemDepsInstaller;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
@Slf4j
public class SettingsController {

    private static final String SESSIONS_DIR = "./data/sessions";

    private final PlaywrightSessionService sessionService;
    private final PlaywrightSystemDepsInstaller systemDepsInstaller;
    private final CampaignRepository campaignRepository;
    private final UserGeminiSettingsRepository geminiSettingsRepository;
    private final UserRepository userRepository;
    private final GeminiApiService geminiApiService;

    // ─── Status ───────────────────────────────────────────────────────────────

    @GetMapping("/gmail/status")
    public GmailSessionStatusDto getStatus(Authentication auth) {
        return buildStatus(auth);
    }

    // ─── List / Disconnect Sessions ───────────────────────────────────────────

    /** Returns all connected Gmail accounts with session metadata.
     *  Admin: returns all. Regular user: returns only their own session. */
    @GetMapping("/gmail/sessions")
    public List<ConnectedSessionDto> listSessions(Authentication auth) {
        return buildSessionList(auth);
    }

    /** Disconnects a specific Gmail account (URL-encoded email in path). */
    @DeleteMapping("/gmail/sessions/{email}")
    public ResponseEntity<GmailSessionStatusDto> disconnectByEmail(@PathVariable String email,
                                                                    Authentication auth) {
        String decoded = URLDecoder.decode(email, StandardCharsets.UTF_8);
        if (!isAdmin(auth) && !decoded.equalsIgnoreCase(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You can only disconnect your own Gmail session.");
        }
        try {
            sessionService.disconnectSession(decoded);
            log.info("Disconnected Gmail session for {}", decoded);
            return ResponseEntity.ok(buildStatus(auth));
        } catch (Exception e) {
            log.error("Disconnect failed for {}: {}", email, e.getMessage());
            GmailSessionStatusDto dto = buildStatus(auth);
            dto.setMessage("Disconnect failed: " + e.getMessage());
            return ResponseEntity.internalServerError().body(dto);
        }
    }

    // ─── Connect (local browser) ──────────────────────────────────────────────

    @PostMapping("/gmail/connect")
    public ResponseEntity<GmailSessionStatusDto> connect(Authentication auth) {
        if (systemDepsInstaller.isCloudFoundry()) {
            GmailSessionStatusDto dto = buildStatus(auth);
            dto.setMessage("Connect Gmail is not available in this environment — no display server. " +
                    "Use 'Upload Session File' or 'Connect via Gmail Cookies' below.");
            return ResponseEntity.badRequest().body(dto);
        }
        if (sessionService.isConnecting()) {
            return ResponseEntity.ok(buildStatus(auth));
        }
        sessionService.startConnectSession();
        GmailSessionStatusDto dto = buildStatus(auth);
        dto.setConnecting(true);
        dto.setMessage("Browser window opened — please log into Gmail. This page will update automatically.");
        return ResponseEntity.ok(dto);
    }

    // ─── Disconnect (legacy single-session endpoint — kept for backward compat) ─

    @DeleteMapping("/gmail/disconnect")
    public ResponseEntity<GmailSessionStatusDto> disconnect(Authentication auth) {
        try {
            List<String> toDisconnect = isAdmin(auth)
                    ? sessionService.listConnectedEmails()
                    : sessionService.listConnectedEmails().stream()
                            .filter(e -> e.equalsIgnoreCase(auth.getName()))
                            .collect(Collectors.toList());
            for (String email : toDisconnect) {
                sessionService.disconnectSession(email);
            }
            GmailSessionStatusDto dto = new GmailSessionStatusDto();
            dto.setConnected(false);
            dto.setMessage("Gmail session(s) disconnected.");
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            log.error("Disconnect failed: {}", e.getMessage());
            GmailSessionStatusDto dto = new GmailSessionStatusDto();
            dto.setConnected(false);
            dto.setMessage("Disconnect failed: " + e.getMessage());
            return ResponseEntity.internalServerError().body(dto);
        }
    }

    // ─── Upload Session File ──────────────────────────────────────────────────

    /**
     * Accepts an uploaded gmail-session.json Playwright storageState file.
     * Detects the Gmail account synchronously (opens headless browser, navigates
     * to Gmail, reads page title) and saves as sessions/{email}.json.
     */
    @PostMapping("/gmail/upload-session")
    public ResponseEntity<GmailSessionStatusDto> uploadSession(@RequestParam("file") MultipartFile file,
                                                               Authentication auth) {
        if (file.isEmpty()) {
            GmailSessionStatusDto dto = buildStatus(auth);
            dto.setMessage("Uploaded file is empty.");
            return ResponseEntity.badRequest().body(dto);
        }
        Path tempPath = Paths.get(SESSIONS_DIR, "upload-" + System.currentTimeMillis() + ".json");
        try {
            Files.createDirectories(tempPath.getParent());
            try (var in = file.getInputStream()) {
                Files.copy(in, tempPath, StandardCopyOption.REPLACE_EXISTING);
            }

            String email = sessionService.detectEmailSync(tempPath);
            if (email == null) {
                Files.deleteIfExists(tempPath);
                GmailSessionStatusDto dto = buildStatus(auth);
                dto.setMessage("Could not detect Gmail account from this session file. " +
                        "Make sure the session was exported from a logged-in Gmail inbox.");
                return ResponseEntity.badRequest().body(dto);
            }

            // Non-admin: session email must match the user's login email
            if (!isAdmin(auth) && !email.equalsIgnoreCase(auth.getName())) {
                Files.deleteIfExists(tempPath);
                GmailSessionStatusDto dto = buildStatus(auth);
                dto.setMessage("This session belongs to " + email + ". " +
                        "Please upload a session for " + auth.getName() + ".");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(dto);
            }

            Path finalPath = sessionService.getSessionPath(email);
            Files.move(tempPath, finalPath, StandardCopyOption.REPLACE_EXISTING);
            sessionService.invalidateCachedContext(email);
            log.info("Gmail session uploaded for {} ({} bytes)", email, file.getSize());

            GmailSessionStatusDto dto = buildStatus(auth);
            dto.setConnectedEmail(email);
            dto.setMessage("Session uploaded for " + email + ". Gmail is now connected.");
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            try { Files.deleteIfExists(tempPath); } catch (Exception ignored) {}
            log.error("Session upload failed: {}", e.getMessage());
            GmailSessionStatusDto dto = buildStatus(auth);
            dto.setMessage("Upload failed: " + e.getMessage());
            return ResponseEntity.internalServerError().body(dto);
        }
    }

    // ─── Import Cookie Editor JSON ────────────────────────────────────────────

    /**
     * Accepts cookies exported by the "Cookie Editor" Chrome extension (a JSON array)
     * and converts them to Playwright storageState format, then saves per-email.
     */
    @PostMapping("/gmail/import-cookies")
    public ResponseEntity<GmailSessionStatusDto> importCookies(@RequestBody Map<String, String> body,
                                                               Authentication auth) {
        Path tempPath = Paths.get(SESSIONS_DIR, "import-" + System.currentTimeMillis() + ".json");
        try {
            String cookieEditorJson = body.getOrDefault("cookieJson", "");
            String playwrightJson = convertCookieEditorToPlaywright(cookieEditorJson);

            Files.createDirectories(tempPath.getParent());
            Files.writeString(tempPath, playwrightJson);

            String email = sessionService.detectEmailSync(tempPath);
            if (email == null) {
                Files.deleteIfExists(tempPath);
                GmailSessionStatusDto dto = buildStatus(auth);
                dto.setMessage("Could not verify Gmail account from these cookies. " +
                        "Make sure you are logged into Gmail before exporting cookies.");
                return ResponseEntity.badRequest().body(dto);
            }

            if (!isAdmin(auth) && !email.equalsIgnoreCase(auth.getName())) {
                Files.deleteIfExists(tempPath);
                GmailSessionStatusDto dto = buildStatus(auth);
                dto.setMessage("These cookies belong to " + email + ". " +
                        "Please import cookies for " + auth.getName() + ".");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(dto);
            }

            Path finalPath = sessionService.getSessionPath(email);
            Files.move(tempPath, finalPath, StandardCopyOption.REPLACE_EXISTING);
            sessionService.invalidateCachedContext(email);
            log.info("Gmail session imported from Cookie Editor JSON for {}", email);

            GmailSessionStatusDto dto = buildStatus(auth);
            dto.setConnectedEmail(email);
            dto.setMessage("Gmail cookies imported for " + email + ". Gmail is now connected.");
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            try { Files.deleteIfExists(tempPath); } catch (Exception ignored) {}
            log.error("Cookie import failed: {}", e.getMessage());
            GmailSessionStatusDto dto = buildStatus(auth);
            dto.setConnected(false);
            dto.setMessage("Cookie import failed: " + e.getMessage());
            return ResponseEntity.badRequest().body(dto);
        }
    }

    // ─── Gemini API Key ───────────────────────────────────────────────────────

    @GetMapping("/gemini")
    public ResponseEntity<GeminiSettingsDto> getGeminiSettings(Authentication auth) {
        User user = resolveUser(auth);
        return geminiSettingsRepository.findByUser(user)
                .map(s -> {
                    GeminiSettingsDto dto = new GeminiSettingsDto();
                    dto.setConnected(true);
                    String key = s.getApiKey();
                    dto.setMaskedKey(key.length() > 4
                            ? "••••••••" + key.substring(key.length() - 4)
                            : "••••");
                    return ResponseEntity.ok(dto);
                })
                .orElseGet(() -> {
                    GeminiSettingsDto dto = new GeminiSettingsDto();
                    dto.setConnected(false);
                    return ResponseEntity.ok(dto);
                });
    }

    @PostMapping("/gemini/api-key")
    public ResponseEntity<GeminiSettingsDto> saveGeminiApiKey(@RequestBody Map<String, String> body,
                                                              Authentication auth) {
        String apiKey = body.getOrDefault("apiKey", "").trim();
        if (apiKey.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        User user = resolveUser(auth);
        UserGeminiSettings settings = geminiSettingsRepository.findByUser(user)
                .orElse(new UserGeminiSettings());
        settings.setUser(user);
        settings.setApiKey(apiKey);
        settings.setUpdatedAt(LocalDateTime.now());
        geminiSettingsRepository.save(settings);

        GeminiSettingsDto dto = new GeminiSettingsDto();
        dto.setConnected(true);
        dto.setMaskedKey("••••••••" + apiKey.substring(Math.max(0, apiKey.length() - 4)));
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/gemini/api-key")
    public ResponseEntity<Void> deleteGeminiApiKey(Authentication auth) {
        User user = resolveUser(auth);
        geminiSettingsRepository.findByUser(user).ifPresent(geminiSettingsRepository::delete);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/gemini/test")
    public ResponseEntity<Map<String, Object>> testGeminiConnection(Authentication auth) {
        User user = resolveUser(auth);
        return geminiSettingsRepository.findByUser(user)
                .map(s -> {
                    String error = geminiApiService.testConnection(s.getApiKey());
                    Map<String, Object> result = new HashMap<>();
                    result.put("ok", error == null);
                    if (error != null) result.put("error", error);
                    return ResponseEntity.ok(result);
                })
                .orElseGet(() -> ResponseEntity.ok(
                        Map.of("ok", false, "error", "No API key saved. Add your Gemini API key first.")));
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private User resolveUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private List<ConnectedSessionDto> buildSessionList(Authentication auth) {
        List<String> emails = sessionService.listConnectedEmails();
        if (!isAdmin(auth) && auth != null) {
            String me = auth.getName();
            emails = emails.stream().filter(e -> e.equalsIgnoreCase(me)).collect(Collectors.toList());
        }
        return emails.stream().map(email -> {
            ConnectedSessionDto s = new ConnectedSessionDto();
            s.setEmail(email);
            s.setConnectedAt(sessionService.getSessionCreatedAt(email));
            s.setCampaignCount((int) campaignRepository.countByGmailEmail(email));
            return s;
        }).collect(Collectors.toList());
    }

    private GmailSessionStatusDto buildStatus(Authentication auth) {
        GmailSessionStatusDto dto = new GmailSessionStatusDto();
        List<ConnectedSessionDto> sessions = buildSessionList(auth);
        boolean hasSession = !sessions.isEmpty();
        dto.setConnected(hasSession);
        dto.setConnecting(sessionService.isConnecting());
        dto.setConnectError(sessionService.getConnectError());
        dto.setSessionCreatedAt(sessionService.getSessionCreatedAt());
        dto.setConnectedEmail(sessionService.getConnectedEmail());
        dto.setCloudEnvironment(systemDepsInstaller.isCloudFoundry());
        dto.setSessions(sessions);

        if (dto.isConnecting()) {
            dto.setMessage("Browser is open — please log into Gmail. Do not close the browser window.");
        } else if (dto.getConnectError() != null) {
            dto.setMessage("Last attempt failed: " + dto.getConnectError());
        } else if (dto.isConnected()) {
            int count = sessions.size();
            dto.setMessage(count + " Gmail session" + (count > 1 ? "s" : "") + " active.");
        } else {
            dto.setMessage("No Gmail session. Click 'Connect Gmail' or use one of the options below.");
        }
        return dto;
    }

    /**
     * Converts a Cookie Editor JSON array to Playwright storageState format.
     * Also accepts a pre-converted Playwright session object (passed through).
     */
    private String convertCookieEditorToPlaywright(String json) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(json);

        if (root.isObject() && root.has("cookies")) {
            return json; // Already Playwright format
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
}
