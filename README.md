# Campaign Manager

A full-stack email campaign management application built with **Spring Boot 3** and **Angular 17**. Automates sending personalized email sequences via **Gmail web UI using Playwright**. Everything ships as a **single runnable JAR** — no separate frontend server needed.

---

## Features

- **Campaign Dashboard** — Stats cards showing campaigns, contacts, emails sent/pending
- **Campaign Management** — Create, launch, pause, resume campaigns with 6-7 email sequences
- **Personalization Tokens** — Use `{{name}}`, `{{role}}`, `{{company}}`, `{{category}}` in templates
- **Contact Management** — Add contacts manually or bulk-import via CSV/Excel
- **Gmail Automation** — Playwright controls Gmail web UI to send emails from your account
- **Smart Scheduling** — Define intervals (e.g. Day 0, 3, 7, 14, 21, 30) per campaign; Spring Scheduler sends automatically
- **Status Tracking** — Track each email job: SCHEDULED, SENT, FAILED, with retry support
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

### 2. Install Playwright browsers

Playwright needs to download Chromium once before first use:

```bash
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install chromium"
```

Or run it manually after the first build attempt:

```bash
# Inside the project directory
java -cp target/campaign-manager-1.0.0.jar com.microsoft.playwright.CLI install chromium
```

### 3. Set up a Gmail App Password (Recommended)

Using your regular Gmail password with automation often triggers Google security blocks. Use an **App Password** instead:

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** (required for App Passwords)
3. Go to **Security → App Passwords**
4. Select app: **Mail**, device: **Other (Custom name)** → enter "Campaign Manager"
5. Click **Generate** — copy the 16-character password
6. Use this App Password in the app (not your main password)

Direct link: https://myaccount.google.com/apppasswords

### 4. Configure the application (optional)

Edit `src/main/resources/application.properties` to customize:

```properties
# Run Playwright browser visibly (false = headless/invisible)
playwright.headless=false

# Server port (default 8080)
server.port=8080

# H2 database location (default: ./data/campaigndb)
spring.datasource.url=jdbc:h2:file:./data/campaigndb
```

---

## Build & Run

### Build (single command)

```bash
mvn package -DskipTests
```

This will:
1. Download Node 20 + npm (first time only, ~2 minutes)
2. Install Angular dependencies (`npm install`)
3. Build Angular (`ng build`) → output to `src/main/resources/static/`
4. Package everything into `target/campaign-manager-1.0.0.jar`

### Run

```bash
java -jar target/campaign-manager-1.0.0.jar
```

Open your browser at: **http://localhost:8080**

### Default login credentials

| Username | Password |
|----------|----------|
| `admin`  | `admin123` |

> Change these in `DataInitializer.java` before deploying.

---

## Development Mode (Hot Reload)

For active development, run backend and frontend separately:

**Terminal 1 — Spring Boot:**
```bash
mvn spring-boot:run
```

**Terminal 2 — Angular (with proxy to backend):**
```bash
cd src/main/frontend
npm install    # first time only
npm start      # runs ng serve with proxy to localhost:8080
```

Open: **http://localhost:4200** — Angular dev server with live reload.
API calls to `/api/**` are proxied to Spring Boot on `:8080`.

---

## CSV Import Format

Upload a `.csv` or `.xlsx` file with this structure:

```csv
email,name,role,company,category
john.smith@acme.com,John Smith,VP Sales,Acme Corp,Enterprise
jane.doe@startup.io,Jane Doe,CTO,StartupIO,SMB
alice.wang@techco.com,Alice Wang,Founder,TechCo,Enterprise
```

**Column headers** (case-insensitive):
- `email` — required
- `name` — required
- `role` — optional
- `company` — optional
- `category` — optional (used in `{{category}}` token)

Contacts are **upserted** by email — existing contacts are updated, new ones are created.

---

## Creating a Campaign (Step-by-Step)

1. **Login** at http://localhost:8080
2. Go to **Campaigns → New Campaign**
3. Enter campaign name, your Gmail address, App Password, and interval days
   - Example intervals: `0,3,7,14,21,30` (sends 6 emails over 30 days)
4. Click **Create Campaign**
5. In the campaign detail, go to **Email Templates** tab
6. Click **Add Step** for each email in your sequence
   - Use tokens: `{{name}}`, `{{role}}`, `{{company}}`, `{{category}}`
7. Go to **Contacts** tab → **Add Contacts** to enroll contacts
8. Click **Launch** to activate the campaign
   - Email jobs are created automatically with `scheduled_at` dates
9. The scheduler sends due emails every 60 seconds via Gmail automation
10. Monitor status in the **Email Jobs** tab

---

## Application Ports & URLs

| URL | Description |
|-----|-------------|
| http://localhost:8080 | Main application |
| http://localhost:8080/h2-console | H2 database browser (JDBC URL: `jdbc:h2:file:./data/campaigndb`) |
| http://localhost:8080/api/dashboard/stats | Dashboard stats JSON |

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
│       │   ├── scheduler/              # Email queue processor
│       │   ├── security/               # JWT utility + filter
│       │   └── service/
│       │       └── PlaywrightGmailService.java  # Gmail automation
│       ├── frontend/                   # Angular 17 source
│       │   ├── angular.json
│       │   ├── package.json
│       │   └── src/app/
│       │       ├── components/         # Login, Dashboard, Campaigns, Contacts
│       │       ├── services/           # HTTP API services
│       │       ├── models/             # TypeScript interfaces
│       │       ├── guards/             # Auth guard
│       │       └── interceptors/       # JWT header interceptor
│       └── resources/
│           ├── application.properties
│           └── static/                 # Angular build output (generated)
└── data/                               # H2 database files (created at runtime)
```

---

## Troubleshooting

### Playwright / Gmail Issues

**Problem:** Gmail login fails or shows "unusual activity" warning
**Solution:**
- Use a Gmail App Password instead of your main password
- Run with `playwright.headless=false` to see what's happening in the browser
- Make sure "Less secure app access" is not needed — App Passwords bypass this

**Problem:** Playwright can't find Gmail compose button
**Solution:** Gmail occasionally changes their CSS selectors. Check the `PlaywrightGmailService.java` selectors and update if needed.

**Problem:** Browser hangs or session expires
**Solution:** The service automatically re-creates the browser context on failure. Check the logs for error messages.

### Build Issues

**Problem:** `npm install` fails during Maven build
**Solution:** The `frontend-maven-plugin` downloads Node locally to `target/`. Delete `target/` and retry:
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
Check the error output for specific issues.

### H2 Database

**Problem:** Data is lost after restart
**Solution:** Verify `application.properties` uses a file URL (not in-memory):
```properties
spring.datasource.url=jdbc:h2:file:./data/campaigndb
```
The `data/` directory is created in your working directory when you run the JAR.

---

## Security Notes

- Passwords are stored using **BCrypt** hashing
- Gmail credentials are stored in the H2 database — **do not expose the database file**
- JWT tokens expire after 1 hour (configurable via `app.jwt.expiration-ms`)
- For production use, replace H2 with PostgreSQL and use environment variables for secrets

---

## License

MIT License — free to use and modify.
