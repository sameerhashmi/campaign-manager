package com.campaignmanager.controller;

import com.campaignmanager.dto.ClientBriefingDto;
import com.campaignmanager.model.ClientBriefing;
import com.campaignmanager.service.ClientBriefingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/client-briefings")
@RequiredArgsConstructor
@Slf4j
public class ClientBriefingController {

    private final ClientBriefingService briefingService;

    @GetMapping
    public List<ClientBriefingDto> getAll() {
        return briefingService.findAll();
    }

    @GetMapping("/{id}")
    public ClientBriefingDto getById(@PathVariable Long id) {
        return briefingService.findById(id);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ClientBriefingDto> create(
            @RequestParam("clientName") String clientName,
            @RequestParam(value = "documentLink", required = false) String documentLink,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        try {
            ClientBriefingDto created = briefingService.create(clientName, documentLink, file);
            return ResponseEntity.ok(created);
        } catch (IOException e) {
            log.error("Failed to save briefing file: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        briefingService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Serves the uploaded document file.
     * PDF and HTML open inline in the browser; DOC/DOCX trigger a download.
     */
    @GetMapping("/{id}/document")
    public ResponseEntity<Resource> serveDocument(@PathVariable Long id) {
        ClientBriefing briefing = briefingService.getEntity(id);
        if (briefing.getUploadedFileName() == null) {
            return ResponseEntity.notFound().build();
        }

        Path filePath = briefingService.getFilePath(id);
        Resource resource = new FileSystemResource(filePath);
        if (!resource.exists()) {
            log.warn("Briefing file not found on disk: {}", filePath);
            return ResponseEntity.notFound().build();
        }

        String originalName = briefing.getOriginalFileName() != null
                ? briefing.getOriginalFileName() : briefing.getUploadedFileName();
        String lower = originalName.toLowerCase();

        MediaType mediaType;
        ContentDisposition disposition;

        if (lower.endsWith(".pdf")) {
            mediaType = MediaType.APPLICATION_PDF;
            disposition = ContentDisposition.inline().filename(originalName).build();
        } else if (lower.endsWith(".html") || lower.endsWith(".htm")) {
            mediaType = MediaType.TEXT_HTML;
            disposition = ContentDisposition.inline().filename(originalName).build();
        } else if (lower.endsWith(".doc")) {
            mediaType = MediaType.parseMediaType("application/msword");
            disposition = ContentDisposition.attachment().filename(originalName).build();
        } else if (lower.endsWith(".docx")) {
            mediaType = MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            disposition = ContentDisposition.attachment().filename(originalName).build();
        } else {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
            disposition = ContentDisposition.attachment().filename(originalName).build();
        }

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(resource);
    }
}
