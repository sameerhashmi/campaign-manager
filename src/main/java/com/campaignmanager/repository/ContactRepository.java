package com.campaignmanager.repository;

import com.campaignmanager.model.Contact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ContactRepository extends JpaRepository<Contact, Long> {
    Optional<Contact> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query("SELECT c FROM Contact c WHERE " +
           "(:search IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.company) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Contact> searchContacts(@Param("search") String search);
}
