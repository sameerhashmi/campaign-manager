package com.campaignmanager.dto;

import lombok.Data;
import java.util.List;

@Data
public class BulkContactAssignDto {
    private List<Long> contactIds;
}
