# Campaign Manager

A full-stack email campaign management application built with **Spring Boot 3** and **Angular 17**. Automates sending personalized email sequences via **Gmail web UI using Playwright**. Everything ships as a **single runnable JAR** — no separate frontend server needed.

---

## Features

- **Campaign Dashboard** — Stats cards showing campaigns, contacts, emails sent/pending/failed
- **Campaign Management** — Create, launch, pause, and resume campaigns with multi-step email sequences
- **Custom Send Scheduling** — Set an exact **date and time** for each email step (e.g. Step 1: June 1 at 9 AM, Step 2: June 5 at 2 PM)
- **Personalization Tokens** — Use `{{name}}`, `{{role}}`, `{{company}}`, `{{category}}` in subject and body
- **Contact Management** — Add contacts individually or bulk-import via Excel (`.xlsx`)
- **Gmail Session Login** — Log in to Gmail once via Settings; Playwright saves the session and reuses it for all sends — no stored passwords
- **Status Tracking** — Every email job shows SCHEDULED, SENT, FAILED status with retry support
- **Single JAR Deployment** — Angular is bundled into the Spring Boot JAR at build time

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 17+ | OpenJDK or Oracle JDK |
| Maven | 3.8+ | Or use the included `mvnw` wrapper |
| Git | Any | To clone the repository |

> **Node.js is NOT required globally** — the build downloads Node 20 automatically via `frontend-maven-plugin`.

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/campaign-manager.git
cd campaign-manager
```

### 2. Build

```bash
mvn package -DskipTests
```

This will:
1. Download Node 20 + npm (first time only)
2. Install Angular dependencies (`npm install`)
3. Build Angular (`ng build`) → output into `src/main/resources/static/`
4. Package everything into `target/campaign-manager-1.0.0.jar`

### 3. Run

```bash
java -jar target/campaign-manager-1.0.0.jar
```

Open your browser at: **http://localhost:8080**

### 4. Default login credentials

| Username | Password |
|----------|----------|
| `admin`  | `admin123` |

> Change these in `DataInitializer.java` before deploying.

---

## First-Time Gmail Setup

Before sending any emails you need to connect your Gmail account once:

1. Log into the app and navigate to **Settings** (gear icon in the sidebar)
2. Click **Connect Gmail**
3. A Chromium browser window opens — log into your Gmail account normally
4. Once you reach the Gmail inbox, the session is automatically saved
5. The Settings page shows **Connected** — you're done

The session is saved to `./data/gmail-session.json`. Playwright reuses it for every send. No username or password is ever stored in the database.

> **If Gmail prompts for 2-factor auth**, complete it in the browser window. The app waits up to 2 minutes.

---

## Creating a Campaign (Step-by-Step)

1. **Connect Gmail** in Settings (one-time setup above)
2. Go to **Campaigns → New Campaign**
3. Enter a campaign name and optionally your Gmail address (for reference)
4. Optionally upload an Excel file to import contacts and templates in one step (see Excel format below)
5. Click **Create Campaign**
6. In the campaign detail, go to the **Email Templates** tab
7. Click **Add Step** for each email in your sequence:
   - Set the **Step Number**, **Subject**, and **Body**
   - Set the **Send Date & Time** — the exact datetime to send this email (e.g. June 1, 2024 at 9:00 AM)
   - Use tokens: `{{name}}`, `{{role}}`, `{{company}}`, `{{category}}`
8. Go to the **Contacts** tab → click **Add Contacts** to enroll contacts
9. Click **Launch** — email jobs are created for every contact × every template, each scheduled at the datetime you set per step
10. The scheduler checks for due jobs every 60 seconds and sends them via Gmail automation
11. Monitor status in the **Email Jobs** tab (SCHEDULED → SENT or FAILED with retry)

---

## Excel Import Format

When creating a campaign you can upload an `.xlsx` file with **two sheets** to import contacts and templates at once.

### Sheet 1 — "Contacts"

| name | email | role | company |
|------|-------|------|---------|
| John Smith | john@acme.com | VP Sales | Acme Corp |
| Jane Doe | jane@startup.io | CTO | StartupIO |

- `email` is required; all other columns are optional
- Contacts are **upserted** by email — existing contacts are updated

### Sheet 2 — "Templates"

| step_number | subject | body | scheduled_at |
|-------------|---------|------|--------------|
| 1 | Hi {{name}}, quick question | Dear {{name}}, ... | 2024-06-01 09:00 |
| 2 | Following up | Just checking in... | 2024-06-05 14:00 |
| 3 | Last touch | Hi {{name}}, one more thought... | 2024-06-12 10:00 |

- `scheduled_at` format: `YYYY-MM-DD HH:MM` (24-hour clock)
- `step_number`, `subject`, `body` are required; `scheduled_at` is optional (you can set it in the UI after import)
- Tokens supported in subject and body: `{{name}}`, `{{role}}`, `{{company}}`, `{{category}}`

---

## Application URLs

| URL | Description |
|-----|-------------|
| http://localhost:8080 | Main application |
| http://localhost:8080/h2-console | H2 database browser |
| http://localhost:8080/api/dashboard/stats | Dashboard stats JSON |

H2 console JDBC URL: `jdbc:h2:file:./data/campaigndb` (username: `sa`, no password)

---

## Development Mode (Hot Reload)

Run backend and frontend separately for live reload during development:

**Terminal 1 — Spring Boot:**
```bash
mvn spring-boot:run
```

**Terminal 2 — Angular:**
```bash
cd src/main/frontend
npm install    # first time only
npm start      # ng serve with proxy to localhost:8080
```

Open: **http://localhost:4200** — Angular dev server with live reload.

---

## Deploying to Pivotal Cloud Foundry / Tanzu Application Service

### Prerequisites

- CF CLI installed and authenticated (`cf login`)
- Target org and space selected (`cf target -o <org> -s <space>`)
- `apt-buildpack` available in your marketplace — verify with `cf buildpacks`

### Deploy

```bash
./cf-push.sh
```

This script builds the JAR, assembles a `dist/` folder containing the JAR and `apt.yml`, then runs `cf push`.

### What the manifest configures

| Setting | Value | Reason |
|---------|-------|--------|
| `memory` | 2G | Chromium needs more memory than a standard Java app |
| `buildpacks` | `apt-buildpack` → `java_buildpack_offline` | `apt-buildpack` installs Chromium system libraries during staging |
| `PLAYWRIGHT_HEADLESS` | `true` | PCF containers have no display server |
| `PLAYWRIGHT_BROWSERS_PATH` | `/home/vcap/playwright-browsers` | Path for downloaded browser binaries |

### Connecting Gmail in PCF

PCF containers are headless — the **Connect Gmail** button cannot open a visible browser window in PCF. Use this two-step workaround:

**Step 1 — Generate the session locally:**
```bash
java -jar target/campaign-manager-1.0.0.jar
# Go to http://localhost:8080 → Settings → Connect Gmail
# Log in to Gmail in the browser window
# Session is saved to: ./data/gmail-session.json
```

**Step 2 — Upload the session file to your PCF app:**

Option A (REST endpoint — recommended):
```bash
# Get a JWT token first
TOKEN=$(curl -s -X POST https://<your-app>.cfapps.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

# Upload the session file
curl -X POST https://<your-app>.cfapps.io/api/settings/gmail/upload-session \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./data/gmail-session.json"
```

Option B (CF SSH):
```bash
cf ssh sh-campaign-manager -c 'mkdir -p /home/vcap/app/data'
cat ./data/gmail-session.json | cf ssh sh-campaign-manager \
  -c 'cat > /home/vcap/app/data/gmail-session.json'
```

### Known PCF limitations

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| **Ephemeral containers** | H2 database and Gmail session are wiped on restart/restage | Bind a MySQL/PostgreSQL service; re-upload session after restart |
| **No display server** | "Connect Gmail" cannot open a browser in PCF | Use the session upload workaround above |
| **Browser binary download** | Playwright downloads ~120 MB of Chromium on first boot | Allow ~60 s for first startup; subsequent starts are faster |

### Binding a persistent database (recommended for production)

```bash
# Create a MySQL service (tile name varies by TAS foundation)
cf create-service p.mysql db-small campaign-db
cf bind-service sh-campaign-manager campaign-db
cf restage sh-campaign-manager
```

Then add `src/main/resources/application-cloud.properties`:
```properties
spring.datasource.url=${vcap.services.campaign-db.credentials.jdbcUrl}
spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.h2.console.enabled=false
```

---

## Project Structure

```
campaign-manager/
├── pom.xml                              # Maven build (includes frontend-maven-plugin)
├── src/
│   └── main/
│       ├── java/com/campaignmanager/
│       │   ├── CampaignManagerApplication.java
│       │   ├── config/                 # Security, Web, DataInitializer
│       │   ├── controller/             # REST API controllers
│       │   ├── dto/                    # Data transfer objects
│       │   ├── model/                  # JPA entities + enums
│       │   ├── repository/             # Spring Data JPA repos
│       │   ├── scheduler/              # Email queue processor (runs every 60s)
│       │   ├── security/               # JWT utility + filter
│       │   └── service/
│       │       ├── PlaywrightSessionService.java  # Gmail session login
│       │       └── PlaywrightGmailService.java    # Email sending automation
│       ├── frontend/                   # Angular 17 source
│       │   ├── angular.json
│       │   ├── package.json
│       │   └── src/app/
│       │       ├── components/         # Login, Dashboard, Campaigns, Contacts, Settings
│       │       ├── services/           # HTTP API services
│       │       ├── models/             # TypeScript interfaces
│       │       ├── guards/             # Auth guard
│       │       └── interceptors/       # JWT header interceptor
│       └── resources/
│           ├── application.properties
│           └── static/                 # Angular build output (auto-generated by Maven)
└── data/                               # Created at runtime
    ├── campaigndb.mv.db                # H2 database file
    └── gmail-session.json              # Playwright saved session (do not share)
```

---

## Troubleshooting

### Gmail / Playwright Issues

**Problem:** "Connect Gmail" opens a browser but the settings page shows a timeout error
**Solution:** Gmail keeps persistent network connections so the app no longer waits for "network idle" — it saves the session as soon as the Gmail inbox URL is detected. If you still see a timeout, try clicking Connect Gmail again.

**Problem:** Gmail login was completed but emails aren't sending
**Solution:**
- Check the Email Jobs tab — jobs in FAILED status show the error message
- The Gmail session may have expired; go to Settings → Disconnect → Connect Gmail again to refresh it
- Run with `playwright.headless=false` in `application.properties` to watch what Playwright does

**Problem:** Playwright can't find Gmail's compose button
**Solution:** Gmail occasionally changes their CSS selectors. Check `PlaywrightGmailService.java` and update the selectors if needed.

### Build Issues

**Problem:** `npm install` fails during Maven build
**Solution:** Delete `target/` and retry:
```bash
mvn clean package -DskipTests
```

**Problem:** Angular build fails with TypeScript errors
**Solution:**
```bash
cd src/main/frontend
npm install
npm run build
```

### H2 Database

**Problem:** Data is lost after restart
**Solution:** Verify `application.properties` uses a file URL (not in-memory):
```properties
spring.datasource.url=jdbc:h2:file:./data/campaigndb
```

**Problem:** "Database is already in use" on startup
**Solution:** Kill any lingering Java process from a previous run:
```bash
pkill -f "campaign-manager"
```

---

## Security Notes

- App-level passwords are hashed with **BCrypt**
- Gmail credentials are **never stored** — only the Playwright session cookie file (`gmail-session.json`)
- JWT tokens expire after 1 hour (configurable via `app.jwt.expiration-ms`)
- The H2 console is enabled for debugging; disable it in production (`spring.h2.console.enabled=false`)
- For production, replace H2 with PostgreSQL and use environment variables for the JWT secret

---

## License

MIT License — free to use and modify.
