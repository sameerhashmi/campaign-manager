package com.campaignmanager.service;

import com.campaignmanager.dto.ContactDto;
import com.campaignmanager.model.CampaignContact;
import com.campaignmanager.model.Contact;
import com.campaignmanager.model.User;
import com.campaignmanager.repository.CampaignContactRepository;
import com.campaignmanager.repository.ContactRepository;
import com.campaignmanager.repository.EmailJobRepository;
import com.campaignmanager.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final ContactRepository contactRepository;
    private final CampaignContactRepository campaignContactRepository;
    private final EmailJobRepository emailJobRepository;
    private final UserRepository userRepository;

    private boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private User resolveOwner(Authentication auth) {
        return userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    public List<ContactDto> findAll(String search, Authentication auth) {
        if (isAdmin(auth)) {
            List<Contact> contacts = (search != null && !search.isBlank())
                    ? contactRepository.searchContacts(search)
                    : contactRepository.findAll();
            return contacts.stream().map(this::toDto).collect(Collectors.toList());
        }
        User owner = resolveOwner(auth);
        List<Contact> contacts = (search != null && !search.isBlank())
                ? contactRepository.searchContactsByOwner(search, owner)
                : contactRepository.findAllByOwner(owner);
        return contacts.stream().map(this::toDto).collect(Collectors.toList());
    }

    public ContactDto findById(Long id) {
        return toDto(contactRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contact not found: " + id)));
    }

    @Transactional
    public ContactDto create(ContactDto dto, Authentication auth) {
        if (isAdmin(auth)) {
            if (contactRepository.existsByEmail(dto.getEmail())) {
                throw new RuntimeException("Contact with email already exists: " + dto.getEmail());
            }
            Contact contact = new Contact();
            mapDtoToEntity(dto, contact);
            contact.setCreatedAt(LocalDateTime.now());
            return toDto(contactRepository.save(contact));
        }
        User owner = resolveOwner(auth);
        if (contactRepository.existsByEmailAndOwner(dto.getEmail(), owner)) {
            throw new RuntimeException("Contact with email already exists: " + dto.getEmail());
        }
        Contact contact = new Contact();
        mapDtoToEntity(dto, contact);
        contact.setOwner(owner);
        contact.setCreatedAt(LocalDateTime.now());
        return toDto(contactRepository.save(contact));
    }

    @Transactional
    public ContactDto update(Long id, ContactDto dto, Authentication auth) {
        Contact contact = contactRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contact not found: " + id));
        if (!isAdmin(auth)) {
            User owner = resolveOwner(auth);
            if (contact.getOwner() == null || !contact.getOwner().getId().equals(owner.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
            }
            if (!contact.getEmail().equals(dto.getEmail()) &&
                    contactRepository.existsByEmailAndOwner(dto.getEmail(), owner)) {
                throw new RuntimeException("Email already in use: " + dto.getEmail());
            }
        } else if (!contact.getEmail().equals(dto.getEmail()) && contactRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Email already in use: " + dto.getEmail());
        }
        mapDtoToEntity(dto, contact);
        return toDto(contactRepository.save(contact));
    }

    @Transactional
    public void delete(Long id, Authentication auth) {
        Contact contact = contactRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contact not found: " + id));
        if (!isAdmin(auth)) {
            User owner = resolveOwner(auth);
            if (contact.getOwner() == null || !contact.getOwner().getId().equals(owner.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
            }
        }
        List<CampaignContact> ccs = campaignContactRepository.findByContactId(id);
        campaignContactRepository.deleteAll(ccs);
        contactRepository.deleteById(id);
    }

    /**
     * Upsert by email scoped to owner — used during imports.
     */
    @Transactional
    public Contact upsertByEmail(ContactDto dto, User owner) {
        Contact contact = (owner != null)
                ? contactRepository.findByEmailAndOwner(dto.getEmail(), owner).orElseGet(() -> {
                    Contact c = new Contact();
                    c.setCreatedAt(LocalDateTime.now());
                    c.setOwner(owner);
                    return c;
                })
                : contactRepository.findByEmail(dto.getEmail()).orElseGet(() -> {
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
        dto.setScheduledJobCount((int) emailJobRepository.countScheduledByContactId(c.getId()));
        if (c.getOwner() != null) dto.setOwnerUsername(c.getOwner().getUsername());
        return dto;
    }
}
