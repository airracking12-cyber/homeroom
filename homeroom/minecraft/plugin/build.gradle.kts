plugins {
    java
}

group = "dev.homeroom"
version = "1.0.0"

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    // Only the standard Bukkit/Paper API is used (no server internals), so updates rarely break it.
    compileOnly("io.papermc.paper:paper-api:${property("paperApi")}")
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(property("javaVersion").toString().toInt()))
}

tasks.processResources {
    filesMatching("plugin.yml") { expand("version" to project.version) }
}
