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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor 
@Slf4j
public class TrafficLightService {
    
    @Value("${traffic.sheet.url}")
    private String SHEET_URL;

    private final SimpMessagingTemplate messagingTemplate;
    
    // 1. THE RAM CACHE: HashMap maps Light ID to its latest TrafficLight object
    private Map<String, TrafficLight> latestDataCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadDataOnStartup() {
        fetchAndBroadcastData();
    }

    @Scheduled(fixedRate = 30000)
    public void fetchAndBroadcastData() {
        // Temporary map for the new batch
        Map<String, TrafficLight> currentBatch = new ConcurrentHashMap<>();
        long currentServerTime = System.currentTimeMillis(); 

        try {
            URL url = new URL(SHEET_URL);
            BufferedReader reader = new BufferedReader(new InputStreamReader(url.openStream()));
            String line;
            boolean isFirstRow = true;

            while ((line = reader.readLine()) != null) {
                if (isFirstRow) { isFirstRow = false; continue; }

                String[] columns = line.split(",");
                
                if (columns.length >= 10) {
                    String trafficLightId = columns[0].trim();
                    
                    if (trafficLightId.matches("\\d+")) {
                        try {
                            TrafficLight light = new TrafficLight();
                            light.setTrafficLightId(trafficLightId);
                            light.setLongitude(Double.parseDouble(columns[1].trim()));
                            light.setLatitude(Double.parseDouble(columns[2].trim()));
                            light.setCurrentSignal(columns[3].trim());
                            
                            // Leave as integers/strings, frontend handles validation for "SYNCING" state
                            light.setDurationRed(Integer.parseInt(columns[4].trim()));
                            light.setDurationYellow(Integer.parseInt(columns[5].trim()));
                            light.setDurationGreen(Integer.parseInt(columns[6].trim()));
                            light.setStartTime(columns[7].trim());
                            light.setDate(columns[8].trim());
                            light.setStatus(columns[9].trim());
                            light.setServerTimeMs(currentServerTime);

                            // Store in Map using ID as the key
                            currentBatch.put(trafficLightId, light);
                        } catch (NumberFormatException e) {
                            log.warn("Corrupted number format in row. Skipping: {}", line);
                        }
                    }
                }
            }
            reader.close();
            
            
            this.latestDataCache = currentBatch;
            
            // Blast the Map (JSON Object) to the frontend
            messagingTemplate.convertAndSend("/topic/trafficlogs", this.latestDataCache);
            log.info("Successfully fetched and broadcasted {} traffic lights.", this.latestDataCache.size());
            
        } catch (Exception e) {
            log.error("Failed to fetch traffic data: " + e.getMessage());
        }
    }

    public Map<String, TrafficLight> getLatestDataCache() {
        return latestDataCache;
    }
}