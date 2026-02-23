#!/bin/bash
# Installs Playwright/Chromium system library dependencies at app startup.
# Uses apt-get download (no root required) + dpkg-deb -x (no root required).
# Runs once; on subsequent restarts the extracted libs are already present.

DEPS_DIR="${HOME}/playwright-system-deps"

if [ ! -f "${DEPS_DIR}/.installed" ]; then
  echo "[playwright-deps] Installing Chromium system library dependencies..."
  mkdir -p "${DEPS_DIR}/debs"
  mkdir -p "${DEPS_DIR}/sysroot"

  cd "${DEPS_DIR}/debs"

  # Download .deb packages without installing (no root required).
  # apt-get download works without running apt-get update first when the
  # CF stack (cflinuxfs4 / Ubuntu 22.04) already has up-to-date package lists.
  apt-get download \
    libnss3 libnspr4 \
    libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libatspi2.0-0 \
    libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libxkbcommon0 libasound2 \
    libdrm2 libpango-1.0-0 libcairo2 \
    libxext6 libxfixes3 libxi6 libxrender1 libxtst6 \
    2>/dev/null || echo "[playwright-deps] Warning: some packages could not be downloaded"

  # Extract without installing (no root required).
  for deb in *.deb; do
    [ -f "$deb" ] && dpkg-deb -x "$deb" "${DEPS_DIR}/sysroot" 2>/dev/null || true
  done

  touch "${DEPS_DIR}/.installed"
  echo "[playwright-deps] Done."
fi

# Make the extracted libs visible to the JVM / Chromium process.
export LD_LIBRARY_PATH="${DEPS_DIR}/sysroot/usr/lib/x86_64-linux-gnu:${DEPS_DIR}/sysroot/usr/lib:${LD_LIBRARY_PATH}"
