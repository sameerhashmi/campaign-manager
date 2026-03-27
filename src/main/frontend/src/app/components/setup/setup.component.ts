import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../shared/nav/nav.component';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatSnackBarModule, MatTooltipModule,
    NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1><mat-icon class="header-icon">menu_book</mat-icon> Setup Guide</h1>
          <span class="header-sub">Everything you need to get started with Campaign Manager</span>
        </div>

        <!-- ═══════════════════════════════════════════════════════
             SECTION 1 — INITIAL SETUP
             ═══════════════════════════════════════════════════════ -->
        <div class="section-heading">
          <div class="section-badge">1</div>
          <div>
            <div class="section-title">Initial Setup</div>
            <div class="section-sub">Configure Gmail and Gemini AI before creating campaigns</div>
          </div>
        </div>

        <!-- Step 1.1 — Gmail Session -->
        <mat-card class="step-card">
          <mat-card-content>
            <div class="step-header">
              <div class="step-num">Step 1</div>
              <div class="step-icon-wrap gmail"><mat-icon>mark_email_read</mat-icon></div>
              <div class="step-title-block">
                <div class="step-title">Generate Gmail Session File</div>
                <div class="step-desc">Campaign Manager sends emails through your Gmail account using a session file you generate once on your computer.</div>
              </div>
            </div>

            <div class="substeps">
              <div class="substep">
                <div class="substep-num">1</div>
                <div class="substep-body">
                  <strong>Download the session capture script</strong>
                  <p>This Node.js script opens Chrome, lets you log in to Gmail, then saves your session automatically.</p>
                  <a href="/api/settings/gmail/capture-script" download="capture-gmail-session.js">
                    <button mat-raised-button color="primary" style="margin-top:8px">
                      <mat-icon>download</mat-icon> Download capture-gmail-session.js
                    </button>
                  </a>
                </div>
              </div>

              <div class="substep">
                <div class="substep-num">2</div>
                <div class="substep-body">
                  <strong>Install dependencies (one-time)</strong>
                  <p>Open a terminal, navigate to the folder where you saved the script, and run:</p>
                  <div class="code-block">
                    <pre>npm install playwright
npx playwright install chromium</pre>
                    <button mat-icon-button class="copy-btn" matTooltip="Copy"
                            (click)="copy('npm install playwright\nnpx playwright install chromium')">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </div>
                </div>
              </div>

              <div class="substep">
                <div class="substep-num">3</div>
                <div class="substep-body">
                  <strong>Run the script</strong>
                  <p>Chrome will open and navigate to Gmail. Log in with your work Gmail account. The script waits until you're in your inbox, then saves the session file automatically and closes.</p>
                  <div class="code-block">
                    <pre>node capture-gmail-session.js</pre>
                    <button mat-icon-button class="copy-btn" matTooltip="Copy"
                            (click)="copy('node capture-gmail-session.js')">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </div>
                  <div class="tip-box">
                    <mat-icon class="tip-icon">lightbulb</mat-icon>
                    <span>Output file: <code>data/gmail-session.json</code> in the same folder as the script.</span>
                  </div>
                </div>
              </div>

              <div class="substep">
                <div class="substep-num">4</div>
                <div class="substep-body">
                  <strong>Upload the session file to Campaign Manager</strong>
                  <p>Go to Settings → Gmail Sessions → <strong>Upload Session File</strong> and select the <code>gmail-session.json</code> file just generated.</p>
                  <a routerLink="/settings">
                    <button mat-stroked-button style="margin-top:6px">
                      <mat-icon>settings</mat-icon> Go to Settings
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Step 1.2 — Gemini API Key -->
        <mat-card class="step-card">
          <mat-card-content>
            <div class="step-header">
              <div class="step-num">Step 2</div>
              <div class="step-icon-wrap gemini"><mat-icon>auto_awesome</mat-icon></div>
              <div class="step-title-block">
                <div class="step-title">Connect Your Gemini API Key</div>
                <div class="step-desc">Campaign Manager uses Google Gemini to research contacts and write personalized emails. You need a free API key from Google AI Studio.</div>
              </div>
            </div>

            <div class="substeps">
              <div class="substep">
                <div class="substep-num">1</div>
                <div class="substep-body">
                  <strong>Get a free API key</strong>
                  <p>Open Google AI Studio and sign in with your Google account. Click <strong>Get API Key → Create API Key</strong> and copy it.</p>
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">
                    <button mat-stroked-button style="margin-top:8px">
                      <mat-icon>open_in_new</mat-icon> Open Google AI Studio
                    </button>
                  </a>
                </div>
              </div>

              <div class="substep">
                <div class="substep-num">2</div>
                <div class="substep-body">
                  <strong>Paste the key in Settings</strong>
                  <p>Go to Settings → Gemini API Key → paste your key and click <strong>Save</strong>. Then select a model (Gemini 1.5 Flash recommended).</p>
                  <a routerLink="/settings">
                    <button mat-stroked-button style="margin-top:6px">
                      <mat-icon>settings</mat-icon> Go to Settings
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- ═══════════════════════════════════════════════════════
             SECTION 2 — CAMPAIGN SETUP
             ═══════════════════════════════════════════════════════ -->
        <div class="section-heading" style="margin-top:40px">
          <div class="section-badge">2</div>
          <div>
            <div class="section-title">Campaign Setup</div>
            <div class="section-sub">Use AI to research your target company, build a contact list, then launch a campaign</div>
          </div>
        </div>

        <!-- Step 2.1 — Research the Company -->
        <mat-card class="step-card">
          <mat-card-content>
            <div class="step-header">
              <div class="step-num">Step 1</div>
              <div class="step-icon-wrap research"><mat-icon>manage_search</mat-icon></div>
              <div class="step-title-block">
                <div class="step-title">Research the Company with AI</div>
                <div class="step-desc">Run this multi-part prompt in any AI assistant (Gemini, Claude, Grok, or ChatGPT). Replace <code>&lt;Company Name&gt;</code> with the actual company. Save each output as a Google Doc in a dedicated customer folder on Google Drive.</div>
              </div>
            </div>

            <div class="prompt-label">
              <mat-icon style="font-size:16px;vertical-align:middle;margin-right:4px">smart_toy</mat-icon>
              Company Research Prompt — run in Grok, Gemini, Claude, or ChatGPT
            </div>
            <div class="prompt-box">
              <pre>{{ researchPrompt }}</pre>
              <button mat-raised-button class="copy-prompt-btn" (click)="copy(researchPrompt)">
                <mat-icon>content_copy</mat-icon> Copy Prompt
              </button>
            </div>

            <div class="tip-box" style="margin-top:12px">
              <mat-icon class="tip-icon">folder</mat-icon>
              <span>Save each AI response as a <strong>Google Doc</strong> in your customer's Google Drive folder. You'll paste those document links into Campaign Manager in Step 3.</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Step 2.2 — Generate Contact List -->
        <mat-card class="step-card">
          <mat-card-content>
            <div class="step-header">
              <div class="step-num">Step 2</div>
              <div class="step-icon-wrap contacts"><mat-icon>group_add</mat-icon></div>
              <div class="step-title-block">
                <div class="step-title">Generate the Contact List</div>
                <div class="step-desc">Run the prompt below in any AI assistant. Replace <code>&#123;gdrive location&#125;</code> with the Google Drive folder URL from Step 1. Copy the output (a Name / Title table) and paste it into an Excel spreadsheet (.xlsx) — save it in the same customer folder.</div>
              </div>
            </div>

            <div class="prompt-label">
              <mat-icon style="font-size:16px;vertical-align:middle;margin-right:4px">smart_toy</mat-icon>
              Contact List Prompt — replace &#123;gdrive location&#125; with your folder URL
            </div>
            <div class="prompt-box">
              <pre>{{ personaPrompt }}</pre>
              <button mat-raised-button class="copy-prompt-btn" (click)="copy(personaPrompt)">
                <mat-icon>content_copy</mat-icon> Copy Prompt
              </button>
            </div>

            <div class="tip-box" style="margin-top:12px">
              <mat-icon class="tip-icon">table_chart</mat-icon>
              <span>Save the AI's Name/Title table as an <strong>.xlsx file</strong> (e.g. <code>Citadel-contacts.xlsx</code>) with two columns: <strong>Name</strong> and <strong>Title</strong>.</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Step 2.3 — Create Campaign -->
        <mat-card class="step-card">
          <mat-card-content>
            <div class="step-header">
              <div class="step-num">Step 3</div>
              <div class="step-icon-wrap campaign"><mat-icon>rocket_launch</mat-icon></div>
              <div class="step-title-block">
                <div class="step-title">Create Your Campaign</div>
                <div class="step-desc">Bring everything together in Campaign Manager's AI-powered wizard.</div>
              </div>
            </div>

            <div class="substeps">
              <div class="substep">
                <div class="substep-num">1</div>
                <div class="substep-body">
                  <strong>Open the Campaign Wizard</strong>
                  <p>Go to <strong>Campaigns → Plan Campaign (AI)</strong>. Fill in Campaign Name, Account Name, Gmail Account, and Email Generation Gem.</p>
                </div>
              </div>

              <div class="substep">
                <div class="substep-num">2</div>
                <div class="substep-body">
                  <strong>Choose your input method</strong>
                  <p>In the <strong>Briefing Documents</strong> section, pick one:</p>
                  <div class="option-grid">
                    <div class="option-card">
                      <mat-icon class="option-icon">table_chart</mat-icon>
                      <strong>Import from Excel</strong>
                      <span>Upload the <code>.xlsx</code> contact list from Step 2. Contacts are imported directly — no AI research gem needed.</span>
                    </div>
                    <div class="option-card">
                      <mat-icon class="option-icon">add_to_drive</mat-icon>
                      <strong>Google Docs Links</strong>
                      <span>Paste the Google Doc URLs from Step 1. Gemini reads the docs and extracts contacts automatically (requires Contact Research Gem).</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="substep">
                <div class="substep-num">3</div>
                <div class="substep-body">
                  <strong>Review, generate emails, and save</strong>
                  <p>Step 2 shows the contact list — select who to include. Step 3 generates 7 personalized emails per contact. Step 4 is a summary — click <strong>Save Campaign</strong> to finish.</p>
                  <p>Back on the campaign detail page, click <strong>Launch</strong> to start sending.</p>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

      </div><!-- /page-container -->
    </app-nav>
  `,
  styles: [`
    .page-container { padding: 28px 32px; max-width: 860px; margin: 0 auto; }

    .page-header { margin-bottom: 32px; }
    .page-header h1 {
      font-size: 24px; font-weight: 600; color: #202124;
      margin: 0 0 6px; display: flex; align-items: center; gap: 10px;
    }
    .header-icon { font-size: 26px; width: 26px; height: 26px; color: #0ea5e9; }
    .header-sub { font-size: 14px; color: #5f6368; }

    /* Section heading */
    .section-heading {
      display: flex; align-items: flex-start; gap: 16px;
      margin-bottom: 16px;
    }
    .section-badge {
      width: 36px; height: 36px; border-radius: 50%;
      background: #0ea5e9; color: white;
      font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 2px;
    }
    .section-title { font-size: 18px; font-weight: 600; color: #202124; }
    .section-sub { font-size: 13px; color: #5f6368; margin-top: 3px; }

    /* Step cards */
    .step-card {
      margin-bottom: 16px;
      border-radius: 12px !important;
      border: 1px solid #e8eaed !important;
    }
    .step-header {
      display: flex; align-items: flex-start; gap: 14px;
      margin-bottom: 20px;
    }
    .step-num {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #9aa0a6;
      padding-top: 2px; flex-shrink: 0;
    }
    .step-icon-wrap {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: white; }
    }
    .step-icon-wrap.gmail   { background: linear-gradient(135deg, #ea4335, #fbbc04); }
    .step-icon-wrap.gemini  { background: linear-gradient(135deg, #4285f4, #0ea5e9); }
    .step-icon-wrap.research{ background: linear-gradient(135deg, #34a853, #0ea5e9); }
    .step-icon-wrap.contacts{ background: linear-gradient(135deg, #9c27b0, #3f51b5); }
    .step-icon-wrap.campaign{ background: linear-gradient(135deg, #ff6d00, #ff9100); }

    .step-title-block { flex: 1; }
    .step-title { font-size: 16px; font-weight: 600; color: #202124; margin-bottom: 4px; }
    .step-desc { font-size: 13px; color: #5f6368; line-height: 1.5; }

    /* Substeps */
    .substeps { display: flex; flex-direction: column; gap: 20px; }
    .substep {
      display: flex; gap: 14px; align-items: flex-start;
      padding-left: 54px; /* align under step-title-block */
    }
    .substep-num {
      width: 24px; height: 24px; border-radius: 50%;
      background: #f1f3f4; color: #5f6368;
      font-size: 12px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
    }
    .substep-body { flex: 1; font-size: 13.5px; color: #202124; line-height: 1.55; }
    .substep-body p { margin: 4px 0 0; color: #5f6368; }
    .substep-body strong { color: #202124; }

    /* Code blocks */
    .code-block {
      position: relative;
      background: #f8f9fa; border: 1px solid #e0e0e0;
      border-radius: 8px; margin-top: 10px;
      overflow: hidden;
    }
    .code-block pre {
      margin: 0; padding: 12px 48px 12px 14px;
      font-family: 'Roboto Mono', monospace; font-size: 13px;
      color: #202124; white-space: pre-wrap; word-break: break-all;
    }
    .copy-btn {
      position: absolute; top: 4px; right: 4px;
      width: 32px; height: 32px;
      color: #5f6368 !important;
    }

    /* Prompt box */
    .prompt-label {
      font-size: 12px; font-weight: 600; color: #5f6368;
      text-transform: uppercase; letter-spacing: 0.4px;
      margin-bottom: 8px; margin-left: 54px;
    }
    .prompt-box {
      position: relative;
      background: #f8f9fa; border: 1px solid #e0e0e0;
      border-radius: 10px; margin-left: 54px; overflow: hidden;
    }
    .prompt-box pre {
      margin: 0; padding: 16px 16px 52px;
      font-family: 'Google Sans', sans-serif; font-size: 13px;
      color: #202124; line-height: 1.6;
      white-space: pre-wrap; word-break: break-word;
      max-height: 320px; overflow-y: auto;
    }
    .copy-prompt-btn {
      position: absolute; bottom: 10px; right: 10px;
      font-size: 12px !important;
    }

    /* Tip box */
    .tip-box {
      display: flex; align-items: flex-start; gap: 8px;
      background: #e8f0fe; border-radius: 8px;
      padding: 10px 14px; font-size: 13px; color: #3c4043;
      margin-left: 54px;
    }
    .tip-icon { color: #1a73e8; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }

    /* Options grid */
    .option-grid { display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
    .option-card {
      flex: 1; min-width: 200px;
      display: flex; flex-direction: column; gap: 6px;
      background: #fff; border: 1.5px solid #e0e0e0;
      border-radius: 10px; padding: 14px 16px;
      font-size: 13px; color: #5f6368;
      strong { color: #202124; font-size: 14px; }
    }
    .option-icon { color: #0ea5e9; font-size: 22px; width: 22px; height: 22px; }
  `]
})
export class SetupComponent {
  readonly researchPrompt = `1. Company Research:
<Company Name> give me a lay of the land on the technology use. Their goals are on application transformation, cloud migration, and building AI apps. Lay out what language they use for building apps like Java, .net, what cloud they use, AWS, GCP, or on-premises. Also include their data strategy for transactional and data lake/warehouse. How many developers and operators do they have, and what's the initiative their CTO and CIO are working on for 2026

Also, list any concerns or challenges they face as a tech company. Give me the names of the CIO, CTO, VP of App Dev, CDO or VP of Data and Analytics, and VP of Cloud and Infrastructure who are leading the goals and initiatives


2. Why Tanzu:
What VMware by Broadcom Tanzu Solutions (VMware Tanzu Data Intelligence, Tanzu Spring Essentials, VMware Tanzu Platform, Tanzu Application Catalog) or if just a specific sub component listed here (https://www.vmware.com/products/app-platform) fits best for this company that solves the concerns their leadership is trying to solve for 2026 - 2027.

3. Who to target:
Give me names and details of likely direct reports of the people listed earlier under Key Leadership or in their software engineering or data practices. Provide as many as you can and do not limit yourself. For each person, list their name, title, who they likely report to, and which Tanzu solution is the best fit to target with them. List in a table if possible.

4. Create list of targets to paste into sheet:
Create a table with name and title from looking through the content in this folder https://drive.google.com/drive/u/1/folders/19gnx0bpMJsnkHaS6ZoZDnke51Gpexl5n in order to identify all the names of who we should target for our email campaign for our Tanzu solutions. I want to be able to copy and paste it into our tracking spreadsheet. The table should only have 2 columns: name and title.`;

  readonly personaPrompt = `create a table with name and title from looking through the content in this folder {gdrive location} in order to identify all the names of who we should target for our email campaign for our tanzu solutions. I want to be able to copy and paste it into our tracking spreadsheet. The table should only have 2 columns name and title.`;

  constructor(private snackBar: MatSnackBar) {}

  copy(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Copied to clipboard', '', { duration: 2000, panelClass: 'snack-success' });
    });
  }
}
