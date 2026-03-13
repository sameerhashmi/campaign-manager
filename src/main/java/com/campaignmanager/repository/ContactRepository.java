package com.campaignmanager.repository;

import com.campaignmanager.model.Contact;
import com.campaignmanager.model.User;
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

    Optional<Contact> findByEmailAndOwner(String email, User owner);
    boolean existsByEmailAndOwner(String email, User owner);
    List<Contact> findAllByOwner(User owner);
    long countByOwner(User owner);

    @Query("SELECT c FROM Contact c WHERE c.owner = :owner AND " +
           "(:search IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(c.company) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Contact> searchContactsByOwner(@Param("search") String search, @Param("owner") User owner);
}
