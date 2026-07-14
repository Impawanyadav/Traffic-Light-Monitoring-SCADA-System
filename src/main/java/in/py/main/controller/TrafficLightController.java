package in.py.main.controller;

import in.py.main.dto.TrafficLight;
import in.py.main.service.TrafficLightService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/traffic")
@RequiredArgsConstructor
public class TrafficLightController {

    private final TrafficLightService trafficLightService;
    
    @GetMapping("/initial-data")
    public Map<String, TrafficLight> getInitialData() {
        return trafficLightService.getLatestDataCache();
    }
}