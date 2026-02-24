package com.campaignmanager.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

/**
 * Configures the DataSource when running with the "cloud" profile (CF).
 *
 * If a MySQL service is bound (present in VCAP_SERVICES), it is used automatically.
 * Otherwise falls back to H2 file-based DB so the app starts even without a
 * bound service (useful for first deploy / staging).
 *
 * To bind a persistent MySQL service on TAS:
 *   cf create-service p.mysql db-small campaign-db
 *   cf bind-service sh-campaign-manager campaign-db
 *   cf restage sh-campaign-manager
 */
@Configuration
@Profile("cloud")
@Slf4j
public class CloudDataSourceConfig {

    @Bean
    @Primary
    public DataSource dataSource() {
        String vcapServices = System.getenv("VCAP_SERVICES");
        if (vcapServices != null && !vcapServices.isBlank()) {
            try {
                DataSource ds = buildMySqlDataSource(vcapServices);
                if (ds != null) {
                    log.info("CloudDataSource: using MySQL from bound VCAP_SERVICES");
                    return ds;
                }
            } catch (Exception e) {
                log.warn("CloudDataSource: could not parse VCAP_SERVICES ({}), falling back to H2", e.getMessage());
            }
        }
        log.info("CloudDataSource: no MySQL service bound — using H2 (data is ephemeral on restart)");
        return DataSourceBuilder.create()
                .url("jdbc:h2:file:./data/campaigndb;DB_CLOSE_ON_EXIT=FALSE;AUTO_RECONNECT=TRUE")
                .driverClassName("org.h2.Driver")
                .username("sa")
                .password("")
                .build();
    }

    /**
     * Searches every service entry in VCAP_SERVICES for a MySQL jdbcUrl.
     * Handles p.mysql (TAS), cleardb, and generic mysql service credential formats.
     */
    private DataSource buildMySqlDataSource(String vcapServices) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(vcapServices);

        for (JsonNode serviceList : root) {
            for (JsonNode service : serviceList) {
                JsonNode creds = service.path("credentials");

                // Try common jdbcUrl field names
                String jdbcUrl = firstNonNull(
                        creds.path("jdbcUrl").asText(null),
                        creds.path("jdbc_url").asText(null)
                );

                // Some tiles provide a URI like mysql://user:pass@host:port/db
                if (jdbcUrl == null) {
                    String uri = creds.path("uri").asText(null);
                    if (uri != null && uri.startsWith("mysql://")) {
                        jdbcUrl = "jdbc:" + uri;
                    }
                }

                if (jdbcUrl != null && jdbcUrl.contains("mysql")) {
                    String username = firstNonNull(
                            creds.path("username").asText(null),
                            creds.path("user").asText(null)
                    );
                    String password = creds.path("password").asText("");
                    return DataSourceBuilder.create()
                            .url(jdbcUrl)
                            .username(username)
                            .password(password)
                            .driverClassName("com.mysql.cj.jdbc.Driver")
                            .build();
                }
            }
        }
        return null;
    }

    private static String firstNonNull(String... values) {
        for (String v : values) {
            if (v != null && !v.isEmpty()) return v;
        }
        return null;
    }
}
