# syntax=docker/dockerfile:1

FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace

# Copy Maven wrapper + pom first for layer caching
COPY .mvn/ .mvn/
COPY mvnw mvnw
COPY pom.xml pom.xml

# Normalize line endings in case of CRLF + make wrapper executable
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw

# Download dependencies (cached)
RUN ./mvnw -q -DskipTests dependency:go-offline

# Now copy sources and build
COPY src/ src/
RUN ./mvnw -q -DskipTests package


FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=build /workspace/target/*.jar /app/app.jar

# The app currently reads Firebase credentials from a file path:
#   src/main/resources/serviceAccountKey.json
# We create the directory so it can be volume-mounted at runtime.
RUN mkdir -p /app/src/main/resources

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
