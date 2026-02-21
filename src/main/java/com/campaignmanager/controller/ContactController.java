package com.campaignmanager.controller;

import com.campaignmanager.dto.ContactDto;
import com.campaignmanager.dto.CsvImportResultDto;
import com.campaignmanager.service.ContactService;
import com.campaignmanager.service.CsvImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;
    private final CsvImportService csvImportService;

    @GetMapping
    public List<ContactDto> getAll(@RequestParam(required = false) String search) {
        return contactService.findAll(search);
    }

    @GetMapping("/{id}")
    public ContactDto getById(@PathVariable Long id) {
        return contactService.findById(id);
    }

    @PostMapping
    public ContactDto create(@Valid @RequestBody ContactDto dto) {
        return contactService.create(dto);
    }

    @PutMapping("/{id}")
    public ContactDto update(@PathVariable Long id, @Valid @RequestBody ContactDto dto) {
        return contactService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        contactService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import")
    public CsvImportResultDto importContacts(@RequestParam("file") MultipartFile file) {
        return csvImportService.importContacts(file);
    }
}
