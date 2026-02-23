#!/bin/bash
# Packages the app and deploys to Pivotal Cloud Foundry / Tanzu Application Service.
# Usage: ./cf-push.sh

set -e

echo "==> Building application..."
mvn package -q

echo "==> Assembling deployment directory..."
rm -rf dist
mkdir -p dist

# Copy the fat JAR
cp target/campaign-manager-1.0.0.jar dist/

# Add .profile.d startup script that installs Playwright system libs at runtime.
# Uses apt-get download (no root required) + dpkg-deb -x (no root required).
# This avoids the need for apt-buildpack as a supply buildpack, which breaks
# java_buildpack_offline's container detection in multi-buildpack mode.
mkdir -p dist/.profile.d
cp scripts/playwright-deps.sh dist/.profile.d/
chmod +x dist/.profile.d/playwright-deps.sh

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
