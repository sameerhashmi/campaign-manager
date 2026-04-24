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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
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
    private final CampaignPlanDocumentRepository documentRepository;
    private final DocumentTextExtractorService documentTextExtractorService;
    private final GoogleDriveImportService googleDriveImportService;
    private final ExcelImportService excelImportService;
    private final EmailGenerationAsyncWorker emailWorker;

    private final ConcurrentHashMap<Long, String> emailErrors = new ConcurrentHashMap<>();

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

    // ─── Delete Plan ──────────────────────────────────────────────────────────

    @Transactional
    public void delete(Long planId, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        prospectContactRepository.deleteAllByCampaignPlan(plan);
        planRepository.delete(plan);
    }

    // ─── Generate Contacts ────────────────────────────────────────────────────

    @Transactional
    public List<ProspectContactDto> generateContacts(Long planId, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        UserGeminiSettings geminiSettings = requireGeminiSettings(auth);

        if (plan.getContactGem() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No Contact Research Gem selected. Update the plan and choose a Gem.");
        }

        List<CampaignPlanDocument> docs = documentRepository.findAllByCampaignPlan(plan);
        if (docs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No documents uploaded. Please upload at least one briefing document before generating contacts.");
        }

        String corpus = documentTextExtractorService.extractAll(docs);

        // Clear previous results
        prospectContactRepository.deleteAllByCampaignPlan(plan);

        List<ProspectContactDto> generated = geminiApiService.generateContactListChunked(
                geminiSettings.getApiKey(),
                geminiSettings.getModel(),
                plan.getContactGem().getSystemInstructions(),
                corpus);

        // Apply email format to contacts that have no email
        String emailFormat = plan.getEmailFormat();
        if (emailFormat != null && !emailFormat.isBlank()) {
            generated.forEach(dto -> {
                if (dto.getEmail() == null || dto.getEmail().isBlank()) {
                    dto.setEmail(applyEmailFormat(emailFormat, dto.getName()));
                }
            });
        }

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

    // ─── Generate Emails (async) ──────────────────────────────────────────────

    @Transactional
    public void startEmailGeneration(Long planId, List<Long> selectedContactIds, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        UserGeminiSettings geminiSettings = requireGeminiSettings(auth);

        if (plan.getEmailGem() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No Email Generation Gem selected.");
        }

        // Mark selected contacts and clear old emails — all synchronous before we return
        List<ProspectContact> allContacts = prospectContactRepository.findAllByCampaignPlanOrderByName(plan);
        List<ProspectContact> selected = new ArrayList<>();
        for (ProspectContact pc : allContacts) {
            boolean sel = selectedContactIds.contains(pc.getId());
            pc.setSelected(sel);
            prospectContactRepository.save(pc);
            if (sel) {
                generatedEmailRepository.deleteAllByProspectContact(pc);
                selected.add(pc);
            }
        }

        // Apply email format to any selected contact still missing an email
        String emailFormat = plan.getEmailFormat();
        if (emailFormat != null && !emailFormat.isBlank()) {
            selected.forEach(pc -> {
                if (pc.getEmail() == null || pc.getEmail().isBlank()) {
                    pc.setEmail(applyEmailFormat(emailFormat, pc.getName()));
                    prospectContactRepository.save(pc);
                }
            });
        }

        // Snapshot all data needed by the async thread (no JPA proxies, no SecurityContext)
        List<ProspectContactDto> contactDtos = selected.stream().map(this::toProspectDto).collect(Collectors.toList());
        List<Long> contactIds = selected.stream().map(ProspectContact::getId).collect(Collectors.toList());
        List<LocalDateTime> schedule = EmailScheduleCalculator.calculateSchedule(LocalDate.now());
        List<CampaignPlanDocument> docs = documentRepository.findAllByCampaignPlan(plan);
        String corpus = documentTextExtractorService.extractAll(docs);
        String apiKey = geminiSettings.getApiKey();
        String model = geminiSettings.getModel();
        String systemInstructions = plan.getEmailGem().getSystemInstructions();
        String senderName = deriveNameFromEmail(plan.getGmailEmail());

        // Set processing status and clear any previous error
        emailErrors.remove(planId);
        plan.setStatus("GENERATING_EMAILS");
        planRepository.save(plan);

        // Fire and forget — the worker runs in a Spring-managed async thread
        emailWorker.process(planId, contactDtos, contactIds, apiKey, model,
                systemInstructions, corpus, schedule, senderName, emailErrors);

        log.info("Email generation started async for plan {} ({} contacts)", planId, selected.size());
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
        campaign.setGmailEmail(plan.getGmailEmail());
        campaign.setOwner(owner);
        campaign.setStatus(CampaignStatus.DRAFT);
        campaign = campaignRepository.save(campaign);

        // 2. Collect schedule from first selected contact's emails (shared across all contacts)
        List<ProspectContact> selected = prospectContactRepository.findAllByCampaignPlanAndSelectedTrue(plan);
        // Only include contacts that actually have generated emails
        selected = selected.stream()
                .filter(pc -> !generatedEmailRepository.findAllByProspectContactOrderByStepNumber(pc).isEmpty())
                .collect(Collectors.toList());
        if (selected.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No contacts selected with generated emails. Generate emails for at least one contact first.");
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
        dto.setGmailEmail(plan.getGmailEmail());
        dto.setEmailFormat(plan.getEmailFormat());
        dto.setStatus(plan.getStatus());
        dto.setEmailError(emailErrors.get(plan.getId()));
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
        plan.setGmailEmail(dto.getGmailEmail());
        plan.setEmailFormat(dto.getEmailFormat());
        if (dto.getContactGemId() != null) {
            resolveGem(dto.getContactGemId(), owner).ifPresent(plan::setContactGem);
        }
        if (dto.getEmailGemId() != null) {
            resolveGem(dto.getEmailGemId(), owner).ifPresent(plan::setEmailGem);
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

    private UserGeminiSettings requireGeminiSettings(Authentication auth) {
        User user = resolveUser(auth);
        // Try the current user's settings first; fall back to admin's settings
        return geminiSettingsRepository.findByUser(user)
                .or(() -> userRepository.findByUsername("admin")
                        .flatMap(geminiSettingsRepository::findByUser))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "No Gemini API key configured. An admin must add a Gemini API key in Settings."));
    }

    private String requireApiKey(Authentication auth) {
        return requireGeminiSettings(auth).getApiKey();
    }

    /** Find gem by owner; if not found, fall back to admin's gem with that id. */
    private java.util.Optional<com.campaignmanager.model.Gem> resolveGem(Long gemId, User owner) {
        return gemRepository.findByIdAndOwner(gemId, owner)
                .or(() -> userRepository.findByUsername("admin")
                        .flatMap(admin -> gemRepository.findByIdAndOwner(gemId, admin)));
    }

    /**
     * Derives an email address from a full name and a format string.
     * Supported tokens: firstname, lastname, flastname, f.lastname
     * Examples:
     *   "firstname.lastname@broadcom.com" + "John Smith" → "john.smith@broadcom.com"
     *   "flastname@broadcom.com"          + "John Smith" → "jsmith@broadcom.com"
     *   "f.lastname@broadcom.com"         + "John Smith" → "j.smith@broadcom.com"
     */
    private String applyEmailFormat(String format, String fullName) {
        if (format == null || format.isBlank() || fullName == null || fullName.isBlank()) return "";
        String[] parts = fullName.trim().split("\\s+", 2);
        String first = parts[0].toLowerCase().replaceAll("[^a-z0-9]", "");
        String last = parts.length > 1 ? parts[1].toLowerCase().replaceAll("[^a-z0-9]", "") : "";
        String fi = first.isEmpty() ? "" : String.valueOf(first.charAt(0));

        int atIdx = format.indexOf('@');
        String local = (atIdx > 0 ? format.substring(0, atIdx) : format).toLowerCase();
        String domain = atIdx > 0 ? format.substring(atIdx) : "@company.com";

        // Handle "f" + separator + "lastname" token before replacing lastname (e.g., "f.lastname")
        if (!fi.isEmpty() && !last.isEmpty()) {
            local = local.replace("f.lastname", fi + "." + last)
                         .replace("flastname", fi + last);
        }
        // Replace remaining full-name tokens
        local = local.replace("firstname", first).replace("lastname", last);

        return local + domain;
    }

    /**
     * Derives a display name from a Gmail address.
     * e.g. "john.smith@broadcom.com" → "John Smith"
     *      "jsmith@broadcom.com"     → "Jsmith"
     */
    private String deriveNameFromEmail(String email) {
        if (email == null || email.isBlank()) return "";
        String local = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
        String[] parts = local.split("[._\\-]");
        StringBuilder name = new StringBuilder();
        for (String part : parts) {
            if (!part.isBlank()) {
                if (name.length() > 0) name.append(' ');
                name.append(Character.toUpperCase(part.charAt(0)));
                if (part.length() > 1) name.append(part.substring(1).toLowerCase());
            }
        }
        return name.toString();
    }

    // ─── Document Management ──────────────────────────────────────────────────

    public List<CampaignPlanDocumentDto> getDocuments(Long planId, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        return documentRepository.findAllByCampaignPlan(plan).stream()
                .map(this::toDocumentDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<CampaignPlanDocumentDto> uploadDocuments(Long planId,
                                                         List<MultipartFile> files,
                                                         Authentication auth) throws IOException {
        CampaignPlan plan = resolvePlan(planId, auth);
        List<CampaignPlanDocumentDto> saved = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file.isEmpty()) continue;
            CampaignPlanDocument doc = new CampaignPlanDocument();
            doc.setCampaignPlan(plan);
            doc.setOriginalFileName(file.getOriginalFilename());
            doc.setMimeType(file.getContentType());
            doc.setFileContent(file.getBytes());
            saved.add(toDocumentDto(documentRepository.save(doc)));
            log.info("Uploaded briefing doc '{}' ({} bytes) for plan {}", file.getOriginalFilename(), file.getSize(), planId);
        }
        return saved;
    }

    @Transactional
    public List<CampaignPlanDocumentDto> importDocumentsFromDrive(Long planId, List<String> fileUrls, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);

        if (fileUrls == null || fileUrls.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No file URLs provided. Paste individual Google Docs / Slides share links.");
        }

        List<CampaignPlanDocument> imported = googleDriveImportService.importFiles(fileUrls, plan);

        if (imported.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "No files could be downloaded. Make sure the links are Google Docs or Slides and your Gmail account is connected.");
        }

        return imported.stream().map(this::toDocumentDto).collect(Collectors.toList());
    }

    @Transactional
    public List<ProspectContactDto> importContactsFromExcel(Long planId, MultipartFile file, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        // Delete any previously AI-generated contacts for this plan before import
        prospectContactRepository.deleteAllByCampaignPlan(plan);

        List<ProspectContact> imported = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            Row header = sheet.getRow(0);
            if (header == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Excel file is empty");

            // Build column index map (case-insensitive header matching)
            Map<String, Integer> colIdx = new HashMap<>();
            for (Cell c : header) {
                if (c != null) {
                    String h = c.toString().trim().toLowerCase();
                    colIdx.put(h, c.getColumnIndex());
                }
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                String name = cell(row, colIdx, "name", "full name", "contact name");
                if (name == null || name.isBlank()) continue;

                ProspectContact pc = new ProspectContact();
                pc.setCampaignPlan(plan);
                pc.setName(name.trim());
                pc.setTitle(cell(row, colIdx, "title", "job title", "role", "position"));
                pc.setEmail(cell(row, colIdx, "email", "email address", "work email"));
                pc.setRoleType(cell(row, colIdx, "role type", "roletype", "type"));
                pc.setTeamDomain(cell(row, colIdx, "team", "team domain", "department", "company", "organization"));
                pc.setSenioritySignal(cell(row, colIdx, "seniority", "seniority signal", "level"));
                pc.setTanzuRelevance(cell(row, colIdx, "relevance", "tanzu relevance", "priority"));
                pc.setSource("excel-import");
                pc.setSelected(false);
                imported.add(prospectContactRepository.save(pc));
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to read Excel file: " + e.getMessage());
        }

        if (imported.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No contacts found in the Excel file. Make sure row 1 is a header row with at least a 'Name' column.");
        }

        // Apply email format to contacts missing an email address
        String emailFormat = plan.getEmailFormat();
        if (emailFormat != null && !emailFormat.isBlank()) {
            imported.forEach(pc -> {
                if (pc.getEmail() == null || pc.getEmail().isBlank()) {
                    pc.setEmail(applyEmailFormat(emailFormat, pc.getName()));
                    prospectContactRepository.save(pc);
                }
            });
        }

        log.info("Imported {} contacts from Excel for plan {}", imported.size(), planId);
        return imported.stream().map(this::toProspectDto).collect(Collectors.toList());
    }

    @Transactional
    public List<ProspectContactDto> importContactsFromGSheet(Long planId, String url, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        byte[] bytes;
        try {
            bytes = excelImportService.downloadGoogleSheetBytes(url);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }

        prospectContactRepository.deleteAllByCampaignPlan(plan);
        List<ProspectContact> imported = new ArrayList<>();
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = wb.getSheetAt(0);
            Row header = sheet.getRow(0);
            if (header == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sheet is empty");

            Map<String, Integer> colIdx = new HashMap<>();
            for (Cell c : header) {
                if (c != null) colIdx.put(c.toString().trim().toLowerCase(), c.getColumnIndex());
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                String name = cell(row, colIdx, "name", "full name", "contact name");
                if (name == null || name.isBlank()) continue;
                ProspectContact pc = new ProspectContact();
                pc.setCampaignPlan(plan);
                pc.setName(name.trim());
                pc.setTitle(cell(row, colIdx, "title", "job title", "role", "position"));
                pc.setEmail(cell(row, colIdx, "email", "email address", "work email"));
                pc.setRoleType(cell(row, colIdx, "role type", "roletype", "type"));
                pc.setTeamDomain(cell(row, colIdx, "team", "team domain", "department", "company", "organization"));
                pc.setSenioritySignal(cell(row, colIdx, "seniority", "seniority signal", "level"));
                pc.setTanzuRelevance(cell(row, colIdx, "relevance", "tanzu relevance", "priority"));
                pc.setSource("gsheet-import");
                pc.setSelected(false);
                imported.add(prospectContactRepository.save(pc));
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to read sheet: " + e.getMessage());
        }

        if (imported.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No contacts found. Make sure row 1 is a header with at least a 'Name' column.");
        }

        // Apply email format to contacts missing an email address
        String emailFormat = plan.getEmailFormat();
        if (emailFormat != null && !emailFormat.isBlank()) {
            imported.forEach(pc -> {
                if (pc.getEmail() == null || pc.getEmail().isBlank()) {
                    pc.setEmail(applyEmailFormat(emailFormat, pc.getName()));
                    prospectContactRepository.save(pc);
                }
            });
        }

        log.info("Imported {} contacts from Google Sheet for plan {}", imported.size(), planId);
        return imported.stream().map(this::toProspectDto).collect(Collectors.toList());
    }

    /** Returns the cell value for the first matching column header, or null if none found. */
    private String cell(Row row, Map<String, Integer> colIdx, String... headers) {
        for (String h : headers) {
            Integer idx = colIdx.get(h.toLowerCase());
            if (idx != null) {
                Cell c = row.getCell(idx);
                if (c != null) {
                    String v = c.toString().trim();
                    return v.isEmpty() ? null : v;
                }
            }
        }
        return null;
    }

    @Transactional
    public void deleteDocument(Long planId, Long docId, Authentication auth) {
        CampaignPlan plan = resolvePlan(planId, auth);
        CampaignPlanDocument doc = documentRepository.findByIdAndCampaignPlan(docId, plan)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
        documentRepository.delete(doc);
    }

    private CampaignPlanDocumentDto toDocumentDto(CampaignPlanDocument doc) {
        CampaignPlanDocumentDto dto = new CampaignPlanDocumentDto();
        dto.setId(doc.getId());
        dto.setOriginalFileName(doc.getOriginalFileName());
        dto.setMimeType(doc.getMimeType());
        dto.setCreatedAt(doc.getCreatedAt());
        return dto;
    }
}
