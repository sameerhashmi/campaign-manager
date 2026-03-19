package com.campaignmanager.service;

import com.campaignmanager.dto.GeneratedEmailDto;
import com.campaignmanager.dto.ProspectContactDto;
import com.campaignmanager.model.GeneratedEmail;
import com.campaignmanager.model.ProspectContact;
import com.campaignmanager.repository.CampaignPlanRepository;
import com.campaignmanager.repository.GeneratedEmailRepository;
import com.campaignmanager.repository.ProspectContactRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
@Slf4j
public class EmailGenerationAsyncWorker {

    private final GeminiApiService geminiApiService;
    private final ProspectContactRepository prospectContactRepository;
    private final GeneratedEmailRepository generatedEmailRepository;
    private final CampaignPlanRepository planRepository;

    @Async
    @Transactional
    public void process(Long planId,
                        List<ProspectContactDto> contactDtos,
                        List<Long> contactIds,
                        String apiKey,
                        String model,
                        String systemInstructions,
                        String corpus,
                        List<LocalDateTime> schedule,
                        ConcurrentHashMap<Long, String> errorStore) {
        try {
            // Fire all Gemini calls in parallel
            Map<Long, CompletableFuture<List<GeneratedEmailDto>>> futures = new LinkedHashMap<>();
            for (int i = 0; i < contactDtos.size(); i++) {
                ProspectContactDto dto = contactDtos.get(i);
                Long contactId = contactIds.get(i);
                futures.put(contactId, CompletableFuture.supplyAsync(() ->
                        geminiApiService.generateEmails(apiKey, model, systemInstructions, dto, schedule, corpus)));
            }

            // Collect and save
            for (int i = 0; i < contactIds.size(); i++) {
                Long contactId = contactIds.get(i);
                ProspectContact pc = prospectContactRepository.findById(contactId)
                        .orElseThrow(() -> new RuntimeException("Contact not found: " + contactId));
                List<GeneratedEmailDto> emails = futures.get(contactId).get(120, TimeUnit.SECONDS);
                for (GeneratedEmailDto dto : emails) {
                    GeneratedEmail ge = new GeneratedEmail();
                    ge.setProspectContact(pc);
                    ge.setStepNumber(dto.getStepNumber());
                    ge.setSubject(dto.getSubject());
                    ge.setBody(dto.getBody());
                    int step = dto.getStepNumber();
                    ge.setScheduledAt(dto.getScheduledAt() != null ? dto.getScheduledAt()
                            : (step >= 1 && step <= schedule.size() ? schedule.get(step - 1) : null));
                    generatedEmailRepository.save(ge);
                }
                log.info("Emails saved for contact {} (plan {})", pc.getName(), planId);
            }

            planRepository.findById(planId).ifPresent(p -> {
                p.setStatus("EMAILS_READY");
                planRepository.save(p);
            });
            log.info("Async email generation complete for plan {}", planId);

        } catch (Exception e) {
            log.error("Async email generation failed for plan {}: {}", planId, e.getMessage(), e);
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            errorStore.put(planId, cause.getMessage() != null ? cause.getMessage() : e.getMessage());
            planRepository.findById(planId).ifPresent(p -> {
                p.setStatus("EMAIL_ERROR");
                planRepository.save(p);
            });
        }
    }
}
