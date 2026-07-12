package in.py.main.security;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class WebSecurityConfig {
	@Bean
	public PasswordEncoder passwordEncoder() {
	    return new BCryptPasswordEncoder();}
	    
	@Value("${dashboard.admin.username}")
	private String adminUsername;
	    
	@Value("${dashboard.admin.password}")
	private String adminPassword;
	    
	@Bean
	public UserDetailsService userDetailsService() {
	    	UserDetails admin= User.builder()
	    			.username(adminUsername)
	    			.password(passwordEncoder().encode(adminPassword))
	    			.roles("ADMIN")
	    			.build();
	    	return new InMemoryUserDetailsManager(admin);
	    }
	
	@Bean
	public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception{
		http
		.authorizeHttpRequests(auth-> auth
				.requestMatchers("/login.html", "/css/**","/js/**","/ws/**").permitAll()
				.anyRequest().authenticated()
				)
		.formLogin(form-> form
				.loginPage("/login.html")
				.loginProcessingUrl("/login")
				.defaultSuccessUrl("/index.html", true)
				.failureUrl("/login.html?error=true")
				.permitAll()
			
				)
		
		.logout(logout -> logout
                .logoutUrl("/logout") 
                .logoutSuccessUrl("/login.html?logout=true") 
                .invalidateHttpSession(true) 
                .deleteCookies("JSESSIONID") 
                .permitAll()
            )
		.csrf(csrf-> csrf.disable());
		
		
		
		return http.build();
	    
	}
	
	
	
	

}

