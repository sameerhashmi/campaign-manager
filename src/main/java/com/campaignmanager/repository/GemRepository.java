package com.campaignmanager.repository;

import com.campaignmanager.model.Gem;
import com.campaignmanager.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GemRepository extends JpaRepository<Gem, Long> {
    List<Gem> findAllByOwner(User owner);
    List<Gem> findAllByOwnerAndGemType(User owner, String gemType);
    Optional<Gem> findByIdAndOwner(Long id, User owner);
}
