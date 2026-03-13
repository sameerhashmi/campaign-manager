# 📧 Campaign Manager

> Automated email campaign manager built with **Spring Boot 3** + **Angular 17**.
> Sends personalized sequences via **Gmail automation (Playwright)** — ships as a single runnable JAR.

---

## ✨ Features

| | Feature |
|---|---|
| 👥 | Multi-user — anyone can register; each user sees only their own campaigns and contacts |
| 📊 | Sortable, filterable Dashboard with campaign and email job stats |
| 📅 | Per-contact 7-email schedules with individual send dates from the spreadsheet |
| 📄 | Personalized email bodies fetched from private **Google Docs** at import time |
| 🔑 | Gmail session login — log in once, no passwords stored |
| 📋 | Import from **Google Sheets URL** or **.xlsx file** |
| ⏭️ | Past-date jobs auto-marked SKIPPED; retry or send-now from the UI |
| 🚫 | `Opt Out = Y` rows skipped entirely at import |
| ☁️ | One-command CF/TAS deployment — single JAR, no extra servers |
| 🕐 | All times in **Eastern Time (EST/EDT)** |

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/sameerhashmi/campaign-manager.git
cd campaign-manager

# 2. Build (downloads Node 20 automatically — no local Node needed)
mvn package -DskipTests

# 3. Run
java -jar target/campaign-manager-1.0.0.jar
```

Open **http://localhost:8080** — create an account on the login page or sign in with the admin account.

---

## 👥 User Accounts

Registration is open — anyone can create an account directly from the login page. No invite required.

- **Username** must be a valid email address (this becomes your Gmail send-from identity)
- **Password** minimum 6 characters

### Roles

| Role | Access |
|------|--------|
| **User** | Sees and manages only their own campaigns, contacts, and Gmail session |
| **Admin** | Sees everything across all users; can manage any session |

### Gmail session scoping

Each user's Gmail session is tied to their login email. When you upload a session file, the app verifies that the detected Gmail address matches your account — mismatched sessions are rejected. This ensures each user can only send from their own Gmail.

### Admin account

An `admin` account is created automatically on first startup. Contact your administrator for the credentials. Admin can see all users' campaigns and contacts (with an Owner column in the list views).

---

## 📁 Project Structure

```
campaign-manager/
├── pom.xml                         # Maven build + frontend-maven-plugin
├── manifest.yml                    # CF deployment manifest
├── scripts/
│   └── capture-gmail-session.js   # Node.js script to capture Gmail session locally
├── examples/
│   └── sample.xlsx                 # Sample import spreadsheet
└── src/main/
    ├── java/com/campaignmanager/
    │   ├── controller/             # REST API controllers
    │   ├── service/
    │   │   ├── PlaywrightGmailService.java       # Email sending via Gmail UI
    │   │   ├── PlaywrightSessionService.java      # Session management
    │   │   ├── GoogleDocParserService.java        # Fetch + parse Google Doc email sections
    │   │   ├── ExcelImportService.java            # Excel / Google Sheets import
    │   │   └── PlaywrightSystemDepsInstaller.java # Chromium libs installer for CF
    │   ├── model/ dto/ repository/ scheduler/
    │   └── security/               # JWT auth
    └── frontend/                   # Angular 17 source
        └── src/app/
            ├── components/         # Dashboard, Campaigns, Contacts, Settings
            └── services/           # HTTP API clients
```

---

## 📬 Gmail Setup

### Option A — Local (browser login)

1. Go to **Settings → Connect Gmail**
2. Log in to Gmail in the Chrome window that opens
3. Session is saved automatically — done

### Option B — Cloud / Headless (upload session file)

> Use this for CF/TAS where no display server is available.

**Step 1** — Capture session locally:
```bash
# Method 1: Run the JAR locally
java -jar target/campaign-manager-1.0.0.jar
# → Settings → Connect Gmail → login → session saved to ./data/gmail-session.json

# Method 2: Node.js script (no Java needed)
npm install playwright && npx playwright install chromium
node scripts/capture-gmail-session.js
```

**Step 2** — Upload to cloud app:
- Settings page → **Upload Session File** → select `gmail-session.json`

> ⚠️ The session is stored in the container's ephemeral filesystem — re-upload after each CF restart.

---

## 📊 Import Format

### Spreadsheet (one row = one contact)

Auto-detected when the sheet has both an **`Email Link`** and **`Email 1`** column.

| Column | Required | Description |
|--------|----------|-------------|
| `Name` | ✅ | Full name |
| `Email` | ✅ | Email address (upsert key) |
| `Title` | | Job title → `{{title}}` token |
| `Phone` | | Phone number |
| `Play` | | Sales play (e.g. Tanzu) |
| `Sub Play` | | Sub-play |
| `AE/SA` | | Role designation |
| `Email Link` | ✅ | Google Doc URL with 7 email sections |
| `Email 1`–`Email 7` | ✅ | Send date/time per step (Eastern Time) |
| `Opt Out` | | `Y` = skip this row entirely |

**Supported date formats:** `2/26/2026 9:00:00` · `2026-02-26 09:00` · `2/26/26 9:00`

---

### Google Doc Format (Email Link column)

Each contact's Google Doc holds up to 7 email sections. Fetched at import time using the connected Gmail session — no separate OAuth needed.

```
Email 1: Initial Outreach
Subject: Quick question about {{play}}, {{name}}
Hi {{name}},

I wanted to reach out about your {{play}} initiatives...

Best,
Brian
—

Email 2: Follow-Up
Subject: Following up, {{name}}
Hi {{name}},

Just circling back...

Best,
Brian
—
```

#### Parsing rules

| Rule | Detail |
|------|--------|
| **Section start** | Line beginning with `Email N` (case-insensitive, N = 1–7) |
| **Subject** | First line starting with `Subject:` — prefix stripped |
| **Subject fallback** | If no `Subject:` line, first line of section is used |
| **Inline greeting split** | `Hi / Hello / Dear + Capital` in the subject splits it — greeting onward becomes body |
| **Trailing separators** | `—`, `---`, `===`, `***`, blank lines at section end are stripped |
| **Unicode** | BOM, zero-width spaces, non-breaking spaces normalized automatically |
| **Missing date = skip** | If `Email N` column is blank, that section is not imported |

#### Personalization tokens

| Token | Value |
|-------|-------|
| `{{name}}` / `{{Name}}` | Contact name |
| `{{title}}` / `{{Title}}` | Job title |
| `{{role}}` | Job title |
| `{{company}}` | Company |
| `{{play}}` | Play field |

---

## ☁️ Cloud Foundry Deployment

```bash
mvn package -DskipTests
cp target/campaign-manager-1.0.0.jar dist/campaign-manager-1.0.0.jar
cf push
```

#### Key manifest settings

| Setting | Value | Why |
|---------|-------|-----|
| `memory` | 2G | Chromium needs headroom |
| `TZ` | `America/New_York` | Dates entered in Eastern Time |
| `PLAYWRIGHT_HEADLESS` | `true` | No display server on CF |
| `SPRING_PROFILES_ACTIVE` | `cloud` | Auto-binds MySQL via `VCAP_SERVICES` |

#### Persistent database (recommended)

```bash
cf create-service p.mysql db-small campaign-db
cf bind-service sh-campaign-manager campaign-db
cf restage sh-campaign-manager
```

Without a bound database, H2 is used and data is lost on every restart.

#### Known CF limitations

| Issue | Fix |
|-------|-----|
| H2 + Gmail session wiped on restart | Bind MySQL; re-upload session after restart |
| "Connect Gmail" unavailable | Settings page shows Upload Session File instead |
| First boot slow (~60s) | Chromium downloads ~120 MB + system libs on first start |

---

## 🔌 REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account (email + password) |
| `POST` | `/api/auth/login` | Get JWT token |
| `GET` | `/api/campaigns` | List campaigns |
| `POST` | `/api/campaigns` | Create campaign |
| `POST` | `/api/campaigns/{id}/launch` | Launch campaign |
| `POST` | `/api/campaigns/{id}/pause` | Pause |
| `POST` | `/api/campaigns/{id}/resume` | Resume |
| `POST` | `/api/campaigns/{id}/import-excel` | Upload `.xlsx` (`?replace=true`) |
| `POST` | `/api/campaigns/{id}/import-gsheet` | Import Google Sheet (`?url=...&replace=true`) |
| `GET` | `/api/campaigns/{id}/jobs` | List jobs (`?status=SCHEDULED\|SENT\|FAILED\|SKIPPED`) |
| `POST` | `/api/email-jobs/{id}/retry` | Retry FAILED or SKIPPED job immediately |
| `GET` | `/api/settings/gmail/status` | Session status |
| `POST` | `/api/settings/gmail/upload-session` | Upload session file |
| `DELETE` | `/api/settings/gmail/disconnect` | Disconnect |

---

## 🛠 Troubleshooting

**All jobs SKIPPED after import**
→ Dates in your sheet are in the past (Eastern Time). Update `Email 1`–`Email 7` to future dates and re-import with Replace. Or use **Send Now** on individual SKIPPED jobs.

**Google Doc fetch fails**
→ Ensure the Gmail session is active (Settings → Connected). The doc must be accessible by the connected Google account (owned or shared with it).

**Emails not sending after Gmail connected**
→ Check Email Jobs tab — FAILED jobs show the error. Session may have expired; go to Settings → Disconnect → reconnect or re-upload session.

**Gmail session lost after CF restart**
→ CF containers are ephemeral. Re-upload `gmail-session.json` via Settings after every redeploy.

**CF startup: `Host system is missing dependencies`**
→ `PlaywrightSystemDepsInstaller` handles this automatically. Check logs for `extracted N packages`. If N=0, check CF egress/network rules.

---

## 🔒 Security

- Passwords hashed with **BCrypt**
- Gmail credentials **never stored** — only the Playwright session cookie file
- JWT tokens expire after 1 hour
- H2 console disabled on CF (`application-cloud.properties`)

---

## 📄 License

MIT — free to use and modify.
