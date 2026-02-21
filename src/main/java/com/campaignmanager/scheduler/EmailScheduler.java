package com.campaignmanager.scheduler;

import com.campaignmanager.model.CampaignStatus;
import com.campaignmanager.model.EmailJob;
import com.campaignmanager.model.EmailJobStatus;
import com.campaignmanager.repository.EmailJobRepository;
import com.campaignmanager.service.PlaywrightGmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class EmailScheduler {

    private final EmailJobRepository emailJobRepository;
    private final PlaywrightGmailService gmailService;

    /**
     * Runs every 60 seconds. Finds all due email jobs and sends them via Playwright.
     */
    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void processEmailQueue() {
        List<EmailJob> dueJobs = emailJobRepository.findDueJobs(LocalDateTime.now());

        if (dueJobs.isEmpty()) return;

        log.info("Email scheduler: {} due job(s) found", dueJobs.size());

        for (EmailJob job : dueJobs) {
            // Skip if campaign is paused
            CampaignStatus campaignStatus = job.getCampaignContact().getCampaign().getStatus();
            if (campaignStatus == CampaignStatus.PAUSED || campaignStatus == CampaignStatus.DRAFT) {
                log.debug("Skipping job {} — campaign is {}", job.getId(), campaignStatus);
                continue;
            }

            try {
                log.info("Sending email job id={} to={} subject='{}'",
                        job.getId(),
                        job.getCampaignContact().getContact().getEmail(),
                        job.getSubject());

                gmailService.send(job);

                job.setStatus(EmailJobStatus.SENT);
                job.setSentAt(LocalDateTime.now());
                job.setErrorMessage(null);
            } catch (Exception e) {
                log.error("Failed to send email job id={}: {}", job.getId(), e.getMessage());
                job.setStatus(EmailJobStatus.FAILED);
                job.setErrorMessage(e.getMessage());
            }

            emailJobRepository.save(job);
        }
    }
}
