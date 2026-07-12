package in.py.main;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TrafficLight {

	public static void main(String[] args) {
		SpringApplication.run(TrafficLight.class, args);
	}

}
