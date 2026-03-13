package com.campaignmanager.service;

import com.campaignmanager.dto.CampaignDto;
import com.campaignmanager.dto.EmailTemplateDto;
import com.campaignmanager.model.*;
import com.campaignmanager.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CampaignService {

    private final CampaignRepository campaignRepository;
    private final EmailTemplateRepository templateRepository;
    private final CampaignContactRepository campaignContactRepository;
    private final EmailJobRepository emailJobRepository;
    private final ContactRepository contactRepository;
    private final UserRepository userRepository;

    private boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private User resolveOwner(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private void checkAccess(Campaign campaign, Authentication auth) {
        if (isAdmin(auth)) return;
        User owner = campaign.getOwner();
        if (owner == null || !owner.getUsername().equals(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    public List<CampaignDto> findAll(Authentication auth) {
        if (isAdmin(auth)) {
            return campaignRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
        }
        User owner = resolveOwner(auth);
        return campaignRepository.findAllByOwner(owner).stream().map(this::toDto).collect(Collectors.toList());
    }

    public CampaignDto findById(Long id, Authentication auth) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        checkAccess(campaign, auth);
        CampaignDto dto = toDto(campaign);
        dto.setTemplates(templateRepository.findByCampaignIdOrderByStepNumber(id)
                .stream().map(this::templateToDto).collect(Collectors.toList()));
        return dto;
    }

    @Transactional
    public CampaignDto create(CampaignDto dto, Authentication auth) {
        Campaign campaign = new Campaign();
        mapDtoToEntity(dto, campaign);
        campaign.setStatus(CampaignStatus.DRAFT);
        campaign.setCreatedAt(LocalDateTime.now());
        if (!isAdmin(auth)) {
            campaign.setOwner(resolveOwner(auth));
        }
        return toDto(campaignRepository.save(campaign));
    }

    @Transactional
    public CampaignDto update(Long id, CampaignDto dto, Authentication auth) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        checkAccess(campaign, auth);
        mapDtoToEntity(dto, campaign);
        return toDto(campaignRepository.save(campaign));
    }

    @Transactional
    public void delete(Long id, Authentication auth) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        checkAccess(campaign, auth);
        campaignRepository.deleteById(id);
    }

    @Transactional
    public CampaignDto launch(Long id, Authentication auth) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        checkAccess(campaign, auth);

        if (campaign.getStatus() == CampaignStatus.COMPLETED) {
            throw new RuntimeException("Campaign is already completed");
        }

        List<CampaignContact> contacts = campaignContactRepository.findByCampaignId(id);
        if (contacts.isEmpty()) {
            throw new RuntimeException("No contacts enrolled in this campaign. Import a spreadsheet or add contacts before launching.");
        }

        long jobCount = emailJobRepository.countByCampaignContactCampaignId(id);
        log.info("Launching campaign {}: {} contact(s), {} email job(s)", id, contacts.size(), jobCount);

        campaign.setStatus(CampaignStatus.ACTIVE);
        campaign.setLaunchedAt(LocalDateTime.now());
        return toDto(campaignRepository.save(campaign));
    }

    @Transactional
    public CampaignDto pause(Long id, Authentication auth) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        checkAccess(campaign, auth);
        campaign.setStatus(CampaignStatus.PAUSED);
        return toDto(campaignRepository.save(campaign));
    }

    @Transactional
    public CampaignDto resume(Long id, Authentication auth) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        checkAccess(campaign, auth);
        campaign.setStatus(CampaignStatus.ACTIVE);
        return toDto(campaignRepository.save(campaign));
    }

    /** Verify the campaign belongs to the authenticated user (or user is admin). */
    public void checkCampaignAccess(Long campaignId, Authentication auth) {
        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + campaignId));
        checkAccess(campaign, auth);
    }

    private String resolveTokens(String template, Contact contact) {
        return template
                .replace("{{name}}", contact.getName() != null ? contact.getName() : "")
                .replace("{{role}}", contact.getRole() != null ? contact.getRole() : "")
                .replace("{{company}}", contact.getCompany() != null ? contact.getCompany() : "")
                .replace("{{category}}", contact.getCategory() != null ? contact.getCategory() : "");
    }

    private void mapDtoToEntity(CampaignDto dto, Campaign campaign) {
        campaign.setName(dto.getName());
        campaign.setDescription(dto.getDescription());
        campaign.setGmailEmail(dto.getGmailEmail());
        campaign.setTanzuContact(dto.getTanzuContact());
        campaign.setCompany(dto.getCompany());
    }

    public CampaignDto toDto(Campaign c) {
        CampaignDto dto = new CampaignDto();
        dto.setId(c.getId());
        dto.setName(c.getName());
        dto.setDescription(c.getDescription());
        dto.setGmailEmail(c.getGmailEmail());
        dto.setTanzuContact(c.getTanzuContact());
        dto.setCompany(c.getCompany());
        dto.setStatus(c.getStatus());
        dto.setCreatedAt(c.getCreatedAt());
        dto.setLaunchedAt(c.getLaunchedAt());
        dto.setContactCount(campaignContactRepository.countByCampaignId(c.getId() != null ? c.getId() : 0L));
        if (c.getOwner() != null) dto.setOwnerUsername(c.getOwner().getUsername());
        return dto;
    }

    public EmailTemplateDto templateToDto(EmailTemplate t) {
        EmailTemplateDto dto = new EmailTemplateDto();
        dto.setId(t.getId());
        dto.setCampaignId(t.getCampaign().getId());
        dto.setStepNumber(t.getStepNumber());
        dto.setSubject(t.getSubject());
        dto.setBodyTemplate(t.getBodyTemplate());
        dto.setScheduledAt(t.getScheduledAt());
        return dto;
    }
}
