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
}
