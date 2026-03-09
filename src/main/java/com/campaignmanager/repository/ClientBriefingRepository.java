package com.campaignmanager.repository;

import com.campaignmanager.model.ClientBriefing;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClientBriefingRepository extends JpaRepository<ClientBriefing, Long> {

    List<ClientBriefing> findAllByOrderByCreatedAtDesc();
}
