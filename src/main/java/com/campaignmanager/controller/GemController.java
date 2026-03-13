package com.campaignmanager.controller;

import com.campaignmanager.dto.GemDto;
import com.campaignmanager.service.GemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/gems")
@RequiredArgsConstructor
public class GemController {

    private final GemService gemService;

    @GetMapping
    public List<GemDto> getAll(Authentication auth,
                                @RequestParam(required = false) String type) {
        if (type != null && !type.isBlank()) {
            return gemService.findByType(auth, type);
        }
        return gemService.findAll(auth);
    }

    @PostMapping
    public ResponseEntity<GemDto> create(@RequestBody GemDto dto, Authentication auth) {
        return ResponseEntity.ok(gemService.create(dto, auth));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GemDto> update(@PathVariable Long id,
                                          @RequestBody GemDto dto,
                                          Authentication auth) {
        return ResponseEntity.ok(gemService.update(id, dto, auth));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        gemService.delete(id, auth);
        return ResponseEntity.noContent().build();
    }
}
