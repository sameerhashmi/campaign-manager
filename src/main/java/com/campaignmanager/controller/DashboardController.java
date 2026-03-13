package com.campaignmanager.controller;

import com.campaignmanager.dto.DashboardStatsDto;
import com.campaignmanager.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public DashboardStatsDto getStats(Authentication auth) {
        return dashboardService.getStats(auth);
    }
}
