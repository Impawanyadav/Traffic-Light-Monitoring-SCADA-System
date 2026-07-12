package in.py.main.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TrafficLight {
	private String trafficLightId;  // Column A (0)
    private double longitude;       // Column B (1)
    private double latitude;        // Column C (2)
    private String currentSignal;   // Column D (3)
    private int durationRed;        // Column E (4)
    private int durationYellow;     // Column F (5)
    private int durationGreen;      // Column G (6)
    private String startTime;       // Column H (7)
    private String date;            // Column I (8)
    private String status;
    private long serverTimeMs;
}