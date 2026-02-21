package com.campaignmanager.service;

import com.campaignmanager.dto.EmailTemplateDto;
import com.campaignmanager.model.Campaign;
import com.campaignmanager.model.EmailTemplate;
import com.campaignmanager.repository.CampaignRepository;
import com.campaignmanager.repository.EmailTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmailTemplateService {

    private final EmailTemplateRepository templateRepository;
    private final CampaignRepository campaignRepository;

    public List<EmailTemplateDto> findByCampaign(Long campaignId) {
        return templateRepository.findByCampaignIdOrderByStepNumber(campaignId)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public EmailTemplateDto create(Long campaignId, EmailTemplateDto dto) {
        Campaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + campaignId));
        EmailTemplate template = new EmailTemplate();
        template.setCampaign(campaign);
        template.setStepNumber(dto.getStepNumber());
        template.setSubject(dto.getSubject());
        template.setBodyTemplate(dto.getBodyTemplate());
        return toDto(templateRepository.save(template));
    }

    @Transactional
    public EmailTemplateDto update(Long id, EmailTemplateDto dto) {
        EmailTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));
        template.setStepNumber(dto.getStepNumber());
        template.setSubject(dto.getSubject());
        template.setBodyTemplate(dto.getBodyTemplate());
        return toDto(templateRepository.save(template));
    }

    @Transactional
    public void delete(Long id) {
        templateRepository.deleteById(id);
    }

    private EmailTemplateDto toDto(EmailTemplate t) {
        EmailTemplateDto dto = new EmailTemplateDto();
        dto.setId(t.getId());
        dto.setCampaignId(t.getCampaign().getId());
        dto.setStepNumber(t.getStepNumber());
        dto.setSubject(t.getSubject());
        dto.setBodyTemplate(t.getBodyTemplate());
        return dto;
    }
}
