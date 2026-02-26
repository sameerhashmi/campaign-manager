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
            // Skip if campaign is paused or still in draft
            CampaignStatus campaignStatus = job.getCampaignContact().getCampaign().getStatus();
            if (campaignStatus == CampaignStatus.PAUSED || campaignStatus == CampaignStatus.DRAFT) {
                log.debug("Skipping job id={} — campaign is {}", job.getId(), campaignStatus);
                continue;
            }

            // Enforce step ordering: step N only sends after step N-1 is done.
            // "Done" means SENT (at least 30s ago, to prevent back-to-back sends in the
            // same scheduler cycle) OR SKIPPED (past-date jobs that will never send —
            // the next step should still proceed on its own scheduled date).
            int stepNumber = job.getStepNumber();
            if (stepNumber > 1) {
                LocalDateTime cutoff = LocalDateTime.now().minusSeconds(30);
                boolean previousStepDone = job.getCampaignContact().getEmailJobs().stream()
                        .anyMatch(j -> j.getStepNumber() == stepNumber - 1
                                && (j.getStatus() == EmailJobStatus.SKIPPED
                                    || (j.getStatus() == EmailJobStatus.SENT
                                        && j.getSentAt() != null
                                        && j.getSentAt().isBefore(cutoff))));
                if (!previousStepDone) {
                    log.info("Deferring job id={} step={} for contact={} — step {} not yet done",
                            job.getId(), stepNumber,
                            job.getCampaignContact().getContact().getEmail(),
                            stepNumber - 1);
                    continue;
                }
            }

            try {
                log.info("Sending job id={} step={} scheduledAt={} to={} subject='{}'",
                        job.getId(),
                        job.getStepNumber(),
                        job.getScheduledAt(),
                        job.getCampaignContact().getContact().getEmail(),
                        job.getSubject());

                gmailService.send(job);

                job.setStatus(EmailJobStatus.SENT);
                job.setSentAt(LocalDateTime.now());
                job.setErrorMessage(null);
            } catch (Exception e) {
                log.error("Failed to send job id={}: {}", job.getId(), e.getMessage());
                job.setStatus(EmailJobStatus.FAILED);
                job.setErrorMessage(e.getMessage());
            }

            emailJobRepository.save(job);
        }
    }
}
