package com.campaignmanager.controller;

import com.campaignmanager.dto.*;
import com.campaignmanager.model.Campaign;
import com.campaignmanager.model.CampaignContact;
import com.campaignmanager.model.Contact;
import com.campaignmanager.repository.CampaignContactRepository;
import com.campaignmanager.repository.CampaignRepository;
import com.campaignmanager.repository.ContactRepository;
import com.campaignmanager.service.CampaignService;
import com.campaignmanager.service.ContactService;
import com.campaignmanager.service.EmailJobService;
import com.campaignmanager.service.EmailTemplateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/campaigns")
@RequiredArgsConstructor
public class CampaignController {

    private final CampaignService campaignService;
    private final EmailTemplateService templateService;
    private final ContactService contactService;
    private final EmailJobService emailJobService;
    private final CampaignContactRepository campaignContactRepository;
    private final CampaignRepository campaignRepository;
    private final ContactRepository contactRepository;

    @GetMapping
    public List<CampaignDto> getAll() {
        return campaignService.findAll();
    }

    @GetMapping("/{id}")
    public CampaignDto getById(@PathVariable Long id) {
        return campaignService.findById(id);
    }

    @PostMapping
    public CampaignDto create(@Valid @RequestBody CampaignDto dto) {
        return campaignService.create(dto);
    }

    @PutMapping("/{id}")
    public CampaignDto update(@PathVariable Long id, @Valid @RequestBody CampaignDto dto) {
        return campaignService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        campaignService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/launch")
    public CampaignDto launch(@PathVariable Long id) {
        return campaignService.launch(id);
    }

    @PostMapping("/{id}/pause")
    public CampaignDto pause(@PathVariable Long id) {
        return campaignService.pause(id);
    }

    @PostMapping("/{id}/resume")
    public CampaignDto resume(@PathVariable Long id) {
        return campaignService.resume(id);
    }

    // --- Templates ---

    @GetMapping("/{id}/templates")
    public List<EmailTemplateDto> getTemplates(@PathVariable Long id) {
        return templateService.findByCampaign(id);
    }

    @PostMapping("/{id}/templates")
    public EmailTemplateDto addTemplate(@PathVariable Long id, @Valid @RequestBody EmailTemplateDto dto) {
        return templateService.create(id, dto);
    }

    @PutMapping("/{id}/templates/{templateId}")
    public EmailTemplateDto updateTemplate(@PathVariable Long id,
                                           @PathVariable Long templateId,
                                           @Valid @RequestBody EmailTemplateDto dto) {
        return templateService.update(templateId, dto);
    }

    @DeleteMapping("/{id}/templates/{templateId}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id, @PathVariable Long templateId) {
        templateService.delete(templateId);
        return ResponseEntity.noContent().build();
    }

    // --- Contacts ---

    @GetMapping("/{id}/contacts")
    public List<ContactDto> getContacts(@PathVariable Long id) {
        return campaignContactRepository.findByCampaignId(id).stream()
                .map(cc -> {
                    ContactDto dto = contactService.toDto(cc.getContact());
                    dto.setEnrolledInCampaign(true);
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @PostMapping("/{id}/contacts")
    @Transactional
    public ResponseEntity<Map<String, Object>> assignContacts(@PathVariable Long id,
                                                              @RequestBody BulkContactAssignDto body) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));

        int added = 0;
        for (Long contactId : body.getContactIds()) {
            if (!campaignContactRepository.existsByCampaignIdAndContactId(id, contactId)) {
                Contact contact = contactRepository.findById(contactId)
                        .orElseThrow(() -> new RuntimeException("Contact not found: " + contactId));

                CampaignContact cc = new CampaignContact();
                cc.setCampaign(campaign);
                cc.setContact(contact);
                cc.setEnrolledAt(LocalDateTime.now());
                campaignContactRepository.save(cc);
                added++;
            }
        }
        return ResponseEntity.ok(Map.of("added", added));
    }

    @DeleteMapping("/{id}/contacts/{contactId}")
    @Transactional
    public ResponseEntity<Void> removeContact(@PathVariable Long id, @PathVariable Long contactId) {
        campaignContactRepository.findByCampaignIdAndContactId(id, contactId)
                .ifPresent(campaignContactRepository::delete);
        return ResponseEntity.noContent().build();
    }

    // --- Email Jobs ---

    @GetMapping("/{id}/jobs")
    public List<EmailJobDto> getJobs(@PathVariable Long id,
                                     @RequestParam(required = false) String status) {
        return emailJobService.findByCampaign(id, status);
    }
}
