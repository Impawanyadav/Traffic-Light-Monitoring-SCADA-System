package in.py.main.service;

import in.py.main.dto.TrafficLight; 
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor 
@Slf4j
public class TrafficLightService {
	
	@Value("${traffic.sheet.url}")
    private String SHEET_URL;

    // Add your Traffic Light Google Sheet CSV link here
   // private final String SHEET_URL = ""
    private final SimpMessagingTemplate messagingTemplate;
    
    // 1. THE RAM CACHE: Holds the latest data for instant frontend loading
    private List<TrafficLight> latestDataCache = new ArrayList<>();

    @PostConstruct
    public void loadDataOnStartup() {
        fetchAndBroadcastData();
    }

    @Scheduled(fixedRate = 30000) // 30 second refresh for massive scale
    public void fetchAndBroadcastData() {
        List<TrafficLight> allLogs = new ArrayList<>();
        
        // HYBRID EDGE ANCHOR: Capture the exact server time for this batch
        long currentServerTime = System.currentTimeMillis(); 

        try {
            URL url = new URL(SHEET_URL);
            BufferedReader reader = new BufferedReader(new InputStreamReader(url.openStream()));
            String line;
            boolean isFirstRow = true;

            while ((line = reader.readLine()) != null) {
                if (isFirstRow) { isFirstRow = false; continue; }

                String[] columns = line.split(",");
                
                // Traffic spreadsheet now has 10 columns
                if (columns.length >= 10) {
                    String trafficLightId = columns[0].trim();
                    
                    // 2. THE ID CHECK: Only process if the ID is a valid number
                    if (trafficLightId.matches("\\d+")) {
                        try {
                            TrafficLight light = new TrafficLight();
                            light.setTrafficLightId(trafficLightId);
                            light.setLongitude(Double.parseDouble(columns[1].trim()));
                            light.setLatitude(Double.parseDouble(columns[2].trim()));
                            light.setCurrentSignal(columns[3].trim());
                            light.setDurationRed(Integer.parseInt(columns[4].trim()));
                            light.setDurationYellow(Integer.parseInt(columns[5].trim()));
                            light.setDurationGreen(Integer.parseInt(columns[6].trim()));
                            
                            // Added the new Edge Computing Anchor points
                            light.setStartTime(columns[7].trim());
                            light.setDate(columns[8].trim());
                            
                            // Status shifted to index 9
                            light.setStatus(columns[9].trim());
                            
                            // Inject the Server Clock sync
                            light.setServerTimeMs(currentServerTime);

                            allLogs.add(light);
                        } catch (NumberFormatException e) {
                            // Backend Data Shield for duration/longitude corruption
                            log.warn("Corrupted number format in row. Skipping: {}", line);
                        }
                    }
                }
            }
            reader.close();
            
            // 3. UPDATE THE CACHE
            this.latestDataCache = allLogs;
            
            // Blast the final array to the frontend WebSocket tunnel
            messagingTemplate.convertAndSend("/topic/trafficlogs", allLogs);
            log.info("Successfully fetched and broadcasted {} traffic logs.", allLogs.size());
            
        } catch (Exception e) {
            log.error("Failed to fetch traffic data: " + e.getMessage());
        }
    }

    // 4. GETTER FOR REST CONTROLLER
    public List<TrafficLight> getLatestDataCache() {
        return latestDataCache;
    }
}