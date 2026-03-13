package com.campaignmanager.repository;

import com.campaignmanager.model.GeneratedEmail;
import com.campaignmanager.model.ProspectContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GeneratedEmailRepository extends JpaRepository<GeneratedEmail, Long> {
    List<GeneratedEmail> findAllByProspectContactOrderByStepNumber(ProspectContact prospectContact);
    void deleteAllByProspectContact(ProspectContact prospectContact);
}
