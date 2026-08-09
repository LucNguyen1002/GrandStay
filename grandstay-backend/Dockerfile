# syntax=docker/dockerfile:1.7
FROM maven:3.9.11-eclipse-temurin-17-alpine AS build
WORKDIR /workspace
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp clean package

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S grandstay && adduser -S grandstay -G grandstay
WORKDIR /app
COPY --from=build --chown=grandstay:grandstay /workspace/target/grandstay-backend-*.jar app.jar
USER grandstay
EXPOSE 8080
ENTRYPOINT ["java", "-XX:InitialRAMPercentage=10.0", "-XX:MaxRAMPercentage=45.0", "-XX:MaxMetaspaceSize=128m", "-XX:ReservedCodeCacheSize=64m", "-Xss512k", "-XX:+UseSerialGC", "-XX:+ExitOnOutOfMemoryError", "-Djava.security.egd=file:/dev/urandom", "-jar", "/app/app.jar"]
