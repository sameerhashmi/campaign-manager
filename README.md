# Campaign Manager

A full-stack email campaign management application built with **Spring Boot 3** and **Angular 17**. Automates sending personalized email sequences via **Gmail web UI using Playwright**. Everything ships as a **single runnable JAR** — no separate frontend server needed.

---

## Features

- **Campaign Dashboard** — Stats cards showing campaigns, contacts, emails sent/pending/failed
- **Campaign Management** — Create, launch, pause, and resume campaigns
- **Per-Contact Email Scheduling** — Each contact gets their own 7-email schedule with individual send dates read directly from the import sheet
- **Google Doc Email Bodies** — Email content is fetched from a private Google Doc (one doc per contact) at import time using the connected Gmail session — no separate OAuth setup needed
- **Personalization Tokens** — Use `{{name}}`, `{{title}}`, `{{role}}`, `{{company}}`, `{{play}}` in subject and body
- **Contact Fields** — Name, Title/Role, Email, Phone, Play, Sub Play, AE/SA, Email Link (Google Doc URL), Company, Category
- **Two Import Methods** — Upload an `.xlsx` file or paste a Google Sheets URL directly in the UI
- **Gmail Session Login** — Log in to Gmail once via Settings; Playwright saves the session and reuses it for all sends — no stored passwords
- **Status Tracking** — Every email job shows SCHEDULED, SENT, SKIPPED, FAILED status with retry support
- **Past-Date Skip** — Jobs with a scheduled date already in the past are automatically marked SKIPPED at import time
- **Opt-Out Support** — Rows with `Opt Out = Y` in the import sheet are skipped entirely
- **Single JAR Deployment** — Angular is bundled into the Spring Boot JAR at build time
- **Eastern Time Scheduling** — Server runs on `America/New_York` — enter all dates in EST, no UTC conversion needed

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
git clone https://github.com/sameerhashmi/campaign-manager.git
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

## Application Screen Layout

### Sidebar Navigation

The left sidebar provides navigation to all main sections:

```
[Campaign Manager logo]
──────────────────────
  Dashboard
  Campaigns
  Contacts
  Settings
──────────────────────
  [Logout]
```

### Dashboard

Stats overview cards at the top:

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Total          │ │  Active         │ │  Emails Sent    │ │  Pending        │
│  Campaigns      │ │  Campaigns      │ │  (All Time)     │ │  (Scheduled)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

Below the cards: a table of all campaigns with status chips (DRAFT / ACTIVE / PAUSED).

---

### Campaign Detail — 3 Tabs

When you open a campaign you see three tabs:

```
┌─────────────────────────────────────────────────────────┐
│  [Campaign Name]                          [Launch] [Pause]│
├──────────┬──────────────────────┬─────────────────────────┤
│ Overview │ Contacts (N)         │ Email Jobs (N)           │
└──────────┴──────────────────────┴─────────────────────────┘
```

#### Tab 1 — Overview

Edit campaign name, Gmail address, interval settings, and view current status. Shows last-launched timestamp.

#### Tab 2 — Contacts

Manage contacts enrolled in the campaign and import new ones.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Add from Excel]  [Replace with Excel]                          │
│                                                                  │
│  Import from Google Sheet                                        │
│  ┌─────────────────────────────────────┐ [Add from Sheet]       │
│  │ Paste Google Sheets URL here...      │ [Replace with Sheet]  │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Add individual contact                                    │   │
│  │ [Contact dropdown ▼]              [Add Contact]          │   │
│  └──────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│ NAME        EMAIL              TITLE       PLAY    ACTIONS       │
│ Jane Doe    jane@acme.com      VP Sales    Tanzu   [Remove]      │
│ John Smith  john@acme.com      Director    Aria    [Remove]      │
└──────────────────────────────────────────────────────────────────┘
```

#### Tab 3 — Email Jobs

View all scheduled/sent/failed/skipped email jobs for this campaign.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CONTACT     STEP  SUBJECT              SCHEDULED         STATUS   ACTIONS     │
│ Jane Doe    1     Hi Jane, quick...   2/26/2026 9:00    SCHEDULED            │
│ Jane Doe    2     Following up...     3/2/2026  9:00    SCHEDULED            │
│ Jane Doe    3     One more thought    3/9/2026  9:00    SCHEDULED            │
│ John Smith  1     Hi John, quick...   2/26/2026 9:00    SENT      2/26 9:01  │
│ John Smith  2     Following up...     3/2/2026  9:00    SCHEDULED            │
│ ...                                                                           │
│ Old Contact 1     Re: Tanzu demo      1/15/2026 9:00    SKIPPED              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Status chip colors: **SCHEDULED** (blue) · **SENT** (green) · **FAILED** (red) · **SKIPPED** (grey)

---

### Settings Page

```
┌────────────────────────────────────────┐
│ Gmail Session                          │
│ Status: ● Connected (since 2/25/2026)  │
│ [Connect Gmail]  [Disconnect]          │
│ [Upload Session File]                  │
│ [Paste Session JSON]                   │
└────────────────────────────────────────┘
```

---

## First-Time Gmail Setup

Before sending any emails you need to connect your Gmail account once.

### Option A — Connect directly (local only)

1. Log into the app and navigate to **Settings** (gear icon in the sidebar)
2. Click **Connect Gmail**
3. A Chromium browser window opens — log into your Gmail account normally
4. Once you reach the Gmail inbox, the session is automatically saved
5. The Settings page shows **Connected** — you're done

> **If Gmail prompts for 2-factor auth**, complete it in the browser window. The app waits up to 2 minutes.

### Option B — Capture session locally, upload to cloud

Use this when running on Cloud Foundry / Tanzu where no display server is available.

**Step 1 — Generate the session file locally (choose one):**

**Method 1 — Run the app JAR locally:**
1. `java -jar target/campaign-manager-1.0.0.jar`
2. Open **http://localhost:8080 → Settings → Connect Gmail**
3. Log in to Gmail in the Chrome window that opens
4. Session saved to `./data/gmail-session.json`

**Method 2 — Standalone Node.js script (no Java needed):**
```bash
npm install playwright
npx playwright install chromium
node scripts/capture-gmail-session.js
```
Session saved to `./data/gmail-session.json`

**Step 2 — Upload to the cloud app (choose one):**

**Option 1 — Upload via Settings UI (recommended):**
1. Open your cloud app → **Settings**
2. Click **Upload Session File** → select `gmail-session.json`

**Option 2 — Paste JSON in the browser:**
1. Open `gmail-session.json` in a text editor and copy all the contents
2. Open your cloud app → **Settings** → scroll to **Paste Session JSON**
3. Paste the JSON and click **Save Session**

**Option 3 — Upload via curl:**
```bash
TOKEN=$(curl -s -X POST https://<your-app>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

curl -X POST https://<your-app>/api/settings/gmail/upload-session \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./data/gmail-session.json"
```

> **Note:** The Gmail session is stored in the container's ephemeral filesystem. It is lost on app restart/restage — re-upload after each restart.

---

## Creating a Campaign (Step-by-Step)

1. **Connect Gmail** in Settings (one-time setup above)
2. Go to **Campaigns → New Campaign**
3. Enter a campaign name and optionally your Gmail address (for reference)
4. Click **Create Campaign**
5. In the campaign detail, go to the **Contacts** tab
6. Import contacts and schedule email jobs using one of:
   - **Add from Excel** / **Replace with Excel** — upload an `.xlsx` file
   - **Import from Google Sheet** — paste a Google Sheets URL; the app downloads it using the connected Gmail session
7. Click **Launch** to set the campaign to ACTIVE
8. The scheduler checks for due jobs every 60 seconds and sends them via Gmail automation
9. Monitor status in the **Email Jobs** tab (SCHEDULED → SENT or FAILED with retry)

> **Note:** With the direct per-contact format, all email jobs are created at import time with individual scheduled dates. Launching just marks the campaign ACTIVE.

---

## Excel / Google Sheets Import Format

### Direct Per-Contact Format (recommended)

A single sheet where **each row = one contact** with their own 7-email schedule and a unique Google Doc containing the email bodies for that person.

**Auto-detected** when the sheet contains both an `Email Link` column and an `Email 1` column.

#### Column headers

| Column | Required | Description |
|--------|----------|-------------|
| `Name` | Yes | Contact full name |
| `Title` | No | Job title (maps to `role` field) |
| `Email` | Yes | Email address (used as unique key for upsert) |
| `Phone` | No | Phone number |
| `Play` | No | Sales play (e.g. "Tanzu") |
| `Sub Play` | No | Sub-play (e.g. "Generic") |
| `AE/SA` | No | Role designation |
| `Email Link` | Yes | URL of a private Google Doc containing the 7 email sections |
| `Email 1` | Yes | Send date/time for email step 1 |
| `Email 2`–`Email 7` | No | Send date/time for email steps 2–7 |
| `Opt Out` | No | Set to `Y` to skip this row entirely |

#### Date/Time Format

All dates are interpreted as **Eastern Time (EST/EDT)** — enter times in your local time if you are in the Eastern timezone.

Supported date formats in the spreadsheet:

| Format | Example |
|--------|---------|
| `M/d/yyyy H:mm:ss` | `2/26/2026 14:00:00` |
| `M/d/yyyy H:mm` | `2/26/2026 14:00` |
| `M/d/yy H:mm:ss` | `2/26/26 14:00:00` |
| `M/d/yy H:mm` | `2/26/26 14:00` |
| `yyyy-MM-dd HH:mm:ss` | `2026-02-26 14:00:00` |
| `yyyy-MM-dd HH:mm` | `2026-02-26 14:00` |

> **Important:** Jobs with a date/time already in the past at import time are automatically set to **SKIPPED**. Use future dates to get **SCHEDULED** jobs.

#### Example sheet rows

| Name | Title | Email | Phone | Play | Sub Play | AE/SA | Email Link | Email 1 | Email 2 | Email 3 | Opt Out |
|------|-------|-------|-------|------|----------|-------|------------|---------|---------|---------|---------|
| Jane Doe | VP Sales | jane@acme.com | 415-555-0100 | Tanzu | Generic | AE | https://docs.google.com/document/d/... | 2/26/2026 9:00:00 | 3/2/2026 9:00:00 | 3/9/2026 9:00:00 | |
| John Smith | Director | john@acme.com | 212-555-0200 | Aria | Starter | SA | https://docs.google.com/document/d/... | 2/26/2026 10:00:00 | 3/2/2026 10:00:00 | | Y |

> John Smith has `Opt Out = Y` — this entire row is skipped, no jobs created.

A sample file is available at: `examples/sample.xlsx`

---

#### Google Doc Format (Email Link column)

Each contact's Google Doc must contain numbered sections. The app fetches it at import time using the connected Gmail session (same Google account = access to private docs).

**Multi-line format (recommended):**

```
Email 1: Initial Outreach (Day 1)
Subject: Quick question about {{play}}, {{name}}
Hi {{name}},

I wanted to reach out because your team is using VMware Tanzu and I think
there's an opportunity to help with your current initiatives.

Best,
Brian Stover
—

Email 2: Follow-Up (Day 4)
Subject: Following up, {{name}}
Hi {{name}},

Just circling back on my previous note...

Best,
Brian Stover
—

Email 3: ...
```

**Single-line format (also supported):**

```
Email 1: Initial Outreach Subject: Quick question Hi {{name}}, I wanted to reach out...
Email 2: Follow-Up Subject: Following up Hi {{name}}, Just circling back...
```

**Rules:**
- Sections start on lines matching `Email 1:` … `Email 7:` (case-insensitive, description after the number is ignored)
- The `Subject:` line is required within each section
- A greeting (`Hi`, `Hello`, `Dear` + name) marks the start of the body
- Trailing `—`, `---`, or blank lines after the body are stripped
- Sections without a corresponding date column in the sheet are skipped

#### Supported tokens (resolved at import time)

| Token | Replaced with |
|-------|--------------|
| `{{name}}` or `{{Name}}` | Contact name |
| `{{title}}` or `{{Title}}` | Contact title/role |
| `{{role}}` | Contact title/role |
| `{{company}}` | Contact company |
| `{{play}}` | Contact play field |

---

### Legacy 2-Sheet Format

Still supported for backwards compatibility. Detected automatically when the first sheet does **not** have both `Email Link` and `Email 1` columns.

#### Sheet 1 — "Contacts"

| name | email | role | company |
|------|-------|------|---------|
| John Smith | john@acme.com | VP Sales | Acme Corp |

#### Sheet 2 — "Templates"

| step_number | subject | body | scheduled_at |
|-------------|---------|------|--------------|
| 1 | Hi {{name}} | Dear {{name}}, ... | 2026-02-26 09:00 |
| 2 | Following up | Just checking in... | 2026-03-02 14:00 |

- `scheduled_at` format: `YYYY-MM-DD HH:MM`
- All contacts share the same templates and scheduled dates

---

## Importing from Google Sheets

In addition to uploading a file, paste a Google Sheets URL directly in the **Contacts** tab:

1. Open the campaign → **Contacts** tab
2. Scroll to the **Import from Google Sheet** card
3. Paste any Google Sheets URL (share link, view link, edit link — the sheet ID is extracted automatically)
4. Click **Add from Sheet** (additive) or **Replace with Sheet** (replaces all existing contacts and jobs)

The app downloads the sheet as `.xlsx` using the connected Gmail/Google session and processes it identically to a file upload.

> The sheet must be accessible to the Google account used for the Gmail session — either owned by that account or shared with it.

---

## Application URLs

| URL | Description |
|-----|-------------|
| http://localhost:8080 | Main application |
| http://localhost:8080/h2-console | H2 database browser (local only) |
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

### Deploy

```bash
mvn package -DskipTests
cp target/campaign-manager-1.0.0.jar dist/campaign-manager-1.0.0.jar
cf push
```

> Always copy the JAR to `dist/` before pushing — `manifest.yml` points CF at `dist/campaign-manager-1.0.0.jar`.

### What the manifest configures

| Setting | Value | Reason |
|---------|-------|--------|
| `path` | `dist/campaign-manager-1.0.0.jar` | Point directly at the JAR so `java_buildpack_offline` can detect it |
| `memory` | 2G | Chromium needs more memory than a standard Java app |
| `buildpacks` | `java_buildpack_offline` | Single buildpack — no `apt-buildpack` needed |
| `PLAYWRIGHT_HEADLESS` | `true` | CF containers have no display server |
| `PLAYWRIGHT_BROWSERS_PATH` | `/home/vcap/playwright-browsers` | Writable path for Playwright to cache browser binaries |
| `SPRING_PROFILES_ACTIVE` | `cloud` | Activates `CloudDataSourceConfig` for MySQL auto-binding |
| `TZ` | `America/New_York` | Server clock runs EST — enter spreadsheet dates in Eastern Time |

### How Chromium system libs are installed on CF

CF containers are missing several graphics libraries that Chromium requires. **`PlaywrightSystemDepsInstaller`** handles this automatically at startup:

1. Runs `apt-get download` to fetch the required `.deb` packages
2. Extracts the `.so` files into `~/playwright-system-deps/sysroot/`
3. Passes the sysroot path as `LD_LIBRARY_PATH` to Playwright
4. Adds `--no-sandbox` to Chromium launch args

Runs once on first boot (~15 s extra startup time); skipped on subsequent boots.

### Binding a persistent database (recommended)

Without a bound database the app uses H2 which is wiped on every CF restart. Bind a MySQL service for persistent storage:

```bash
cf create-service p.mysql db-small campaign-db
cf bind-service sh-campaign-manager campaign-db
cf restage sh-campaign-manager
```

`CloudDataSourceConfig` reads `VCAP_SERVICES` automatically and wires up the MySQL connection. No other config needed.

### Known CF limitations

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| **Ephemeral containers** | H2 database and Gmail session are wiped on restart | Bind MySQL; re-upload Gmail session after restart |
| **No display server** | "Connect Gmail" button returns an error on CF | Use the Upload Session File / Paste JSON workflow |
| **Browser binary download** | Playwright downloads ~120 MB of Chromium on first boot | Allow ~60 s for first startup |

---

## Project Structure

```
campaign-manager/
├── pom.xml                              # Maven build (includes frontend-maven-plugin)
├── manifest.yml                         # CF deployment manifest
├── scripts/
│   └── capture-gmail-session.js        # Standalone Node.js script to capture Gmail session
├── examples/
│   ├── sample.xlsx                      # Sample import sheet (direct per-contact format)
│   └── test.xlsx                        # Test import sheet
├── src/
│   └── main/
│       ├── java/com/campaignmanager/
│       │   ├── config/                 # Security, Web, CloudDataSourceConfig, DataInitializer
│       │   ├── controller/             # REST API controllers
│       │   ├── dto/                    # Data transfer objects
│       │   ├── model/                  # JPA entities + enums
│       │   ├── repository/             # Spring Data JPA repos
│       │   ├── scheduler/              # Email queue processor (runs every 60s)
│       │   ├── security/               # JWT utility + filter
│       │   └── service/
│       │       ├── PlaywrightSystemDepsInstaller.java  # Installs Chromium libs on CF at startup
│       │       ├── PlaywrightSessionService.java       # Gmail session login + browser lifecycle
│       │       ├── PlaywrightGmailService.java         # Email sending automation
│       │       ├── GoogleDocParserService.java         # Fetches + parses Google Doc email sections
│       │       └── ExcelImportService.java             # Excel/GSheet import (auto-detects format)
│       ├── frontend/                   # Angular 17 source
│       │   └── src/app/
│       │       ├── components/         # Login, Dashboard, Campaigns, Contacts, Settings
│       │       ├── services/           # HTTP API services
│       │       ├── models/             # TypeScript interfaces
│       │       ├── guards/             # Auth guard
│       │       └── interceptors/       # JWT header interceptor
│       └── resources/
│           ├── application.properties
│           ├── application-cloud.properties  # CF overrides (headless, H2 console off)
│           └── static/                 # Angular build output (auto-generated by Maven)
└── data/                               # Created at runtime
    ├── campaigndb.mv.db                # H2 database file
    └── gmail-session.json              # Playwright saved session (do not share)
```

---

## REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/campaigns` | List all campaigns |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/{id}` | Get campaign with templates |
| POST | `/api/campaigns/{id}/launch` | Launch campaign |
| POST | `/api/campaigns/{id}/pause` | Pause campaign |
| POST | `/api/campaigns/{id}/resume` | Resume campaign |
| GET | `/api/campaigns/{id}/contacts` | List enrolled contacts |
| POST | `/api/campaigns/{id}/contacts` | Enroll contacts (bulk) |
| DELETE | `/api/campaigns/{id}/contacts/{cid}` | Remove contact |
| POST | `/api/campaigns/{id}/import-excel` | Upload `.xlsx` file (`?replace=true` to replace all) |
| POST | `/api/campaigns/{id}/import-gsheet` | Import from Google Sheets URL (`?url=...&replace=true`) |
| GET | `/api/campaigns/{id}/jobs` | List email jobs (`?status=SCHEDULED\|SENT\|FAILED\|SKIPPED`) |
| GET | `/api/contacts` | List contacts (`?search=...`) |
| POST | `/api/contacts` | Create contact |
| PUT | `/api/contacts/{id}` | Update contact |
| GET | `/api/settings/gmail/status` | Gmail session status |
| POST | `/api/settings/gmail/connect` | Start Gmail login (local only) |
| POST | `/api/settings/gmail/upload-session` | Upload session JSON file |
| DELETE | `/api/settings/gmail/disconnect` | Clear Gmail session |

---

## Troubleshooting

### Gmail / Playwright Issues

**Problem:** "Connect Gmail" opens a browser but the settings page shows a timeout error
**Solution:** Click Connect Gmail again and complete login within 2 minutes.

**Problem:** Gmail login was completed but emails aren't sending
**Solution:**
- Check the Email Jobs tab — FAILED jobs show the error message
- The Gmail session may have expired; go to Settings → Disconnect → reconnect
- Run with `playwright.headless=false` in `application.properties` to watch what Playwright does

**Problem:** Google Doc fetch fails during import
**Solution:**
- Ensure the Gmail session is active (Settings shows Connected)
- The Google Doc must be accessible by the connected Google account (owned or shared)
- Check that the doc URL in the `Email Link` column is a standard `docs.google.com/document/d/...` URL

**Problem:** Google Sheet import fails with "No Gmail session"
**Solution:** Connect Gmail first in Settings. The same session that accesses Gmail also grants access to Google Sheets and Docs owned by that account.

**Problem:** All jobs are SKIPPED after import
**Solution:** The scheduled dates in your spreadsheet are in the past relative to Eastern Time. Update the `Email 1`–`Email 7` columns to future dates and re-import using **Replace with Excel** or **Replace with Sheet**.

### Cloud Foundry / Playwright Issues

**Problem:** App crashes on CF with `Host system is missing dependencies to run browsers`
**Solution:** `PlaywrightSystemDepsInstaller` handles this automatically. Check startup logs:
```
PlaywrightSystemDepsInstaller: extracted N packages to /home/vcap/playwright-system-deps/sysroot
```
If `N = 0`, `apt-get` may be blocked by network policy — check CF egress rules.

**Problem:** `JAVA_TOOL_OPTIONS: --add-opens` / `Unrecognized option` crash on CF
**Solution:**
```bash
cf unset-env sh-campaign-manager JAVA_TOOL_OPTIONS
cf restage sh-campaign-manager
```

**Problem:** Gmail session lost after `cf push` / restart
**Solution:** The CF filesystem is ephemeral. Re-upload `gmail-session.json` via Settings → Upload Session File after every redeploy.

### Build Issues

**Problem:** `npm install` fails during Maven build
**Solution:**
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

---

## Security Notes

- App-level passwords are hashed with **BCrypt**
- Gmail credentials are **never stored** — only the Playwright session cookie file (`gmail-session.json`)
- JWT tokens expire after 1 hour (configurable via `app.jwt.expiration-ms`)
- The H2 console is enabled for local debugging; it is disabled automatically on CF (`application-cloud.properties`)
- For production, bind a MySQL/PostgreSQL service and use environment variables for the JWT secret

---

## License

MIT License — free to use and modify.
