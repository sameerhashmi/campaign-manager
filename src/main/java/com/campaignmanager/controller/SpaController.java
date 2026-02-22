package com.campaignmanager.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Forwards Angular client-side routes to index.html so the Angular router
 * handles them. API routes (/api/**) and static assets are handled before
 * this controller is reached.
 */
@Controller
public class SpaController {

    @GetMapping(value = {
        "/",
        "/login",
        "/dashboard",
        "/campaigns",
        "/campaigns/**",
        "/contacts",
        "/contacts/**",
        "/settings"
    })
    public String index() {
        return "forward:/index.html";
    }
}
