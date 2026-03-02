package com.campaignmanager.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ConnectedSessionDto {
    private String email;
    private LocalDateTime connectedAt;
    private int campaignCount;
}
