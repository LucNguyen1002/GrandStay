package com.grandstay.dashboard.application;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class DashboardApplicationServiceIntegrationTest {
    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired DashboardApplicationService dashboardService;

    @Test
    void returnsZeroMetricsForAnEmptyHotel() {
        var dashboard = dashboardService.dashboard(null, null);
        assertThat(dashboard.revenue()).isZero();
        assertThat(dashboard.occupancyRate()).isZero();
        assertThat(dashboard.totalRooms()).isZero();
        assertThat(dashboard.occupiedRooms()).isZero();
        assertThat(dashboard.revenueSeries()).isEmpty();
        assertThat(dashboard.topServices()).isEmpty();
    }
}
