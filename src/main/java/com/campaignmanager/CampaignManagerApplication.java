package com.campaignmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CampaignManagerApplication {
    public static void main(String[] args) {
        SpringApplication.run(CampaignManagerApplication.class, args);
    }
}
