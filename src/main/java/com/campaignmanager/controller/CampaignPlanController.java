package com.campaignmanager.controller;

import com.campaignmanager.dto.*;
import com.campaignmanager.service.CampaignPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/campaign-plans")
@RequiredArgsConstructor
public class CampaignPlanController {

    private final CampaignPlanService planService;

    @GetMapping
    public List<CampaignPlanDto> getAll(Authentication auth) {
        return planService.findAll(auth);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CampaignPlanDto> getById(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(planService.findById(id, auth));
    }

    @PostMapping
    public ResponseEntity<CampaignPlanDto> create(@RequestBody CampaignPlanDto dto, Authentication auth) {
        return ResponseEntity.ok(planService.create(dto, auth));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CampaignPlanDto> update(@PathVariable Long id,
                                                   @RequestBody CampaignPlanDto dto,
                                                   Authentication auth) {
        return ResponseEntity.ok(planService.update(id, dto, auth));
    }

    @PostMapping("/{id}/generate-contacts")
    public ResponseEntity<List<ProspectContactDto>> generateContacts(@PathVariable Long id,
                                                                      Authentication auth) {
        return ResponseEntity.ok(planService.generateContacts(id, auth));
    }

    @PostMapping(value = "/{id}/contacts/import-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<ProspectContactDto>> importContactsFromExcel(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        return ResponseEntity.ok(planService.importContactsFromExcel(id, file, auth));
    }

    @GetMapping("/{id}/contacts")
    public ResponseEntity<List<ProspectContactDto>> getContacts(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(planService.getContacts(id, auth));
    }

    @PutMapping("/{id}/contacts/{contactId}")
    public ResponseEntity<ProspectContactDto> updateContact(@PathVariable Long id,
                                                             @PathVariable Long contactId,
                                                             @RequestBody ProspectContactDto dto,
                                                             Authentication auth) {
        return ResponseEntity.ok(planService.updateContact(id, contactId, dto, auth));
    }

    @PostMapping("/{id}/generate-emails")
    public ResponseEntity<Map<String, String>> generateEmails(
            @PathVariable Long id,
            @RequestBody Map<String, List<Long>> body,
            Authentication auth) {
        List<Long> selectedContactIds = body.getOrDefault("selectedContactIds", List.of());
        planService.startEmailGeneration(id, selectedContactIds, auth);
        return ResponseEntity.accepted().body(Map.of("status", "GENERATING_EMAILS"));
    }

    @GetMapping("/{id}/contacts/{contactId}/emails")
    public ResponseEntity<List<GeneratedEmailDto>> getEmailsForContact(
            @PathVariable Long id,
            @PathVariable Long contactId,
            Authentication auth) {
        return ResponseEntity.ok(planService.getEmailsForContact(id, contactId, auth));
    }

    @PutMapping("/{id}/emails/{emailId}")
    public ResponseEntity<GeneratedEmailDto> updateEmail(@PathVariable Long id,
                                                          @PathVariable Long emailId,
                                                          @RequestBody GeneratedEmailDto dto,
                                                          Authentication auth) {
        return ResponseEntity.ok(planService.updateEmail(id, emailId, dto, auth));
    }

    @GetMapping("/{id}/summary")
    public ResponseEntity<CampaignPlanSummaryDto> getSummary(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(planService.getSummary(id, auth));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        planService.delete(id, auth);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/convert")
    public ResponseEntity<CampaignDto> convert(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(planService.convertToCampaign(id, auth));
    }

    // ─── Document Upload (RAG) ─────────────────────────────────────────────────

    @GetMapping("/{id}/documents")
    public ResponseEntity<List<CampaignPlanDocumentDto>> getDocuments(
            @PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(planService.getDocuments(id, auth));
    }

    @PostMapping(value = "/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<CampaignPlanDocumentDto>> uploadDocuments(
            @PathVariable Long id,
            @RequestParam("files") List<MultipartFile> files,
            Authentication auth) throws IOException {
        return ResponseEntity.ok(planService.uploadDocuments(id, files, auth));
    }

    @DeleteMapping("/{id}/documents/{docId}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable Long id,
            @PathVariable Long docId,
            Authentication auth) {
        planService.deleteDocument(id, docId, auth);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/documents/from-drive")
    public ResponseEntity<List<CampaignPlanDocumentDto>> importFromDrive(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        @SuppressWarnings("unchecked")
        List<String> fileUrls = (List<String>) body.getOrDefault("fileUrls", List.of());
        return ResponseEntity.ok(planService.importDocumentsFromDrive(id, fileUrls, auth));
    }
}
