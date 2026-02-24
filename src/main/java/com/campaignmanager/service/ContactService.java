package com.campaignmanager.service;

import com.campaignmanager.dto.ContactDto;
import com.campaignmanager.model.Contact;
import com.campaignmanager.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;

    public List<ContactDto> findAll(String search) {
        List<Contact> contacts = (search != null && !search.isBlank())
                ? contactRepository.searchContacts(search)
                : contactRepository.findAll();
        return contacts.stream().map(this::toDto).collect(Collectors.toList());
    }

    public ContactDto findById(Long id) {
        return toDto(contactRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contact not found: " + id)));
    }

    @Transactional
    public ContactDto create(ContactDto dto) {
        if (contactRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Contact with email already exists: " + dto.getEmail());
        }
        Contact contact = new Contact();
        mapDtoToEntity(dto, contact);
        contact.setCreatedAt(LocalDateTime.now());
        return toDto(contactRepository.save(contact));
    }

    @Transactional
    public ContactDto update(Long id, ContactDto dto) {
        Contact contact = contactRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contact not found: " + id));
        // If email changed, check for uniqueness
        if (!contact.getEmail().equals(dto.getEmail()) && contactRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Email already in use: " + dto.getEmail());
        }
        mapDtoToEntity(dto, contact);
        return toDto(contactRepository.save(contact));
    }

    @Transactional
    public void delete(Long id) {
        contactRepository.deleteById(id);
    }

    /**
     * Upsert by email — used during CSV import.
     */
    @Transactional
    public Contact upsertByEmail(ContactDto dto) {
        Contact contact = contactRepository.findByEmail(dto.getEmail())
                .orElseGet(() -> {
                    Contact c = new Contact();
                    c.setCreatedAt(LocalDateTime.now());
                    return c;
                });
        mapDtoToEntity(dto, contact);
        return contactRepository.save(contact);
    }

    private void mapDtoToEntity(ContactDto dto, Contact contact) {
        contact.setName(dto.getName());
        contact.setEmail(dto.getEmail());
        contact.setRole(dto.getRole());
        contact.setCompany(dto.getCompany());
        contact.setCategory(dto.getCategory());
        contact.setPhone(dto.getPhone());
        contact.setPlay(dto.getPlay());
        contact.setSubPlay(dto.getSubPlay());
        contact.setAeRole(dto.getAeRole());
        contact.setEmailLink(dto.getEmailLink());
    }

    public ContactDto toDto(Contact c) {
        ContactDto dto = new ContactDto();
        dto.setId(c.getId());
        dto.setName(c.getName());
        dto.setEmail(c.getEmail());
        dto.setRole(c.getRole());
        dto.setCompany(c.getCompany());
        dto.setCategory(c.getCategory());
        dto.setPhone(c.getPhone());
        dto.setPlay(c.getPlay());
        dto.setSubPlay(c.getSubPlay());
        dto.setAeRole(c.getAeRole());
        dto.setEmailLink(c.getEmailLink());
        dto.setCreatedAt(c.getCreatedAt());
        return dto;
    }
}
