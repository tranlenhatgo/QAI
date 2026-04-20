package com.myproject.quizzai.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SecurityCorsProperties.class)
public class SecurityConfig {

    private final SecurityCorsProperties securityCorsProperties;

    public SecurityConfig(SecurityCorsProperties securityCorsProperties) {
        this.securityCorsProperties = securityCorsProperties;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().permitAll()
                )
                .cors(Customizer.withDefaults());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration corsConfiguration = new CorsConfiguration();

        if (!securityCorsProperties.getAllowedOrigins().isEmpty()) {
            corsConfiguration.setAllowedOrigins(securityCorsProperties.getAllowedOrigins());
        }

        if (!securityCorsProperties.getAllowedOriginPatterns().isEmpty()) {
            corsConfiguration.setAllowedOriginPatterns(securityCorsProperties.getAllowedOriginPatterns());
        }

        if (!securityCorsProperties.getAllowedMethods().isEmpty()) {
            corsConfiguration.setAllowedMethods(securityCorsProperties.getAllowedMethods());
        }

        if (!securityCorsProperties.getAllowedHeaders().isEmpty()) {
            corsConfiguration.setAllowedHeaders(securityCorsProperties.getAllowedHeaders());
        }

        if (!securityCorsProperties.getExposedHeaders().isEmpty()) {
            corsConfiguration.setExposedHeaders(securityCorsProperties.getExposedHeaders());
        }

        corsConfiguration.setAllowCredentials(securityCorsProperties.isAllowCredentials());
        corsConfiguration.setMaxAge(securityCorsProperties.getMaxAge());

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfiguration);
        return source;
    }
}