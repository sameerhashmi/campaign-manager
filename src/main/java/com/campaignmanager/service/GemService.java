package com.campaignmanager.service;

import com.campaignmanager.dto.GemDto;
import com.campaignmanager.dto.GeneratedEmailDto;
import com.campaignmanager.dto.ProspectContactDto;
import com.campaignmanager.model.CampaignPlanDocument;
import com.campaignmanager.model.Gem;
import com.campaignmanager.model.User;
import com.campaignmanager.model.UserGeminiSettings;
import com.campaignmanager.repository.GemRepository;
import com.campaignmanager.repository.UserGeminiSettingsRepository;
import com.campaignmanager.repository.UserRepository;
import com.campaignmanager.util.EmailScheduleCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GemService {

    private final GemRepository gemRepository;
    private final UserRepository userRepository;
    private final UserGeminiSettingsRepository geminiSettingsRepository;
    private final GeminiApiService geminiApiService;
    private final DocumentTextExtractorService documentTextExtractorService;

    public List<GemDto> findAll(Authentication auth) {
        User owner = resolveGemOwner(auth);
        return gemRepository.findAllByOwner(owner).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<GemDto> findByType(Authentication auth, String gemType) {
        User owner = resolveGemOwner(auth);
        return gemRepository.findAllByOwnerAndGemType(owner, gemType).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public GemDto create(GemDto dto, Authentication auth) {
        User owner = resolveUser(auth);
        Gem gem = new Gem();
        gem.setOwner(owner);
        mapDto(dto, gem);
        return toDto(gemRepository.save(gem));
    }

    public GemDto update(Long id, GemDto dto, Authentication auth) {
        User owner = resolveUser(auth);
        Gem gem = gemRepository.findByIdAndOwner(id, owner)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gem not found"));
        mapDto(dto, gem);
        return toDto(gemRepository.save(gem));
    }

    public void delete(Long id, Authentication auth) {
        User owner = resolveUser(auth);
        Gem gem = gemRepository.findByIdAndOwner(id, owner)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gem not found"));
        gemRepository.delete(gem);
    }

    // ─── Test Gem ─────────────────────────────────────────────────────────────

    public Map<String, Object> testGem(Long id, List<MultipartFile> files, Authentication auth) {
        User owner = resolveUser(auth);
        Gem gem = gemRepository.findByIdAndOwner(id, owner)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gem not found"));

        UserGeminiSettings settings = geminiSettingsRepository.findByUser(owner)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No Gemini API key configured. Go to Settings → Gemini to add your API key."));

        // Convert uploaded files to transient CampaignPlanDocument objects for text extraction
        List<CampaignPlanDocument> docs = new ArrayList<>();
        if (files != null) {
            for (MultipartFile file : files) {
                if (!file.isEmpty()) {
                    try {
                        CampaignPlanDocument doc = new CampaignPlanDocument();
                        doc.setOriginalFileName(file.getOriginalFilename());
                        doc.setMimeType(file.getContentType());
                        doc.setFileContent(file.getBytes());
                        docs.add(doc);
                    } catch (Exception ignored) {}
                }
            }
        }
        String corpus = documentTextExtractorService.extractAll(docs);

        Map<String, Object> result = new HashMap<>();
        result.put("type", gem.getGemType());

        if ("CONTACT_RESEARCH".equals(gem.getGemType())) {
            List<ProspectContactDto> contacts = geminiApiService.generateContactListChunked(
                    settings.getApiKey(), settings.getModel(), gem.getSystemInstructions(), corpus);
            result.put("contacts", contacts);
        } else {
            // EMAIL_GENERATION — use a generic test contact
            ProspectContactDto testContact = new ProspectContactDto();
            testContact.setName("Alex Johnson");
            testContact.setTitle("VP of Platform Engineering");
            testContact.setEmail("alex.johnson@testcompany.com");
            testContact.setRoleType("Technical");
            testContact.setTeamDomain("Platform Engineering");
            testContact.setTechnicalStrengths("Kubernetes, cloud-native, CI/CD");
            testContact.setSenioritySignal("VP-level");
            testContact.setInfluenceIndicators("Decision maker, budget authority");
            testContact.setTanzuRelevance("High");
            testContact.setTanzuTeam("Tanzu Platform");

            List<LocalDateTime> schedule = EmailScheduleCalculator.calculateSchedule(LocalDate.now());
            List<GeneratedEmailDto> emails = geminiApiService.generateEmails(
                    settings.getApiKey(), settings.getModel(), gem.getSystemInstructions(),
                    testContact, schedule, corpus);
            result.put("emails", emails);
        }
        return result;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    public GemDto toDto(Gem gem) {
        GemDto dto = new GemDto();
        dto.setId(gem.getId());
        dto.setName(gem.getName());
        dto.setDescription(gem.getDescription());
        dto.setSystemInstructions(gem.getSystemInstructions());
        dto.setGemType(gem.getGemType());
        return dto;
    }

    private void mapDto(GemDto dto, Gem gem) {
        gem.setName(dto.getName());
        gem.setDescription(dto.getDescription());
        gem.setSystemInstructions(dto.getSystemInstructions());
        gem.setGemType(dto.getGemType());
    }

    private User resolveUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    /** For reads, non-admin users see admin's gems. */
    private User resolveGemOwner(Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (isAdmin) return resolveUser(auth);
        return userRepository.findByUsername("admin")
                .orElseGet(() -> resolveUser(auth));
    }
}
