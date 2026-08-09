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
EXPOSE 10000
ENTRYPOINT ["java", "-Xms32m", "-Xmx160m", "-XX:MaxMetaspaceSize=96m", "-XX:ReservedCodeCacheSize=32m", "-XX:MaxDirectMemorySize=32m", "-Xss512k", "-XX:+UseSerialGC", "-XX:+ExitOnOutOfMemoryError", "-Djava.security.egd=file:/dev/urandom", "-jar", "/app/app.jar"]
