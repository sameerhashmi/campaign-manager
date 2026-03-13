package com.campaignmanager.controller;

import com.campaignmanager.dto.*;
import com.campaignmanager.service.CampaignPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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
    public ResponseEntity<Map<Long, List<GeneratedEmailDto>>> generateEmails(
            @PathVariable Long id,
            @RequestBody Map<String, List<Long>> body,
            Authentication auth) {
        List<Long> selectedContactIds = body.getOrDefault("selectedContactIds", List.of());
        return ResponseEntity.ok(planService.generateEmails(id, selectedContactIds, auth));
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

    @PostMapping("/{id}/convert")
    public ResponseEntity<CampaignDto> convert(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(planService.convertToCampaign(id, auth));
    }
}
