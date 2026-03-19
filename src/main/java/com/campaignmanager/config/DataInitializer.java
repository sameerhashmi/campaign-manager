package com.campaignmanager.config;

import com.campaignmanager.model.User;
import com.campaignmanager.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        if (!userRepository.existsByUsername("admin")) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRole("ROLE_ADMIN");
            userRepository.save(admin);
            log.info("Default admin user created — username: admin, password: admin123");
        }
        migrateEmailJobStatusColumn();
        migrateOwnerColumns();
        migrateClientBriefingsFileContent();
        migrateCampaignPlanDocuments();
        migrateCampaignPlanEmailFormat();
        migrateCampaignPlanGmailEmail();
    }

    /**
     * Ensures email_jobs.status column accepts new enum values (e.g. HOLD).
     * Handles two cases Hibernate 6 may create on MySQL:
     *  1. Native MySQL ENUM — MODIFY COLUMN converts it to VARCHAR(20)
     *  2. VARCHAR with CHECK constraint — drops the constraint so new values are accepted
     */
    private void migrateEmailJobStatusColumn() {
        // Drop any auto-generated CHECK constraints on email_jobs (e.g. status IN (...))
        try {
            List<String> constraints = jdbcTemplate.queryForList(
                "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS " +
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_jobs' " +
                "AND CONSTRAINT_TYPE = 'CHECK'",
                String.class);
            for (String name : constraints) {
                try {
                    jdbcTemplate.execute("ALTER TABLE email_jobs DROP CHECK `" + name + "`");
                    log.info("Dropped check constraint {} from email_jobs", name);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            log.debug("Could not query check constraints: {}", e.getMessage());
        }

        // Convert ENUM → VARCHAR(20), or ensure VARCHAR if already a string type
        try {
            jdbcTemplate.execute(
                "ALTER TABLE email_jobs MODIFY COLUMN status VARCHAR(20) NOT NULL");
            log.info("email_jobs.status ensured as VARCHAR(20)");
        } catch (Exception e) {
            log.debug("email_jobs.status column alter skipped: {}", e.getMessage());
        }
    }

    /**
     * Sets owner_id on existing campaigns/contacts to the admin user,
     * and migrates the contacts email unique constraint to a composite (email, owner_id).
     * Safe to run repeatedly — all steps are idempotent or wrapped in try/catch.
     */
    private void migrateOwnerColumns() {
        Long adminId = userRepository.findByUsername("admin")
                .map(u -> u.getId())
                .orElse(null);
        if (adminId == null) {
            log.warn("migrateOwnerColumns: admin user not found, skipping");
            return;
        }

        // Set owner_id on existing campaigns that have none
        try {
            int updated = jdbcTemplate.update(
                "UPDATE campaigns SET owner_id = ? WHERE owner_id IS NULL", adminId);
            if (updated > 0) log.info("Set owner_id={} on {} existing campaigns", adminId, updated);
        } catch (Exception e) {
            log.debug("campaigns owner_id migration skipped: {}", e.getMessage());
        }

        // Set owner_id on existing contacts that have none
        try {
            int updated = jdbcTemplate.update(
                "UPDATE contacts SET owner_id = ? WHERE owner_id IS NULL", adminId);
            if (updated > 0) log.info("Set owner_id={} on {} existing contacts", adminId, updated);
        } catch (Exception e) {
            log.debug("contacts owner_id migration skipped: {}", e.getMessage());
        }

        // Drop old global unique constraint on contacts.email so the new composite one can work.
        // MySQL: look up the index name in information_schema and drop it.
        // H2: attempt a known constraint name drop.
        try {
            List<String> indexes = jdbcTemplate.queryForList(
                "SELECT INDEX_NAME FROM information_schema.STATISTICS " +
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contacts' " +
                "AND NON_UNIQUE = 0 AND INDEX_NAME != 'PRIMARY' " +
                "AND INDEX_NAME NOT IN ('uk_contact_email_owner')",
                String.class);
            for (String idxName : indexes) {
                try {
                    jdbcTemplate.execute("ALTER TABLE contacts DROP INDEX `" + idxName + "`");
                    log.info("Dropped old unique index {} from contacts", idxName);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            // H2 fallback — try common Hibernate-generated names
            for (String name : List.of("uk_contacts_email", "uk6g6lkdy4im8xfmk8h5otgxq9g")) {
                try {
                    jdbcTemplate.execute("ALTER TABLE contacts DROP CONSTRAINT " + name);
                    log.info("Dropped H2 unique constraint {} from contacts", name);
                } catch (Exception ignored) {}
            }
        }
    }

    /**
     * Adds mime_type and file_content columns to client_briefings if they don't exist.
     * Files are now stored as BLOBs in the DB instead of on the ephemeral CF filesystem.
     */
    private void migrateClientBriefingsFileContent() {
        try {
            jdbcTemplate.execute(
                "ALTER TABLE client_briefings ADD COLUMN mime_type VARCHAR(255)");
            log.info("Added mime_type column to client_briefings");
        } catch (Exception e) {
            log.debug("client_briefings.mime_type already exists or skipped: {}", e.getMessage());
        }
        try {
            jdbcTemplate.execute(
                "ALTER TABLE client_briefings ADD COLUMN file_content LONGBLOB");
            log.info("Added file_content column to client_briefings");
        } catch (Exception e) {
            log.debug("client_briefings.file_content already exists or skipped: {}", e.getMessage());
        }
    }

    /**
     * Adds email_format column to campaign_plans if it doesn't exist.
     */
    private void migrateCampaignPlanEmailFormat() {
        try {
            jdbcTemplate.execute(
                "ALTER TABLE campaign_plans ADD COLUMN IF NOT EXISTS email_format VARCHAR(255)");
            log.info("Added email_format column to campaign_plans");
        } catch (Exception e) {
            log.debug("campaign_plans.email_format already exists or skipped: {}", e.getMessage());
        }
    }

    /**
     * Adds gmail_email column to campaign_plans if it doesn't exist.
     */
    private void migrateCampaignPlanGmailEmail() {
        try {
            jdbcTemplate.execute(
                "ALTER TABLE campaign_plans ADD COLUMN IF NOT EXISTS gmail_email VARCHAR(255)");
            log.info("Added gmail_email column to campaign_plans");
        } catch (Exception e) {
            log.debug("campaign_plans.gmail_email already exists or skipped: {}", e.getMessage());
        }
    }

    /**
     * Creates the campaign_plan_documents table if it doesn't exist.
     * Stores uploaded briefing files as BLOBs for RAG-style context injection into Gemini.
     */
    private void migrateCampaignPlanDocuments() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS campaign_plan_documents (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    campaign_plan_id BIGINT NOT NULL,
                    original_file_name VARCHAR(255),
                    mime_type VARCHAR(255),
                    file_content LONGBLOB,
                    created_at DATETIME,
                    FOREIGN KEY (campaign_plan_id) REFERENCES campaign_plans(id) ON DELETE CASCADE
                )
                """);
            log.info("campaign_plan_documents table ready");
        } catch (Exception e) {
            log.debug("campaign_plan_documents migration skipped: {}", e.getMessage());
        }
    }
}
