package com.campaignmanager.service;

import com.campaignmanager.dto.CampaignDto;
import com.campaignmanager.dto.EmailTemplateDto;
import com.campaignmanager.model.*;
import com.campaignmanager.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
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

    public List<CampaignDto> findAll() {
        return campaignRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public CampaignDto findById(Long id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        CampaignDto dto = toDto(campaign);
        dto.setTemplates(templateRepository.findByCampaignIdOrderByStepNumber(id)
                .stream().map(this::templateToDto).collect(Collectors.toList()));
        return dto;
    }

    @Transactional
    public CampaignDto create(CampaignDto dto) {
        Campaign campaign = new Campaign();
        mapDtoToEntity(dto, campaign);
        campaign.setStatus(CampaignStatus.DRAFT);
        campaign.setCreatedAt(LocalDateTime.now());
        return toDto(campaignRepository.save(campaign));
    }

    @Transactional
    public CampaignDto update(Long id, CampaignDto dto) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        mapDtoToEntity(dto, campaign);
        return toDto(campaignRepository.save(campaign));
    }

    @Transactional
    public void delete(Long id) {
        campaignRepository.deleteById(id);
    }

    @Transactional
    public CampaignDto launch(Long id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));

        if (campaign.getStatus() == CampaignStatus.COMPLETED) {
            throw new RuntimeException("Campaign is already completed");
        }

        List<EmailTemplate> templates = templateRepository.findByCampaignIdOrderByStepNumber(id);
        if (templates.isEmpty()) {
            throw new RuntimeException("Campaign has no email templates. Add at least one template before launching.");
        }

        int[] intervalDays = parseIntervalDays(campaign.getIntervalDays());
        List<CampaignContact> contacts = campaignContactRepository.findByCampaignId(id);

        if (contacts.isEmpty()) {
            throw new RuntimeException("No contacts enrolled in this campaign. Add contacts before launching.");
        }

        LocalDateTime now = LocalDateTime.now();

        for (CampaignContact cc : contacts) {
            for (int i = 0; i < templates.size(); i++) {
                EmailTemplate template = templates.get(i);
                int daysOffset = i < intervalDays.length ? intervalDays[i] : i * 3;

                // Check if job already exists for this cc + step
                boolean jobExists = cc.getEmailJobs().stream()
                        .anyMatch(j -> j.getStepNumber().equals(template.getStepNumber()));
                if (jobExists) continue;

                Contact contact = cc.getContact();
                String resolvedSubject = resolveTokens(template.getSubject(), contact);
                String resolvedBody = resolveTokens(template.getBodyTemplate(), contact);

                EmailJob job = new EmailJob();
                job.setCampaignContact(cc);
                job.setStepNumber(template.getStepNumber());
                job.setSubject(resolvedSubject);
                job.setBody(resolvedBody);
                job.setScheduledAt(cc.getEnrolledAt().plusDays(daysOffset));
                job.setStatus(EmailJobStatus.SCHEDULED);
                emailJobRepository.save(job);
            }
        }

        campaign.setStatus(CampaignStatus.ACTIVE);
        campaign.setLaunchedAt(now);
        return toDto(campaignRepository.save(campaign));
    }

    @Transactional
    public CampaignDto pause(Long id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        campaign.setStatus(CampaignStatus.PAUSED);
        return toDto(campaignRepository.save(campaign));
    }

    @Transactional
    public CampaignDto resume(Long id) {
        Campaign campaign = campaignRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + id));
        campaign.setStatus(CampaignStatus.ACTIVE);
        return toDto(campaignRepository.save(campaign));
    }

    private String resolveTokens(String template, Contact contact) {
        return template
                .replace("{{name}}", contact.getName() != null ? contact.getName() : "")
                .replace("{{role}}", contact.getRole() != null ? contact.getRole() : "")
                .replace("{{company}}", contact.getCompany() != null ? contact.getCompany() : "")
                .replace("{{category}}", contact.getCategory() != null ? contact.getCategory() : "");
    }

    private int[] parseIntervalDays(String intervalDays) {
        return Arrays.stream(intervalDays.split(","))
                .map(String::trim)
                .mapToInt(Integer::parseInt)
                .toArray();
    }

    private void mapDtoToEntity(CampaignDto dto, Campaign campaign) {
        campaign.setName(dto.getName());
        campaign.setDescription(dto.getDescription());
        campaign.setGmailEmail(dto.getGmailEmail());
        campaign.setIntervalDays(dto.getIntervalDays());
    }

    public CampaignDto toDto(Campaign c) {
        CampaignDto dto = new CampaignDto();
        dto.setId(c.getId());
        dto.setName(c.getName());
        dto.setDescription(c.getDescription());
        dto.setGmailEmail(c.getGmailEmail());
        dto.setIntervalDays(c.getIntervalDays());
        dto.setStatus(c.getStatus());
        dto.setCreatedAt(c.getCreatedAt());
        dto.setLaunchedAt(c.getLaunchedAt());
        dto.setContactCount(campaignContactRepository.countByCampaignId(c.getId() != null ? c.getId() : 0L));
        return dto;
    }

    public EmailTemplateDto templateToDto(EmailTemplate t) {
        EmailTemplateDto dto = new EmailTemplateDto();
        dto.setId(t.getId());
        dto.setCampaignId(t.getCampaign().getId());
        dto.setStepNumber(t.getStepNumber());
        dto.setSubject(t.getSubject());
        dto.setBodyTemplate(t.getBodyTemplate());
        return dto;
    }
}
