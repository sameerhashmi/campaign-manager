package com.campaignmanager.controller;

import com.campaignmanager.dto.EmailJobDto;
import com.campaignmanager.service.EmailJobService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/email-jobs")
@RequiredArgsConstructor
public class EmailJobController {

    private final EmailJobService emailJobService;

    @GetMapping
    public List<EmailJobDto> getAll(@RequestParam(required = false) String status) {
        return emailJobService.findAll(status);
    }

    @PostMapping("/{id}/retry")
    public EmailJobDto retry(@PathVariable Long id) {
        return emailJobService.retry(id);
    }
}
