package com.campaignmanager.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

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
 *  3. getLibraryPath()  — returns the sysroot lib dirs for use in
 *                         Playwright.CreateOptions.setEnv(), so the Playwright
 *                         Node.js driver and Chromium subprocess pick up the libs.
 *
 * Runs only when the CF_INSTANCE_GUID / VCAP_APPLICATION env var is present (i.e.
 * running on CF). Skipped on local dev where system libs are already available.
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
            "libxfixes3", "libxi6", "libxrender1", "libxtst6",
            // transitive deps of the above
            "libavahi-common3", "libavahi-client3",  // required by libcups2
            "libwayland-server0",                     // required by libgbm1
            "libxcb-randr0"                           // required by libxrandr2
    );

    /** True when running in a Cloud Foundry container. */
    public boolean isCloudFoundry() {
        return System.getenv("CF_INSTANCE_GUID") != null
                || System.getenv("VCAP_APPLICATION") != null;
    }

    @PostConstruct
    public void setup() {
        if (!isCloudFoundry()) {
            log.debug("PlaywrightSystemDepsInstaller: not on CF, skipping.");
            return;
        }
        try {
            if (!Files.exists(MARKER)) {
                downloadAndExtract();
            } else {
                log.info("PlaywrightSystemDepsInstaller: libs already extracted, skipping download.");
            }
        } catch (Exception e) {
            log.error("PlaywrightSystemDepsInstaller: setup failed — {}", e.getMessage());
        }
    }

    /**
     * Returns the LD_LIBRARY_PATH value that includes the extracted sysroot lib dirs.
     * Returns null when not on CF (no patching needed on local dev).
     * Call this after {@link #setup()} to pass to {@code Playwright.CreateOptions.setEnv()}.
     */
    public String getLibraryPath() {
        if (!isCloudFoundry()) return null;
        String lib64   = SYSROOT.resolve("usr/lib/x86_64-linux-gnu").toString();
        String lib      = SYSROOT.resolve("usr/lib").toString();
        String current  = System.getenv("LD_LIBRARY_PATH");
        return lib64 + ":" + lib + (current != null ? ":" + current : "");
    }

    private void downloadAndExtract() throws Exception {
        log.info("PlaywrightSystemDepsInstaller: downloading Chromium system libs...");
        Files.createDirectories(DEBS);
        Files.createDirectories(SYSROOT);

        // apt-get needs a writable lists directory.  In CF containers the system
        // /var/lib/apt/lists/ is often empty or stale, so we run apt-get update
        // first, redirecting state to a writable path under DEPS_DIR.
        // No root is needed: update reads /etc/apt/sources.list (readable) and
        // writes only to the dirs we redirect below.
        Path aptLists = DEPS_DIR.resolve("apt-lists");
        Files.createDirectories(aptLists.resolve("partial"));

        // "-o" and the value MUST be separate list elements — ProcessBuilder does NOT
        // use a shell to split arguments, so "-o Key=val" as one string is rejected.
        String listsArg = "Dir::State::lists=" + aptLists.toAbsolutePath();

        log.info("PlaywrightSystemDepsInstaller: running apt-get update...");
        int updateRc = new ProcessBuilder("apt-get", "-o", listsArg, "-qq", "update")
                .directory(DEBS.toFile())
                .redirectErrorStream(true)
                .start()
                .waitFor();
        if (updateRc != 0) {
            log.warn("PlaywrightSystemDepsInstaller: apt-get update exit code {}; " +
                     "will still attempt download", updateRc);
        }

        // apt-get download saves .deb files to the current directory; no root needed.
        var cmd = new java.util.ArrayList<String>();
        cmd.add("apt-get");
        cmd.add("-o");
        cmd.add(listsArg);
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
        long extractedCount;
        try (var files = Files.list(DEBS)) {
            extractedCount = files.filter(f -> f.toString().endsWith(".deb"))
                    .peek(deb -> {
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
                    })
                    .count();
        }

        log.info("PlaywrightSystemDepsInstaller: extracted {} packages to {}", extractedCount, SYSROOT);
        if (extractedCount > 0) {
            Files.writeString(MARKER, "installed");
        } else {
            log.warn("PlaywrightSystemDepsInstaller: no packages extracted — marker NOT written, " +
                     "will retry on next startup");
        }
    }
}
