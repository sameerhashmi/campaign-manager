package com.campaignmanager.util;

import java.time.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Computes the fixed 7-email send schedule starting from a given date.
 *
 * Schedule (all times Eastern):
 *   Email 1: Next Wednesday  09:00
 *   Email 2: Following Tuesday  09:00
 *   Email 3: Following Thursday 09:00
 *   Email 4: Following Tuesday  12:00
 *   Email 5: Following Thursday 09:00
 *   Email 6: Following Tuesday  13:00
 *   Email 7: Following Thursday 16:00
 */
public class EmailScheduleCalculator {

    private static final ZoneId EASTERN = ZoneId.of("America/New_York");

    private EmailScheduleCalculator() {}

    /**
     * Returns 7 UTC LocalDateTimes representing the scheduled send times,
     * starting from the first Wednesday on or after {@code from}.
     */
    public static List<LocalDateTime> calculateSchedule(LocalDate from) {
        // Step definitions: [DayOfWeek, hourEST]
        int[][] steps = {
            { DayOfWeek.WEDNESDAY.getValue(), 9 },
            { DayOfWeek.TUESDAY.getValue(),   9 },
            { DayOfWeek.THURSDAY.getValue(),  9 },
            { DayOfWeek.TUESDAY.getValue(),  12 },
            { DayOfWeek.THURSDAY.getValue(),  9 },
            { DayOfWeek.TUESDAY.getValue(),  13 },
            { DayOfWeek.THURSDAY.getValue(), 16 },
        };

        List<LocalDateTime> schedule = new ArrayList<>();
        LocalDate cursor = from;

        for (int[] step : steps) {
            DayOfWeek targetDay = DayOfWeek.of(step[0]);
            int hour = step[1];

            // Advance cursor to the target day (if cursor is already that day, move to next occurrence)
            if (!schedule.isEmpty()) {
                // After first email, always advance past the previous week's date
                cursor = cursor.plusDays(1);
            }
            while (cursor.getDayOfWeek() != targetDay) {
                cursor = cursor.plusDays(1);
            }

            // Convert Eastern time to local (server) time stored as-is in DB
            ZonedDateTime eastern = ZonedDateTime.of(cursor, LocalTime.of(hour, 0), EASTERN);
            schedule.add(eastern.toLocalDateTime());
        }

        return schedule;
    }
}
