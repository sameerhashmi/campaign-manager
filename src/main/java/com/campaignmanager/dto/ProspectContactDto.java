package com.campaignmanager.dto;

import lombok.Data;

@Data
public class ProspectContactDto {
    private Long id;
    private Long campaignPlanId;
    private String name;
    private String title;
    private String email;
    private String roleType;
    private String teamDomain;
    private String technicalStrengths;
    private String senioritySignal;
    private String influenceIndicators;
    private String source;
    private String tanzuRelevance;
    private String tanzuTeam;
    private Boolean selected;
    private int generatedEmailCount;
}
