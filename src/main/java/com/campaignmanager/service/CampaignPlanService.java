package com.campaignmanager.service;

import com.campaignmanager.dto.*;
import com.campaignmanager.model.*;
import com.campaignmanager.repository.*;
import com.campaignmanager.util.EmailScheduleCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CampaignPlanService {

    private final CampaignPlanRepository planRepository;
    private final GemRepository gemRepository;
    private final ProspectContactRepository prospectContactRepository;
    private final GeneratedEmailRepository generatedEmailRepository;
    private final UserGeminiSettingsRepository geminiSettingsRepository;
    private final UserRepository userRepository;
    private final CampaignRepository campaignRepository;
    private final EmailTemplateRepository templateRepository;
    private final CampaignContactRepository campaignContactRepository;
    private final EmailJobRepository emailJobRepository;
    private final ContactService contactService;
    private final GeminiApiService geminiApiService;

    private static final DateTimeFormatter DISPLAY_FMT =
            DateTimeFormatter.ofPattern("EEE, MMM d, yyyy");

    // ─── List ─────────────────────────────────────────────────────────────────

    public List<CampaignPlanDto> findAll(Authentication auth) {
        User owner = resolveUser(auth);
        return planRepository.findAllByOwnerOrderByCreatedAtDesc(owner).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    // ─── Get by ID ────────────────────────────────────────────────────────────

    public CampaignPlanDto findById(Long id, Authentication auth) {
        return toDto(resolvePlan(id, auth));
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    @Transactional
    public CampaignPlanDto create(CampaignPlanDto dto, Authentication auth) {
        User owner = resolveUser(auth);
        CampaignPlan plan = new CampaignPlan();
        plan.setOwner(owner);
        mapDto(dto, plan, owner);
        plan.setStatus("DRAFT");
        return toDto(planRepository.save(plan));
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    @Transactional
    public CampaignPlanDto update(Long id, CampaignPlanDto dto, Authentication auth) {
        User owner = resolveUser(auth);
        CampaignPlan plan = resolvePlan(id, auth);
        mapDto(dto, plan, owner);
        return toDto(planRepository.save(plan));
    }

    // ─── Generate Contacts ────────────────────────────────────────────────────

    @Transactional
    public List<ProspectContactDto> generateContacts(Long planId, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        String apiKey = requireApiKey(auth);

        if (plan.getContactGem() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No Contact Research Gem selected. Update the plan and choose a Gem.");
        }
        if (plan.getDriveFolderUrl() == null || plan.getDriveFolderUrl().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No Google Drive folder URL provided.");
        }

        // Clear previous results
        prospectContactRepository.deleteAllByCampaignPlan(plan);

        List<ProspectContactDto> generated = geminiApiService.generateContactList(
                apiKey,
                plan.getContactGem().getSystemInstructions(),
                plan.getDriveFolderUrl());

        List<ProspectContact> saved = generated.stream().map(dto -> {
            ProspectContact pc = new ProspectContact();
            pc.setCampaignPlan(plan);
            mapProspectDto(dto, pc);
            return prospectContactRepository.save(pc);
        }).collect(Collectors.toList());

        plan.setStatus("CONTACTS_READY");
        planRepository.save(plan);

        return saved.stream().map(this::toProspectDto).collect(Collectors.toList());
    }

    // ─── Update Single Contact ────────────────────────────────────────────────

    @Transactional
    public ProspectContactDto updateContact(Long planId, Long contactId,
                                            ProspectContactDto dto, Authentication auth) {
        resolvePlan(planId, auth); // verify ownership
        ProspectContact pc = prospectContactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found"));
        mapProspectDto(dto, pc);
        return toProspectDto(prospectContactRepository.save(pc));
    }

    // ─── Generate Emails ─────────────────────────────────────────────────────

    @Transactional
    public Map<Long, List<GeneratedEmailDto>> generateEmails(Long planId,
                                                             List<Long> selectedContactIds,
                                                             Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        String apiKey = requireApiKey(auth);

        if (plan.getEmailGem() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No Email Generation Gem selected.");
        }

        // Mark selected contacts
        List<ProspectContact> contacts = prospectContactRepository.findAllByCampaignPlanOrderByName(plan);
        for (ProspectContact pc : contacts) {
            boolean selected = selectedContactIds.contains(pc.getId());
            pc.setSelected(selected);
            prospectContactRepository.save(pc);
        }

        List<LocalDateTime> schedule = EmailScheduleCalculator.calculateSchedule(LocalDate.now());
        Map<Long, List<GeneratedEmailDto>> result = new LinkedHashMap<>();

        for (ProspectContact pc : contacts) {
            if (!selectedContactIds.contains(pc.getId())) continue;

            // Clear old emails for this contact
            generatedEmailRepository.deleteAllByProspectContact(pc);

            ProspectContactDto contactDto = toProspectDto(pc);
            List<GeneratedEmailDto> emails = geminiApiService.generateEmails(
                    apiKey,
                    plan.getEmailGem().getSystemInstructions(),
                    contactDto,
                    schedule);

            List<GeneratedEmail> saved = emails.stream().map(dto -> {
                GeneratedEmail ge = new GeneratedEmail();
                ge.setProspectContact(pc);
                ge.setStepNumber(dto.getStepNumber());
                ge.setSubject(dto.getSubject());
                ge.setBody(dto.getBody());
                ge.setScheduledAt(dto.getScheduledAt() != null ? dto.getScheduledAt()
                        : (dto.getStepNumber() <= schedule.size() ? schedule.get(dto.getStepNumber() - 1) : null));
                return generatedEmailRepository.save(ge);
            }).collect(Collectors.toList());

            result.put(pc.getId(), saved.stream().map(this::toEmailDto).collect(Collectors.toList()));
        }

        plan.setStatus("EMAILS_READY");
        planRepository.save(plan);

        return result;
    }

    // ─── Update Single Email ──────────────────────────────────────────────────

    @Transactional
    public GeneratedEmailDto updateEmail(Long planId, Long emailId,
                                         GeneratedEmailDto dto, Authentication auth) {
        resolvePlan(planId, auth);
        GeneratedEmail ge = generatedEmailRepository.findById(emailId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Email not found"));
        ge.setSubject(dto.getSubject());
        ge.setBody(dto.getBody());
        if (dto.getScheduledAt() != null) {
            ge.setScheduledAt(dto.getScheduledAt());
        }
        return toEmailDto(generatedEmailRepository.save(ge));
    }

    // ─── Summary ─────────────────────────────────────────────────────────────

    public CampaignPlanSummaryDto getSummary(Long planId, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        List<ProspectContact> selected = prospectContactRepository.findAllByCampaignPlanAndSelectedTrue(plan);

        CampaignPlanSummaryDto dto = new CampaignPlanSummaryDto();
        dto.setCampaignName(plan.getName());
        dto.setCustomer(plan.getCustomer());
        dto.setTanzuContact(plan.getTanzuContact());
        dto.setContactGemName(plan.getContactGem() != null ? plan.getContactGem().getName() : "—");
        dto.setEmailGemName(plan.getEmailGem() != null ? plan.getEmailGem().getName() : "—");
        dto.setContactCount(selected.size());
        dto.setEmailCount(selected.size() * 7);

        // Determine schedule range from generated emails
        List<LocalDateTime> allDates = selected.stream()
                .flatMap(pc -> generatedEmailRepository
                        .findAllByProspectContactOrderByStepNumber(pc).stream())
                .map(GeneratedEmail::getScheduledAt)
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());

        if (!allDates.isEmpty()) {
            dto.setScheduleStart(allDates.get(0).toLocalDate().format(DISPLAY_FMT));
            dto.setScheduleEnd(allDates.get(allDates.size() - 1).toLocalDate().format(DISPLAY_FMT));
        }

        return dto;
    }

    // ─── Convert to Live Campaign ─────────────────────────────────────────────

    @Transactional
    public CampaignDto convertToCampaign(Long planId, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);

        if (plan.getResultCampaign() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This plan has already been converted to a campaign.");
        }

        User owner = resolveUser(auth);

        // 1. Create the Campaign (v1)
        Campaign campaign = new Campaign();
        campaign.setName(plan.getName());
        campaign.setCompany(plan.getCustomer());
        campaign.setTanzuContact(plan.getTanzuContact());
        campaign.setOwner(owner);
        campaign.setStatus(CampaignStatus.DRAFT);
        campaign = campaignRepository.save(campaign);

        // 2. Collect schedule from first selected contact's emails (shared across all contacts)
        List<ProspectContact> selected = prospectContactRepository.findAllByCampaignPlanAndSelectedTrue(plan);
        if (selected.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No contacts selected. Go back and select at least one contact.");
        }

        // Use schedule from first contact's emails as the template schedule
        List<GeneratedEmail> firstEmails = generatedEmailRepository
                .findAllByProspectContactOrderByStepNumber(selected.get(0));

        // 3. Create EmailTemplates from first contact's emails (subject/body as template)
        List<EmailTemplate> templates = new ArrayList<>();
        for (GeneratedEmail ge : firstEmails) {
            EmailTemplate t = new EmailTemplate();
            t.setCampaign(campaign);
            t.setStepNumber(ge.getStepNumber());
            t.setSubject(ge.getSubject());
            t.setBodyTemplate(ge.getBody());
            t.setScheduledAt(ge.getScheduledAt());
            templates.add(templateRepository.save(t));
        }

        // 4. For each selected contact: upsert Contact + create CampaignContact + EmailJobs
        for (ProspectContact pc : selected) {
            ContactDto contactDto = new ContactDto();
            contactDto.setName(pc.getName());
            contactDto.setEmail(pc.getEmail() != null ? pc.getEmail() : "");
            contactDto.setRole(pc.getTitle());
            contactDto.setCompany(plan.getCustomer());
            contactDto.setCategory(pc.getRoleType());

            Contact contact = contactService.upsertByEmail(contactDto, owner);

            if (!campaignContactRepository.existsByCampaignIdAndContactId(campaign.getId(), contact.getId())) {
                CampaignContact cc = new CampaignContact();
                cc.setCampaign(campaign);
                cc.setContact(contact);
                cc.setEnrolledAt(LocalDateTime.now());
                cc = campaignContactRepository.save(cc);

                // Create EmailJobs from this contact's generated emails
                List<GeneratedEmail> contactEmails = generatedEmailRepository
                        .findAllByProspectContactOrderByStepNumber(pc);

                for (GeneratedEmail ge : contactEmails) {
                    EmailJob job = new EmailJob();
                    job.setCampaignContact(cc);
                    job.setStepNumber(ge.getStepNumber());
                    job.setSubject(ge.getSubject());
                    job.setBody(ge.getBody());
                    job.setScheduledAt(ge.getScheduledAt() != null ? ge.getScheduledAt() : LocalDateTime.now().plusDays(1));
                    job.setStatus(EmailJobStatus.SCHEDULED);
                    emailJobRepository.save(job);
                }
            }
        }

        // 5. Mark plan as COMPLETED with reference to the created campaign
        plan.setResultCampaign(campaign);
        plan.setStatus("COMPLETED");
        planRepository.save(plan);

        CampaignDto dto = new CampaignDto();
        dto.setId(campaign.getId());
        dto.setName(campaign.getName());
        dto.setStatus(campaign.getStatus());
        return dto;
    }

    // ─── Contacts & Emails for a Plan ─────────────────────────────────────────

    public List<ProspectContactDto> getContacts(Long planId, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        return prospectContactRepository.findAllByCampaignPlanOrderByName(plan).stream()
                .map(this::toProspectDto)
                .collect(Collectors.toList());
    }

    public List<GeneratedEmailDto> getEmailsForContact(Long planId, Long contactId, Authentication auth) {
        resolvePlan(planId, auth);
        ProspectContact pc = prospectContactRepository.findById(contactId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact not found"));
        return generatedEmailRepository.findAllByProspectContactOrderByStepNumber(pc).stream()
                .map(this::toEmailDto)
                .collect(Collectors.toList());
    }

    // ─── DTO Mappers ──────────────────────────────────────────────────────────

    public CampaignPlanDto toDto(CampaignPlan plan) {
        CampaignPlanDto dto = new CampaignPlanDto();
        dto.setId(plan.getId());
        dto.setName(plan.getName());
        dto.setCustomer(plan.getCustomer());
        dto.setTanzuContact(plan.getTanzuContact());
        dto.setDriveFolderUrl(plan.getDriveFolderUrl());
        dto.setStatus(plan.getStatus());
        dto.setCreatedAt(plan.getCreatedAt());
        if (plan.getContactGem() != null) {
            dto.setContactGemId(plan.getContactGem().getId());
            dto.setContactGemName(plan.getContactGem().getName());
        }
        if (plan.getEmailGem() != null) {
            dto.setEmailGemId(plan.getEmailGem().getId());
            dto.setEmailGemName(plan.getEmailGem().getName());
        }
        if (plan.getResultCampaign() != null) {
            dto.setResultCampaignId(plan.getResultCampaign().getId());
        }
        return dto;
    }

    public ProspectContactDto toProspectDto(ProspectContact pc) {
        ProspectContactDto dto = new ProspectContactDto();
        dto.setId(pc.getId());
        dto.setCampaignPlanId(pc.getCampaignPlan().getId());
        dto.setName(pc.getName());
        dto.setTitle(pc.getTitle());
        dto.setEmail(pc.getEmail());
        dto.setRoleType(pc.getRoleType());
        dto.setTeamDomain(pc.getTeamDomain());
        dto.setTechnicalStrengths(pc.getTechnicalStrengths());
        dto.setSenioritySignal(pc.getSenioritySignal());
        dto.setInfluenceIndicators(pc.getInfluenceIndicators());
        dto.setSource(pc.getSource());
        dto.setTanzuRelevance(pc.getTanzuRelevance());
        dto.setTanzuTeam(pc.getTanzuTeam());
        dto.setSelected(pc.getSelected());
        dto.setGeneratedEmailCount(pc.getGeneratedEmails() != null ? pc.getGeneratedEmails().size() : 0);
        return dto;
    }

    public GeneratedEmailDto toEmailDto(GeneratedEmail ge) {
        GeneratedEmailDto dto = new GeneratedEmailDto();
        dto.setId(ge.getId());
        dto.setProspectContactId(ge.getProspectContact().getId());
        dto.setStepNumber(ge.getStepNumber());
        dto.setSubject(ge.getSubject());
        dto.setBody(ge.getBody());
        dto.setScheduledAt(ge.getScheduledAt());
        return dto;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private void mapDto(CampaignPlanDto dto, CampaignPlan plan, User owner) {
        plan.setName(dto.getName());
        plan.setCustomer(dto.getCustomer());
        plan.setTanzuContact(dto.getTanzuContact());
        plan.setDriveFolderUrl(dto.getDriveFolderUrl());
        if (dto.getContactGemId() != null) {
            gemRepository.findByIdAndOwner(dto.getContactGemId(), owner)
                    .ifPresent(plan::setContactGem);
        }
        if (dto.getEmailGemId() != null) {
            gemRepository.findByIdAndOwner(dto.getEmailGemId(), owner)
                    .ifPresent(plan::setEmailGem);
        }
    }

    private void mapProspectDto(ProspectContactDto dto, ProspectContact pc) {
        if (dto.getName() != null) pc.setName(dto.getName());
        pc.setTitle(dto.getTitle());
        pc.setEmail(dto.getEmail());
        pc.setRoleType(dto.getRoleType());
        pc.setTeamDomain(dto.getTeamDomain());
        pc.setTechnicalStrengths(dto.getTechnicalStrengths());
        pc.setSenioritySignal(dto.getSenioritySignal());
        pc.setInfluenceIndicators(dto.getInfluenceIndicators());
        pc.setSource(dto.getSource());
        pc.setTanzuRelevance(dto.getTanzuRelevance());
        pc.setTanzuTeam(dto.getTanzuTeam());
        if (dto.getSelected() != null) pc.setSelected(dto.getSelected());
    }

    private CampaignPlan resolvePlan(Long id, Authentication auth) {
        User owner = resolveUser(auth);
        // Admin can access any plan; regular user only their own
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (isAdmin) {
            return planRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign plan not found"));
        }
        return planRepository.findByIdAndOwner(id, owner)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign plan not found"));
    }

    private User resolveUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private String requireApiKey(Authentication auth) {
        User user = resolveUser(auth);
        return geminiSettingsRepository.findByUser(user)
                .map(UserGeminiSettings::getApiKey)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No Gemini API key configured. Go to Settings → Gemini to add your API key."));
    }
}
