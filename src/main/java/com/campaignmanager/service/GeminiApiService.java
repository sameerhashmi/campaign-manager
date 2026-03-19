package com.campaignmanager.service;

import com.campaignmanager.dto.GeneratedEmailDto;
import com.campaignmanager.dto.ProspectContactDto;
import com.campaignmanager.util.EmailScheduleCalculator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Calls the Google Gemini REST API to generate prospect contacts and email sequences.
 * Uses RestTemplate + Jackson for full control over the JSON payload.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiApiService {

    private static final String GEMINI_BASE =
        "https://generativelanguage.googleapis.com/v1beta/models/";

    private static final String MODELS_URL =
        "https://generativelanguage.googleapis.com/v1beta/models?key=";

    @Value("${gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Lists all models available for this API key that support generateContent.
     * Returns model IDs (e.g. "gemini-1.5-flash") sorted alphabetically.
     */
    public List<String> listModels(String apiKey) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(
                MODELS_URL + apiKey, HttpMethod.GET, entity, String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            List<String> result = new ArrayList<>();
            for (JsonNode model : root.path("models")) {
                boolean supportsGenerate = false;
                for (JsonNode method : model.path("supportedGenerationMethods")) {
                    if ("generateContent".equals(method.asText())) { supportsGenerate = true; break; }
                }
                if (supportsGenerate) {
                    String name = model.path("name").asText(""); // "models/gemini-1.5-flash"
                    result.add(name.startsWith("models/") ? name.substring(7) : name);
                }
            }
            result.sort(String::compareTo);
            return result;
        } catch (Exception e) {
            log.warn("Failed to list Gemini models: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * Tests the API key + model. Returns null on success, or an error message string on failure.
     * If model is null, uses the configured default.
     */
    public String testConnection(String apiKey, String model) {
        try {
            call(apiKey, model, buildRequest("Say hello", null));
            return null;
        } catch (Exception e) {
            log.warn("Gemini test connection failed: {}", e.getMessage());
            return e.getMessage();
        }
    }

    /**
     * Runs the Contact Research Gem against the given Drive folder URL.
     */
    public List<ProspectContactDto> generateContactList(String apiKey, String model,
                                                        String systemInstructions,
                                                        String driveFolderUrl) {
        String prompt = buildContactResearchPrompt(driveFolderUrl);
        String rawResponse = call(apiKey, model, buildRequest(prompt, systemInstructions));
        return parseContactList(rawResponse);
    }

    /**
     * Runs the Email Generation Gem for a single prospect contact.
     */
    public List<GeneratedEmailDto> generateEmails(String apiKey, String model,
                                                  String systemInstructions,
                                                  ProspectContactDto contact,
                                                  List<LocalDateTime> schedule) {
        String prompt = buildEmailGenerationPrompt(contact, schedule);
        String rawResponse = call(apiKey, model, buildRequest(prompt, systemInstructions));
        return parseEmailList(rawResponse, schedule);
    }

    // ─── Request Builders ─────────────────────────────────────────────────────

    private String buildRequest(String userPrompt, String systemInstructions) {
        try {
            Map<String, Object> userPart = Map.of("text", userPrompt);
            Map<String, Object> userContent = Map.of("role", "user", "parts", List.of(userPart));

            Map<String, Object> payload;
            if (systemInstructions != null && !systemInstructions.isBlank()) {
                Map<String, Object> sysPart = Map.of("text", systemInstructions);
                Map<String, Object> systemInstruction = Map.of("parts", List.of(sysPart));
                payload = Map.of(
                    "systemInstruction", systemInstruction,
                    "contents", List.of(userContent),
                    "generationConfig", Map.of("temperature", 0.2, "maxOutputTokens", 8192)
                );
            } else {
                payload = Map.of(
                    "contents", List.of(userContent),
                    "generationConfig", Map.of("temperature", 0.2, "maxOutputTokens", 8192)
                );
            }
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to build Gemini request", e);
        }
    }

    private String buildContactResearchPrompt(String driveFolderUrl) {
        return """
            Analyze all documents in the Google Drive folder at this URL: %s

            Extract a comprehensive list of all people (prospects/contacts) mentioned in these documents.
            Focus on customer-side stakeholders relevant to a Tanzu/VMware sales engagement.

            Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
            [
              {
                "name": "Full Name",
                "title": "Job Title",
                "email": "email@company.com or empty string if unknown",
                "roleType": "Technical | Executive | Business | Champion | Gatekeeper",
                "teamDomain": "e.g. Platform Engineering, DevOps, IT",
                "technicalStrengths": "Key technical skills or areas of expertise",
                "senioritySignal": "e.g. VP-level, Director, Senior IC, Junior",
                "influenceIndicators": "Budget authority, decision maker, influencer, end user",
                "source": "Document name or type where this person was mentioned",
                "tanzuRelevance": "High | Medium | Low",
                "tanzuTeam": "e.g. Tanzu Platform, Tanzu Application Catalog, etc. or empty"
              }
            ]

            Include all people mentioned across all documents. If a field is unknown, use an empty string.
            """.formatted(driveFolderUrl);
    }

    private String buildEmailGenerationPrompt(ProspectContactDto contact, List<LocalDateTime> schedule) {
        return """
            Generate a sequence of 7 personalized sales emails for the following prospect.

            Prospect Profile:
            - Name: %s
            - Title: %s
            - Email: %s
            - Role Type: %s
            - Team/Domain: %s
            - Technical Strengths: %s
            - Seniority Signal: %s
            - Influence Indicators: %s
            - Tanzu Relevance: %s
            - Tanzu Team: %s

            Email schedule (use these as context for timing references in emails):
            Email 1: %s
            Email 2: %s
            Email 3: %s
            Email 4: %s
            Email 5: %s
            Email 6: %s
            Email 7: %s

            Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
            [
              {
                "stepNumber": 1,
                "subject": "Email subject line",
                "body": "Full email body text (plain text, no HTML)"
              }
            ]

            Generate all 7 emails. Each email should build on the previous. Be concise and personalized.
            """.formatted(
                nvl(contact.getName()),
                nvl(contact.getTitle()),
                nvl(contact.getEmail()),
                nvl(contact.getRoleType()),
                nvl(contact.getTeamDomain()),
                nvl(contact.getTechnicalStrengths()),
                nvl(contact.getSenioritySignal()),
                nvl(contact.getInfluenceIndicators()),
                nvl(contact.getTanzuRelevance()),
                nvl(contact.getTanzuTeam()),
                schedule.size() > 0 ? schedule.get(0).toString() : "",
                schedule.size() > 1 ? schedule.get(1).toString() : "",
                schedule.size() > 2 ? schedule.get(2).toString() : "",
                schedule.size() > 3 ? schedule.get(3).toString() : "",
                schedule.size() > 4 ? schedule.get(4).toString() : "",
                schedule.size() > 5 ? schedule.get(5).toString() : "",
                schedule.size() > 6 ? schedule.get(6).toString() : ""
            );
    }

    // ─── HTTP Call ────────────────────────────────────────────────────────────

    private String call(String apiKey, String model, String requestBody) {
        String resolvedModel = (model != null && !model.isBlank()) ? model : geminiModel;
        String url = GEMINI_BASE + resolvedModel + ":generateContent?key=" + apiKey;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> entity = new HttpEntity<>(requestBody, headers);
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST, entity, String.class);
            if (response.getBody() == null) {
                throw new RuntimeException("Gemini returned an empty response");
            }
            return extractText(response.getBody());
        } catch (HttpClientErrorException e) {
            // Extract the actual error message from Gemini's JSON error body
            String raw = e.getResponseBodyAsString();
            try {
                JsonNode err = objectMapper.readTree(raw);
                String msg = err.path("error").path("message").asText(null);
                if (msg != null && !msg.isBlank()) {
                    throw new RuntimeException(msg);
                }
            } catch (RuntimeException re) {
                throw re;
            } catch (Exception ignored) {}
            throw new RuntimeException("Gemini API error " + e.getStatusCode().value() + ": " + raw);
        }
    }

    private String extractText(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            return root.path("candidates").get(0)
                       .path("content").path("parts").get(0)
                       .path("text").asText();
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Gemini response: " + e.getMessage(), e);
        }
    }

    // ─── Response Parsers ─────────────────────────────────────────────────────

    private List<ProspectContactDto> parseContactList(String text) {
        try {
            String json = extractJson(text);
            JsonNode array = objectMapper.readTree(json);
            List<ProspectContactDto> result = new ArrayList<>();
            for (JsonNode node : array) {
                ProspectContactDto dto = new ProspectContactDto();
                dto.setName(node.path("name").asText(""));
                dto.setTitle(node.path("title").asText(""));
                dto.setEmail(node.path("email").asText(""));
                dto.setRoleType(node.path("roleType").asText(""));
                dto.setTeamDomain(node.path("teamDomain").asText(""));
                dto.setTechnicalStrengths(node.path("technicalStrengths").asText(""));
                dto.setSenioritySignal(node.path("senioritySignal").asText(""));
                dto.setInfluenceIndicators(node.path("influenceIndicators").asText(""));
                dto.setSource(node.path("source").asText(""));
                dto.setTanzuRelevance(node.path("tanzuRelevance").asText(""));
                dto.setTanzuTeam(node.path("tanzuTeam").asText(""));
                dto.setSelected(false);
                result.add(dto);
            }
            return result;
        } catch (Exception e) {
            log.error("Failed to parse contact list from Gemini: {}", text, e);
            throw new RuntimeException("Gemini returned an unexpected format for contacts. Please check your Gem instructions.", e);
        }
    }

    private List<GeneratedEmailDto> parseEmailList(String text, List<LocalDateTime> schedule) {
        try {
            String json = extractJson(text);
            JsonNode array = objectMapper.readTree(json);
            List<GeneratedEmailDto> result = new ArrayList<>();
            for (JsonNode node : array) {
                GeneratedEmailDto dto = new GeneratedEmailDto();
                int step = node.path("stepNumber").asInt(result.size() + 1);
                dto.setStepNumber(step);
                dto.setSubject(node.path("subject").asText(""));
                dto.setBody(node.path("body").asText(""));
                if (step >= 1 && step <= schedule.size()) {
                    dto.setScheduledAt(schedule.get(step - 1));
                }
                result.add(dto);
            }
            return result;
        } catch (Exception e) {
            log.error("Failed to parse email list from Gemini: {}", text, e);
            throw new RuntimeException("Gemini returned an unexpected format for emails. Please check your Gem instructions.", e);
        }
    }

    /** Strips markdown code fences if Gemini wraps JSON in ```json ... ``` */
    private String extractJson(String text) {
        String trimmed = text.trim();
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('\n') + 1;
            int end = trimmed.lastIndexOf("```");
            if (end > start) {
                return trimmed.substring(start, end).trim();
            }
        }
        return trimmed;
    }

    private String nvl(String s) {
        return s == null ? "" : s;
    }
}
