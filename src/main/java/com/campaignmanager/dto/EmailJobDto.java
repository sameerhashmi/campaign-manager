package com.campaignmanager.dto;

import com.campaignmanager.model.EmailJobStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class EmailJobDto {
    private Long id;
    private Long campaignContactId;
    private Long campaignId;
    private String campaignName;
    private Long contactId;
    private String contactName;
    private String contactEmail;
    private Integer stepNumber;
    private String subject;
    private String body;
    private LocalDateTime scheduledAt;
    private LocalDateTime sentAt;
    private EmailJobStatus status;
    private String errorMessage;
}
