#!/bin/bash
# Packages the app and deploys to Pivotal Cloud Foundry / Tanzu Application Service.
# Usage: ./cf-push.sh

set -e

echo "==> Building application..."
mvn package -q

echo "==> Patching JAR manifest for CF java_buildpack_offline compatibility..."
# Spring Boot 3.2+ changed Main-Class to org.springframework.boot.loader.launch.JarLauncher.
# Broadcom java_buildpack_offline v4.87.0 only recognises the classic (pre-3.2) class name.
# This patch rewrites Main-Class in the JAR so the buildpack detects it as an executable JAR.
printf 'Main-Class: org.springframework.boot.loader.JarLauncher\n' > /tmp/cf-manifest-patch.txt
jar ufm target/campaign-manager-1.0.0.jar /tmp/cf-manifest-patch.txt
rm -f /tmp/cf-manifest-patch.txt
echo "   Main-Class patched to: org.springframework.boot.loader.JarLauncher"

echo "==> Assembling deployment directory..."
rm -rf dist
mkdir -p dist

# Copy the fat JAR
cp target/campaign-manager-1.0.0.jar dist/

# Copy the apt.yml so the apt-buildpack can install Chromium system libraries
cp apt.yml dist/

echo "==> Pushing to Cloud Foundry..."
cf push

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "IMPORTANT — Next steps for Gmail:"
echo ""
echo "1. On your LOCAL machine, start the app and go to Settings → Connect Gmail."
echo "   Log in to Gmail in the browser window that opens."
echo "   This creates: ./data/gmail-session.json"
echo ""
echo "2. Upload that session file to your PCF app:"
echo ""
echo "   cf ssh sh-campaign-manager -c 'cat > /home/vcap/app/data/gmail-session.json' < ./data/gmail-session.json"
echo ""
echo "   Or use the REST endpoint:"
echo "   cf curl /api/settings/gmail/upload-session -X POST -F 'file=@./data/gmail-session.json'"
echo ""
echo "   Or use the Settings page upload button in the app."
echo ""
echo "NOTE: PCF containers are ephemeral — the session file and H2 database are wiped"
echo "on restart/restage. Bind a persistent-disk or database service for production use."
