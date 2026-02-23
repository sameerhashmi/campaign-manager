package com.campaignmanager.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Installs Playwright/Chromium system library dependencies in Cloud Foundry.
 *
 * CF containers use cflinuxfs4 (Ubuntu 22.04) but do not pre-install graphics
 * and accessibility libs (libgbm1, libatk-bridge2.0-0, etc.) that Chromium needs.
 * Since we deploy a single JAR (path: dist/campaign-manager-1.0.0.jar), we cannot
 * use .profile.d scripts. Instead this bean runs at startup before Playwright.create():
 *
 *  1. apt-get download  — downloads .deb packages (no root needed; reads the
 *                         existing Ubuntu package lists in /var/lib/apt/lists/)
 *  2. dpkg-deb -x       — extracts .so files into ~/playwright-system-deps/sysroot/
 *                         (no root needed)
 *  3. Reflection patch  — prepends the sysroot lib dirs to LD_LIBRARY_PATH in the
 *                         live JVM environment so Playwright's Node.js driver and
 *                         Chromium subprocess inherit the updated path.
 *
 * Runs only when the CF_INSTANCE_GUID / VCAP_APPLICATION env var is present (i.e.
 * running on CF). Skipped on local dev where system libs are already available.
 *
 * Requires the JVM to be started with:
 *   --add-opens java.base/java.lang=ALL-UNNAMED
 * (set via JAVA_TOOL_OPTIONS in manifest.yml).
 */
@Component
@Slf4j
public class PlaywrightSystemDepsInstaller {

    static final Path DEPS_DIR =
            Path.of(System.getProperty("user.home"), "playwright-system-deps");
    private static final Path MARKER  = DEPS_DIR.resolve(".installed");
    private static final Path DEBS    = DEPS_DIR.resolve("debs");
    private static final Path SYSROOT = DEPS_DIR.resolve("sysroot");

    private static final List<String> PACKAGES = List.of(
            "libnss3", "libnspr4",
            "libatk1.0-0", "libatk-bridge2.0-0",
            "libcups2", "libatspi2.0-0",
            "libxcomposite1", "libxdamage1", "libxrandr2",
            "libgbm1", "libxkbcommon0", "libasound2",
            "libdrm2", "libpango-1.0-0", "libcairo2",
            "libxfixes3", "libxi6", "libxrender1", "libxtst6"
    );

    @PostConstruct
    public void setup() {
        if (!isCloudFoundry()) {
            log.debug("PlaywrightSystemDepsInstaller: not on CF, skipping.");
            return;
        }
        try {
            if (!Files.exists(MARKER)) {
                downloadAndExtract();
            }
            patchLibraryPath();
        } catch (Exception e) {
            log.error("PlaywrightSystemDepsInstaller: setup failed — {}", e.getMessage());
        }
    }

    private boolean isCloudFoundry() {
        return System.getenv("CF_INSTANCE_GUID") != null
                || System.getenv("VCAP_APPLICATION") != null;
    }

    private void downloadAndExtract() throws Exception {
        log.info("PlaywrightSystemDepsInstaller: downloading Chromium system libs...");
        Files.createDirectories(DEBS);
        Files.createDirectories(SYSROOT);

        // apt-get download saves .deb files to the current directory; no root needed.
        // The cflinuxfs4 stack image includes /var/lib/apt/lists/ so no apt-get update required.
        var cmd = new java.util.ArrayList<String>();
        cmd.add("apt-get");
        cmd.add("download");
        cmd.addAll(PACKAGES);

        int rc = new ProcessBuilder(cmd)
                .directory(DEBS.toFile())
                .redirectErrorStream(true)
                .start()
                .waitFor();

        if (rc != 0) {
            log.warn("PlaywrightSystemDepsInstaller: apt-get download exit code {}; " +
                     "some libs may be missing", rc);
        }

        // dpkg-deb -x extracts to an arbitrary directory; no root needed.
        try (var files = Files.list(DEBS)) {
            files.filter(f -> f.toString().endsWith(".deb")).forEach(deb -> {
                try {
                    new ProcessBuilder("dpkg-deb", "-x",
                            deb.toAbsolutePath().toString(),
                            SYSROOT.toAbsolutePath().toString())
                            .redirectErrorStream(true)
                            .start()
                            .waitFor();
                } catch (Exception e) {
                    log.warn("PlaywrightSystemDepsInstaller: failed to extract {}: {}",
                             deb.getFileName(), e.getMessage());
                }
            });
        }

        Files.writeString(MARKER, "installed");
        log.info("PlaywrightSystemDepsInstaller: libs extracted to {}", SYSROOT);
    }

    private void patchLibraryPath() {
        String lib64 = SYSROOT.resolve("usr/lib/x86_64-linux-gnu").toString();
        String lib   = SYSROOT.resolve("usr/lib").toString();
        String current = System.getenv("LD_LIBRARY_PATH");
        String updated = lib64 + ":" + lib + (current != null ? ":" + current : "");
        setEnvVar("LD_LIBRARY_PATH", updated);
        log.info("PlaywrightSystemDepsInstaller: LD_LIBRARY_PATH updated.");
    }

    /**
     * Modifies the live JVM process environment so that child processes (Playwright's
     * Node.js driver, Chromium) inherit the updated LD_LIBRARY_PATH.
     * Requires --add-opens java.base/java.lang=ALL-UNNAMED on JDK 17+.
     */
    @SuppressWarnings("unchecked")
    private void setEnvVar(String key, String value) {
        try {
            Class<?> pe = Class.forName("java.lang.ProcessEnvironment");
            Field f = pe.getDeclaredField("theEnvironment");
            f.setAccessible(true);
            ((Map<String, String>) f.get(null)).put(key, value);
        } catch (Exception e) {
            log.warn("PlaywrightSystemDepsInstaller: could not patch LD_LIBRARY_PATH " +
                     "via reflection ({}). Add --add-opens java.base/java.lang=ALL-UNNAMED " +
                     "to JAVA_TOOL_OPTIONS.", e.getMessage());
        }
    }
}
