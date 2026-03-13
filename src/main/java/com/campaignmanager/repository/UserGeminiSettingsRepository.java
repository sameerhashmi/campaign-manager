package com.campaignmanager.repository;

import com.campaignmanager.model.User;
import com.campaignmanager.model.UserGeminiSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserGeminiSettingsRepository extends JpaRepository<UserGeminiSettings, Long> {
    Optional<UserGeminiSettings> findByUser(User user);
}
