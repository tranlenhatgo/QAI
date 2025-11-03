package com.myproject.quizzai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class QuizzAiOnlineApplication {
	private static final Logger logger = LoggerFactory.getLogger(QuizzAiOnlineApplication.class);


	public static void main(String[] args) {
		SpringApplication.run(QuizzAiOnlineApplication.class, args);
		logger.info("QuizzAiOnlineApplication has started successfully.");
	}

}
//GOOGLE_CLOUD_PROJECT=quizzai-bc49d
//GOOGLE_APPLICATION_CREDENTIALS=.serviceAccountKey.json