package com.campaignmanager.service;

import com.campaignmanager.dto.EmailJobDto;
import com.campaignmanager.model.*;
import com.campaignmanager.repository.CampaignContactRepository;
import com.campaignmanager.repository.EmailJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmailJobService {

    private final EmailJobRepository emailJobRepository;
    private final CampaignContactRepository campaignContactRepository;

    public List<EmailJobDto> findByCampaign(Long campaignId, String status) {
        List<EmailJob> jobs;
        if (status != null && !status.isBlank()) {
            jobs = emailJobRepository.findByCampaignContactCampaignIdAndStatus(
                    campaignId, EmailJobStatus.valueOf(status.toUpperCase()));
        } else {
            jobs = emailJobRepository.findByCampaignIdOrdered(campaignId);
        }
        return jobs.stream().map(this::toDto).collect(Collectors.toList());
    }

    public List<EmailJobDto> findAll() {
        return emailJobRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public EmailJobDto retry(Long id) {
        EmailJob job = emailJobRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Email job not found: " + id));
        if (job.getStatus() != EmailJobStatus.FAILED) {
            throw new RuntimeException("Only FAILED jobs can be retried");
        }
        job.setStatus(EmailJobStatus.SCHEDULED);
        job.setScheduledAt(LocalDateTime.now());
        job.setErrorMessage(null);
        return toDto(emailJobRepository.save(job));
    }

    public EmailJobDto toDto(EmailJob j) {
        EmailJobDto dto = new EmailJobDto();
        dto.setId(j.getId());
        dto.setCampaignContactId(j.getCampaignContact().getId());

        CampaignContact cc = j.getCampaignContact();
        if (cc.getCampaign() != null) {
            dto.setCampaignId(cc.getCampaign().getId());
            dto.setCampaignName(cc.getCampaign().getName());
        }
        if (cc.getContact() != null) {
            dto.setContactId(cc.getContact().getId());
            dto.setContactName(cc.getContact().getName());
            dto.setContactEmail(cc.getContact().getEmail());
        }

        dto.setStepNumber(j.getStepNumber());
        dto.setSubject(j.getSubject());
        dto.setBody(j.getBody());
        dto.setScheduledAt(j.getScheduledAt());
        dto.setSentAt(j.getSentAt());
        dto.setStatus(j.getStatus());
        dto.setErrorMessage(j.getErrorMessage());
        return dto;
    }
}
