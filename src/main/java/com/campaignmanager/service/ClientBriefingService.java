package com.campaignmanager.service;

import com.campaignmanager.dto.ClientBriefingDto;
import com.campaignmanager.model.ClientBriefing;
import com.campaignmanager.repository.ClientBriefingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ClientBriefingService {

    private final ClientBriefingRepository briefingRepository;

    public List<ClientBriefingDto> findAll() {
        return briefingRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public ClientBriefingDto findById(Long id) {
        return toDto(getEntity(id));
    }

    @Transactional
    public ClientBriefingDto create(String clientName, String documentLink, MultipartFile file) throws IOException {
        ClientBriefing briefing = new ClientBriefing();
        briefing.setClientName(clientName.trim());
        briefing.setDocumentLink(documentLink != null && !documentLink.isBlank() ? documentLink.trim() : null);
        briefing.setCreatedAt(LocalDateTime.now());

        // Save first to get the generated id for the filename prefix
        briefing = briefingRepository.save(briefing);

        if (file != null && !file.isEmpty()) {
            String originalName = file.getOriginalFilename();
            String storedName = briefing.getId() + "_" + System.currentTimeMillis() + "_" + sanitize(originalName);

            briefing.setUploadedFileName(storedName);
            briefing.setOriginalFileName(originalName);
            briefing.setMimeType(file.getContentType());
            briefing.setFileContent(file.getBytes());
            briefing = briefingRepository.save(briefing);
            log.info("Saved briefing file {} ({} bytes) to DB", storedName, file.getSize());
        }

        return toDto(briefing);
    }

    @Transactional
    public void delete(Long id) {
        briefingRepository.deleteById(id);
    }

    public ClientBriefing getEntity(Long id) {
        return briefingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client briefing not found: " + id));
    }

    public ClientBriefingDto toDto(ClientBriefing b) {
        ClientBriefingDto dto = new ClientBriefingDto();
        dto.setId(b.getId());
        dto.setClientName(b.getClientName());
        dto.setDocumentLink(b.getDocumentLink());
        dto.setUploadedFileName(b.getUploadedFileName());
        dto.setOriginalFileName(b.getOriginalFileName());
        dto.setCreatedAt(b.getCreatedAt());
        if (b.getUploadedFileName() != null) {
            dto.setDocumentUrl("/api/client-briefings/" + b.getId() + "/document");
        }
        return dto;
    }

    private String sanitize(String filename) {
        if (filename == null) return "file";
        return filename.replaceAll("[^a-zA-Z0-9._\\-]", "_");
    }
}
