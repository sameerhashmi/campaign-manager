package com.campaignmanager.service;

import com.campaignmanager.dto.GemDto;
import com.campaignmanager.model.Gem;
import com.campaignmanager.model.User;
import com.campaignmanager.repository.GemRepository;
import com.campaignmanager.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GemService {

    private final GemRepository gemRepository;
    private final UserRepository userRepository;

    public List<GemDto> findAll(Authentication auth) {
        User owner = resolveUser(auth);
        return gemRepository.findAllByOwner(owner).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<GemDto> findByType(Authentication auth, String gemType) {
        User owner = resolveUser(auth);
        return gemRepository.findAllByOwnerAndGemType(owner, gemType).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public GemDto create(GemDto dto, Authentication auth) {
        User owner = resolveUser(auth);
        Gem gem = new Gem();
        gem.setOwner(owner);
        mapDto(dto, gem);
        return toDto(gemRepository.save(gem));
    }

    public GemDto update(Long id, GemDto dto, Authentication auth) {
        User owner = resolveUser(auth);
        Gem gem = gemRepository.findByIdAndOwner(id, owner)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gem not found"));
        mapDto(dto, gem);
        return toDto(gemRepository.save(gem));
    }

    public void delete(Long id, Authentication auth) {
        User owner = resolveUser(auth);
        Gem gem = gemRepository.findByIdAndOwner(id, owner)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gem not found"));
        gemRepository.delete(gem);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    public GemDto toDto(Gem gem) {
        GemDto dto = new GemDto();
        dto.setId(gem.getId());
        dto.setName(gem.getName());
        dto.setDescription(gem.getDescription());
        dto.setSystemInstructions(gem.getSystemInstructions());
        dto.setGemType(gem.getGemType());
        return dto;
    }

    private void mapDto(GemDto dto, Gem gem) {
        gem.setName(dto.getName());
        gem.setDescription(dto.getDescription());
        gem.setSystemInstructions(dto.getSystemInstructions());
        gem.setGemType(dto.getGemType());
    }

    private User resolveUser(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
