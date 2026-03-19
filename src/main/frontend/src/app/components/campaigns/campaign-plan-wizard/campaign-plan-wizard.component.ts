import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { NavComponent } from '../../shared/nav/nav.component';
import { GemService, Gem } from '../../../services/gem.service';
import { CampaignPlanService, CampaignPlan, ProspectContact, GeneratedEmail, CampaignPlanSummary, CampaignPlanDocument } from '../../../services/campaign-plan.service';

@Component({
  selector: 'app-campaign-plan-wizard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatStepperModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTableModule, MatCheckboxModule, MatProgressSpinnerModule,
    MatCardModule, MatChipsModule, MatSnackBarModule,
    MatTooltipModule, MatDividerModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <button mat-icon-button (click)="cancel()" matTooltip="Cancel and go back">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h1>Plan Campaign <span class="ai-badge">✦ AI</span></h1>
        </div>

        <mat-stepper linear #stepper class="wizard-stepper">

          <!-- ═══ STEP 1: Campaign Details ═══ -->
          <mat-step [stepControl]="step1Form" label="Campaign Details">
            <div class="step-content">

              @if (!geminiConnected) {
                <div class="warning-banner">
                  <mat-icon>warning</mat-icon>
                  <span>No Gemini API key configured.
                    <a (click)="goToSettings()" class="link">Go to Settings → Gemini</a> to add your key first.
                  </span>
                </div>
              }

              <mat-card class="step1-card">
                <mat-card-content>
                  <form [formGroup]="step1Form" class="step-form">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Campaign Name *</mat-label>
                      <input matInput formControlName="name" placeholder="e.g. Citadel Q2 Outreach">
                      <mat-hint>Format: &lt;Company&gt; Campaign — e.g. Citadel Q2 Outreach</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Customer / Account Name *</mat-label>
                      <input matInput formControlName="customer" placeholder="e.g. Citadel">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Tanzu Specialist (optional)</mat-label>
                      <input matInput formControlName="tanzuContact" placeholder="e.g. Brian Smith">
                      <mat-hint>Internal VMware/Tanzu contact for this campaign</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Contact Research Gem *</mat-label>
                      <mat-select formControlName="contactGemId">
                        @for (gem of contactGems; track gem.id) {
                          <mat-option [value]="gem.id">{{ gem.name }}</mat-option>
                        }
                        @if (contactGems.length === 0) {
                          <mat-option disabled>No Contact Research Gems found — create one in Settings</mat-option>
                        }
                      </mat-select>
                      <mat-hint>Extracts prospect contacts from your briefing documents.</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Email Generation Gem *</mat-label>
                      <mat-select formControlName="emailGemId">
                        @for (gem of emailGems; track gem.id) {
                          <mat-option [value]="gem.id">{{ gem.name }}</mat-option>
                        }
                        @if (emailGems.length === 0) {
                          <mat-option disabled>No Email Generation Gems found — create one in Settings</mat-option>
                        }
                      </mat-select>
                      <mat-hint>Generates 7 personalized emails per selected contact.</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Email Format (optional)</mat-label>
                      <input matInput formControlName="emailFormat"
                             placeholder="e.g. firstname.lastname@broadcom.com">
                      <mat-hint>Auto-fills contact emails. Use firstname, lastname, or flastname patterns.</mat-hint>
                    </mat-form-field>
                  </form>

                  <mat-divider style="margin: 16px 0"></mat-divider>

                  <!-- ─── Briefing Documents ─────────────────────────────── -->
                  <div class="import-section">
                    <div class="section-title">
                      <mat-icon>description</mat-icon>
                      <strong>Briefing Documents *</strong>
                    </div>
                    <div class="section-sub">
                      Gemini reads these documents to identify contacts and generate personalized emails.
                    </div>

                    <!-- Mode tabs -->
                    <div class="mode-tabs">
                      <button type="button" class="mode-tab" [class.active]="docsMode === 'drive'"
                              (click)="docsMode = 'drive'">
                        <mat-icon>add_to_drive</mat-icon> Google Docs Links
                      </button>
                      <button type="button" class="mode-tab" [class.active]="docsMode === 'upload'"
                              (click)="docsMode = 'upload'">
                        <mat-icon>upload_file</mat-icon> Upload Files
                      </button>
                    </div>

                    <!-- Google Drive mode -->
                    @if (docsMode === 'drive') {
                      <mat-form-field appearance="outline" style="width:100%">
                        <mat-label>Google Doc / Slides URLs (one per line)</mat-label>
                        <textarea matInput [(ngModel)]="driveImportUrls" rows="4"
                                  placeholder="https://docs.google.com/document/d/...&#10;https://docs.google.com/presentation/d/..."></textarea>
                        <mat-icon matSuffix>add_to_drive</mat-icon>
                        <mat-hint>Paste individual Google Docs or Slides share links, one per line</mat-hint>
                      </mat-form-field>
                      <div class="drive-info">
                        <mat-icon class="drive-info-icon">info</mat-icon>
                        <div>
                          Open each file in Google Drive → <strong>Share → Copy link</strong>, then paste here.
                          Works with <strong>Google Docs and Slides</strong>.
                          Make sure your Gmail account is connected in Settings.
                        </div>
                      </div>
                    }

                    <!-- Upload Files mode -->
                    @if (docsMode === 'upload') {
                      <div class="file-drop-area" (click)="fileInput.click()"
                           [class.has-file]="pendingFiles.length > 0">
                        <mat-icon>upload_file</mat-icon>
                        @if (pendingFiles.length > 0) {
                          <span>{{ pendingFiles.length }} file(s) selected — click to add more</span>
                        } @else {
                          <span>Click to select one or more files (PDF, DOCX, TXT, HTML)</span>
                        }
                        <input #fileInput type="file" multiple accept=".html,.htm,.pdf,.docx,.txt"
                               hidden (change)="onFilesSelected($event)">
                      </div>
                      <div class="drive-info">
                        <mat-icon class="drive-info-icon">info</mat-icon>
                        <div>
                          You can select <strong>multiple files</strong> at once (hold Ctrl/Cmd while selecting).
                          Supported: <strong>PDF, DOCX, TXT, HTML</strong>.
                        </div>
                      </div>
                    }

                    <!-- Document list (shown in both modes) -->
                    @if (uploadedDocs.length > 0 || pendingFiles.length > 0) {
                      <div class="doc-list">
                        @for (doc of uploadedDocs; track doc.id) {
                          <div class="doc-item">
                            <mat-icon class="doc-icon">description</mat-icon>
                            <span class="doc-name">{{ doc.originalFileName }}</span>
                            <button mat-icon-button (click)="removeUploadedDoc(doc)" matTooltip="Remove">
                              <mat-icon style="font-size:16px">close</mat-icon>
                            </button>
                          </div>
                        }
                        @for (f of pendingFiles; track f.name) {
                          <div class="doc-item pending">
                            <mat-icon class="doc-icon">attach_file</mat-icon>
                            <span class="doc-name">{{ f.name }}</span>
                            <button mat-icon-button (click)="removePendingFile(f)" matTooltip="Remove">
                              <mat-icon style="font-size:16px">close</mat-icon>
                            </button>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </mat-card-content>
              </mat-card>

              <div class="step-actions">
                <button mat-button (click)="cancel()">Cancel</button>
                <button mat-raised-button color="primary"
                        [disabled]="step1Form.invalid || savingStep1 || !hasDocuments()"
                        (click)="saveStep1(stepper)">
                  @if (savingStep1) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                  {{ savingStep1 ? (docsMode === 'drive' ? 'Importing docs…' : 'Uploading…') : 'Next: Generate Customer List' }}
                  @if (!savingStep1) { <mat-icon>arrow_forward</mat-icon> }
                </button>
              </div>
            </div>
          </mat-step>

          <!-- ═══ STEP 2: Customer List ═══ -->
          <mat-step label="Customer List" [completed]="step2Completed">
            <div class="step-content">
              @if (generatingContacts) {
                <div class="generating-state">
                  <mat-spinner diameter="48"></mat-spinner>
                  <p class="generating-text">Gemini is analyzing your documents…</p>
                  <p class="generating-sub">This may take 20–60 seconds depending on the number of documents.</p>
                  @if (uploadedDocs.length > 0) {
                    <p class="generating-url"><mat-icon style="font-size:14px;vertical-align:middle">description</mat-icon> {{ uploadedDocs.length }} document(s) uploaded</p>
                  }
                </div>
              } @else if (generatingEmails) {
                <div class="generating-state">
                  <mat-spinner diameter="48"></mat-spinner>
                  <p class="generating-text">Generating emails for {{ selectedContacts.length }} contact(s)…</p>
                  <p class="generating-sub">This may take 30–90 seconds.</p>
                </div>
              } @else if (contactGenError) {
                <div class="error-banner">
                  <mat-icon>error</mat-icon>
                  <div>
                    <strong>Contact generation failed</strong>
                    <p>{{ contactGenError }}</p>
                    <button mat-stroked-button color="warn" (click)="generateContacts()">Retry</button>
                  </div>
                </div>
              } @else if (emailGenError) {
                <div class="error-banner">
                  <mat-icon>error</mat-icon>
                  <div>
                    <strong>Email generation failed</strong>
                    <p>{{ emailGenError }}</p>
                    <button mat-stroked-button color="warn" (click)="retryEmailGen(stepper)">Retry</button>
                  </div>
                </div>
              } @else {
                <div class="edit-tip">
                  <mat-icon>edit</mat-icon>
                  Click any cell to edit inline. Emails are auto-generated from your format — update them here if needed.
                </div>

                <div class="table-toolbar">
                  <p class="step-desc">{{ contacts.length }} contact(s) found. Select who to include.</p>
                  <div class="toolbar-actions">
                    <button mat-stroked-button (click)="selectAll()">Select All</button>
                    <button mat-stroked-button (click)="deselectAll()">Deselect All</button>
                    <button mat-stroked-button (click)="generateContacts()">
                      <mat-icon>refresh</mat-icon> Re-generate
                    </button>
                  </div>
                </div>

                <div class="contacts-table-wrap">
                  <table mat-table [dataSource]="contacts" class="contacts-table">
                    <ng-container matColumnDef="select">
                      <th mat-header-cell *matHeaderCellDef style="width:48px"></th>
                      <td mat-cell *matCellDef="let c">
                        <mat-checkbox [(ngModel)]="c.selected" (change)="onContactSelectionChange(c)"></mat-checkbox>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Name</th>
                      <td mat-cell *matCellDef="let c">
                        @if (editingContactId === c.id) {
                          <input class="inline-input" [(ngModel)]="c.name" (blur)="saveContact(c)">
                        } @else {
                          <span class="editable-cell" (click)="startEditContact(c)">{{ c.name }}</span>
                        }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="title">
                      <th mat-header-cell *matHeaderCellDef>Title</th>
                      <td mat-cell *matCellDef="let c">
                        @if (editingContactId === c.id) {
                          <input class="inline-input" [(ngModel)]="c.title" (blur)="saveContact(c)">
                        } @else {
                          <span class="editable-cell" (click)="startEditContact(c)">{{ c.title }}</span>
                        }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="email">
                      <th mat-header-cell *matHeaderCellDef>Email</th>
                      <td mat-cell *matCellDef="let c">
                        @if (editingContactId === c.id) {
                          <input class="inline-input" [(ngModel)]="c.email" (blur)="saveContact(c)">
                        } @else {
                          <span class="editable-cell" (click)="startEditContact(c)">{{ c.email || '—' }}</span>
                        }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="roleType">
                      <th mat-header-cell *matHeaderCellDef>Role Type</th>
                      <td mat-cell *matCellDef="let c">
                        @if (editingContactId === c.id) {
                          <input class="inline-input" [(ngModel)]="c.roleType" (blur)="saveContact(c)">
                        } @else {
                          <span class="editable-cell" (click)="startEditContact(c)">{{ c.roleType }}</span>
                        }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="teamDomain">
                      <th mat-header-cell *matHeaderCellDef>Team / Domain</th>
                      <td mat-cell *matCellDef="let c">{{ c.teamDomain }}</td>
                    </ng-container>
                    <ng-container matColumnDef="senioritySignal">
                      <th mat-header-cell *matHeaderCellDef>Seniority</th>
                      <td mat-cell *matCellDef="let c">{{ c.senioritySignal }}</td>
                    </ng-container>
                    <ng-container matColumnDef="tanzuRelevance">
                      <th mat-header-cell *matHeaderCellDef>Tanzu Relevance</th>
                      <td mat-cell *matCellDef="let c">
                        <span [class]="'relevance-' + (c.tanzuRelevance || '').toLowerCase()">
                          {{ c.tanzuRelevance }}
                        </span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="source">
                      <th mat-header-cell *matHeaderCellDef>Source</th>
                      <td mat-cell *matCellDef="let c">{{ c.source }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="contactColumns; sticky: true"></tr>
                    <tr mat-row *matRowDef="let row; columns: contactColumns;"
                        [class.selected-row]="row.selected"></tr>
                  </table>
                </div>

                <div class="selected-count">
                  {{ selectedContacts.length }} of {{ contacts.length }} selected
                </div>
              }

              @if (!generatingContacts && !generatingEmails) {
                <div class="step-actions">
                  <button mat-stroked-button (click)="cancel()">Cancel</button>
                  <button mat-stroked-button matStepperPrevious>
                    <mat-icon>arrow_back</mat-icon> Back
                  </button>
                  <button mat-raised-button color="primary"
                          [disabled]="selectedContacts.length === 0"
                          (click)="goToStep3(stepper)">
                    Generate Emails
                    <mat-icon>arrow_forward</mat-icon>
                  </button>
                </div>
              }
            </div>
          </mat-step>

          <!-- ═══ STEP 3: Email Review ═══ -->
          <mat-step label="Email Review">
            <div class="step-content">
              @if (true) {
                <div class="email-review-panels">
                  <!-- Panel 1: Contact list -->
                  <div class="panel panel-contacts">
                    <div class="panel-header">Contacts ({{ selectedContacts.length }})</div>
                    @for (c of selectedContacts; track c.id) {
                      <div class="contact-item"
                           [class.active]="activeContactId === c.id"
                           (click)="selectContact(c)">
                        <div class="contact-item-name">{{ c.name }}</div>
                        <div class="contact-item-sub">{{ c.title }}</div>
                        @if (emailsByContact[c.id!]) {
                          <span class="email-count-badge">{{ emailsByContact[c.id!].length }} emails</span>
                        }
                      </div>
                    }
                  </div>

                  <!-- Panel 2: Email list -->
                  <div class="panel panel-emails">
                    <div class="panel-header">Emails</div>
                    @if (!activeContactId) {
                      <div class="panel-empty">Select a contact to view emails</div>
                    } @else {
                      @for (email of activeEmails; track email.id) {
                        <div class="email-item"
                             [class.active]="activeEmailId === email.id"
                             (click)="selectEmail(email)">
                          <div class="email-item-step">Email {{ email.stepNumber }}</div>
                          <div class="email-item-date">{{ formatScheduledAt(email.scheduledAt) }}</div>
                          <div class="email-item-subject">{{ email.subject }}</div>
                        </div>
                      }
                    }
                  </div>

                  <!-- Panel 3: Email editor -->
                  <div class="panel panel-editor">
                    <div class="panel-header">Edit Email</div>
                    @if (!activeEmail) {
                      <div class="panel-empty">Select an email to edit</div>
                    } @else {
                      <div class="email-editor">
                        <mat-form-field appearance="outline" class="full-width">
                          <mat-label>Subject</mat-label>
                          <input matInput [(ngModel)]="activeEmail.subject"
                                 (blur)="saveEmail(activeEmail)">
                        </mat-form-field>
                        <mat-form-field appearance="outline" class="full-width">
                          <mat-label>Body</mat-label>
                          <textarea matInput [(ngModel)]="activeEmail.body"
                                    (blur)="saveEmail(activeEmail)"
                                    rows="18" class="email-body-textarea"></textarea>
                        </mat-form-field>
                        <div class="schedule-info">
                          <mat-icon>schedule</mat-icon>
                          Scheduled: {{ formatScheduledAt(activeEmail.scheduledAt) }}
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="step-actions">
                <button mat-stroked-button (click)="cancel()">Cancel</button>
                <button mat-stroked-button matStepperPrevious>
                  <mat-icon>arrow_back</mat-icon> Back
                </button>
                <button mat-raised-button color="primary"
                        [disabled]="generatingEmails"
                        (click)="goToStep4(stepper)">
                  Campaign Summary
                  <mat-icon>arrow_forward</mat-icon>
                </button>
              </div>
            </div>
          </mat-step>

          <!-- ═══ STEP 4: Summary ═══ -->
          <mat-step label="Summary">
            <div class="step-content">
              @if (loadingSummary) {
                <div class="generating-state">
                  <mat-spinner diameter="36"></mat-spinner>
                  <p>Loading summary…</p>
                </div>
              } @else if (summary) {
                <mat-card class="summary-card">
                  <mat-card-content>
                    <div class="summary-grid">
                      <div class="summary-row">
                        <span class="summary-label">Campaign</span>
                        <span class="summary-value">{{ summary.campaignName }}</span>
                      </div>
                      <div class="summary-row">
                        <span class="summary-label">Customer</span>
                        <span class="summary-value">{{ summary.customer }}</span>
                      </div>
                      @if (summary.tanzuContact) {
                        <div class="summary-row">
                          <span class="summary-label">Tanzu Specialist</span>
                          <span class="summary-value">{{ summary.tanzuContact }}</span>
                        </div>
                      }
                      <div class="summary-row">
                        <span class="summary-label">Contact Gem</span>
                        <span class="summary-value">{{ summary.contactGemName }}</span>
                      </div>
                      <div class="summary-row">
                        <span class="summary-label">Email Gem</span>
                        <span class="summary-value">{{ summary.emailGemName }}</span>
                      </div>
                      <mat-divider></mat-divider>
                      <div class="summary-row highlight">
                        <span class="summary-label">Contacts Selected</span>
                        <span class="summary-value">{{ summary.contactCount }}</span>
                      </div>
                      <div class="summary-row highlight">
                        <span class="summary-label">Emails to Schedule</span>
                        <span class="summary-value">{{ summary.emailCount }}</span>
                      </div>
                      @if (summary.scheduleStart) {
                        <div class="summary-row highlight">
                          <span class="summary-label">Schedule Range</span>
                          <span class="summary-value">{{ summary.scheduleStart }} → {{ summary.scheduleEnd }}</span>
                        </div>
                      }
                    </div>
                  </mat-card-content>
                </mat-card>

                <p class="summary-note">
                  Clicking <strong>Save Campaign</strong> will create the campaign with all contacts and
                  scheduled emails. Use the Launch button on the campaign detail page to start sending.
                </p>
              }

              <div class="step-actions">
                <button mat-stroked-button (click)="cancel()">Cancel</button>
                <button mat-stroked-button matStepperPrevious>
                  <mat-icon>arrow_back</mat-icon> Back
                </button>
                <button mat-raised-button color="primary"
                        [disabled]="saving"
                        (click)="saveCampaign()">
                  @if (saving) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                  <mat-icon>save</mat-icon>
                  Save Campaign
                </button>
              </div>
            </div>
          </mat-step>

        </mat-stepper>
      </div>
    </app-nav>
  `,
  styles: [`
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .page-header h1 { margin: 0; font-size: 22px; }
    .ai-badge {
      font-size: 12px; background: #e8f0fe; color: #1a73e8;
      padding: 2px 8px; border-radius: 12px; font-weight: 600; vertical-align: middle;
    }
    .wizard-stepper { max-width: 1100px; }
    .step-content { padding: 24px 0; }
    .step-desc { color: #5f6368; font-size: 14px; margin: 0 0 20px; }
    .step-form { display: flex; flex-direction: column; gap: 8px; max-width: 560px; }
    .full-width { width: 100%; }
    .step-actions { display: flex; align-items: center; gap: 12px; margin-top: 24px; justify-content: flex-end; }
    .warning-banner {
      display: flex; align-items: center; gap: 10px;
      background: #fef3cd; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px;
      font-size: 13px; color: #856404;
      mat-icon { color: #f9ab00; }
    }
    .link { color: #1a73e8; cursor: pointer; font-weight: 600; }
    .generating-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 16px; padding: 48px 0;
    }
    .generating-text { font-size: 16px; font-weight: 500; margin: 0; }
    .generating-sub  { font-size: 13px; color: #5f6368; margin: 0; }
    .generating-url  { font-size: 12px; color: #1a73e8; margin: 0; word-break: break-all; max-width: 560px; text-align: center; }
    .error-banner {
      display: flex; gap: 12px; background: #fce8e6; border-radius: 8px;
      padding: 16px; color: #c5221f; margin-bottom: 16px;
      mat-icon { flex-shrink: 0; }
      p { margin: 4px 0 8px; font-size: 13px; }
    }
    .table-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px; flex-wrap: wrap; gap: 8px;
    }
    .toolbar-actions { display: flex; gap: 8px; }
    .contacts-table-wrap { overflow-x: auto; max-height: 420px; overflow-y: auto; }
    .contacts-table { width: 100%; min-width: 900px; }
    .editable-cell {
      cursor: pointer; padding: 2px 4px; border-radius: 3px;
      &:hover { background: #e8f0fe; }
    }
    .inline-input {
      border: 1px solid #1a73e8; border-radius: 4px; padding: 4px 6px;
      font-size: 14px; width: 120px; outline: none;
    }
    .selected-row { background: #e8f0fe; }
    .selected-count { margin-top: 8px; font-size: 13px; color: #5f6368; }
    .relevance-high   { color: #137333; font-weight: 600; }
    .relevance-medium { color: #e37400; }
    .relevance-low    { color: #9aa0a6; }

    /* Email review 3-panel */
    .email-review-panels {
      display: flex; gap: 0; border: 1px solid #e0e0e0; border-radius: 8px;
      overflow: hidden; min-height: 520px;
    }
    .panel { display: flex; flex-direction: column; overflow-y: auto; }
    .panel-contacts { width: 22%; border-right: 1px solid #e0e0e0; background: #fafafa; }
    .panel-emails   { width: 28%; border-right: 1px solid #e0e0e0; background: #fff; }
    .panel-editor   { flex: 1; background: #fff; }
    .panel-header {
      padding: 12px 16px; font-weight: 600; font-size: 13px;
      color: #3c4043; border-bottom: 1px solid #e0e0e0; position: sticky; top: 0;
      background: inherit; z-index: 1;
    }
    .panel-empty { padding: 24px 16px; color: #9aa0a6; font-size: 13px; }
    .contact-item {
      padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f1f3f4;
      &:hover { background: #e8f0fe; }
      &.active { background: #e8f0fe; border-left: 3px solid #1a73e8; }
    }
    .contact-item-name { font-weight: 600; font-size: 14px; }
    .contact-item-sub  { font-size: 12px; color: #5f6368; margin-top: 2px; }
    .email-count-badge {
      display: inline-block; background: #1a73e8; color: white;
      font-size: 11px; border-radius: 10px; padding: 1px 7px; margin-top: 4px;
    }
    .email-item {
      padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f1f3f4;
      &:hover { background: #f8f9fa; }
      &.active { background: #e8f0fe; border-left: 3px solid #1a73e8; }
    }
    .email-item-step   { font-weight: 600; font-size: 13px; color: #1a73e8; }
    .email-item-date   { font-size: 11px; color: #5f6368; margin: 2px 0; }
    .email-item-subject { font-size: 13px; color: #3c4043; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email-editor { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .email-body-textarea { font-family: 'Google Sans', sans-serif; font-size: 13px; }
    .schedule-info {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; color: #5f6368;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    /* Step 1 card — matches Campaign 1.0 form style */
    .step1-card { max-width: 720px; }
    .import-section { display: flex; flex-direction: column; gap: 12px; }
    .section-title {
      display: flex; align-items: center; gap: 8px; font-size: 15px;
      mat-icon { color: #1a73e8; }
    }
    .section-sub { font-size: 12px; color: #5f6368; margin-top: -4px; }
    .mode-tabs {
      display: flex; gap: 0; border: 1px solid #dadce0; border-radius: 8px;
      overflow: hidden; width: fit-content;
    }
    .mode-tab {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 18px; border: none; background: #f8f9fa; cursor: pointer;
      font-size: 13px; font-weight: 500; color: #5f6368; transition: background 0.15s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.active { background: #1a73e8; color: #fff; }
      &:not(.active):hover { background: #e8eaed; }
    }
    .file-drop-area {
      border: 2px dashed #dadce0; border-radius: 8px;
      padding: 20px; display: flex; align-items: center; gap: 10px;
      cursor: pointer; color: #5f6368; font-size: 14px; transition: border-color 0.2s;
      &:hover { border-color: #1a73e8; color: #1a73e8; }
      &.has-file { border-color: #188038; color: #188038; background: #f0faf4; }
      mat-icon { flex-shrink: 0; }
    }
    .drive-info {
      display: flex; gap: 10px; align-items: flex-start;
      background: #e8f0fe; padding: 12px 14px; border-radius: 8px;
      font-size: 12px; color: #3c4043;
    }
    .drive-info-icon { color: #1a73e8; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px; }
    .doc-list { margin-top: 4px; display: flex; flex-direction: column; gap: 4px; }
    .doc-item {
      display: flex; align-items: center; gap: 8px; padding: 6px 10px;
      background: #e8f5e9; border-radius: 6px; font-size: 13px;
      mat-icon.doc-icon { font-size: 16px; width: 16px; height: 16px; color: #2e7d32; }
      &.pending { background: #e8f0fe; mat-icon.doc-icon { color: #1a73e8; } }
    }
    .doc-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .edit-tip {
      display: flex; align-items: center; gap: 8px;
      background: #e8f0fe; padding: 10px 14px; border-radius: 8px;
      font-size: 13px; color: #3c4043; margin-bottom: 8px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1a73e8; flex-shrink: 0; }
    }

    /* Summary */
    .summary-card { max-width: 520px; margin-bottom: 16px; }
    .summary-grid { display: flex; flex-direction: column; gap: 12px; }
    .summary-row { display: flex; justify-content: space-between; align-items: center; }
    .summary-label { font-size: 13px; color: #5f6368; }
    .summary-value { font-size: 14px; font-weight: 500; color: #202124; }
    .summary-row.highlight .summary-value { font-size: 18px; color: #1a73e8; }
    .summary-note { font-size: 13px; color: #5f6368; max-width: 520px; }
  `]
})
export class CampaignPlanWizardComponent implements OnInit {
  step1Form!: FormGroup;
  contactGems: Gem[] = [];
  emailGems: Gem[] = [];
  geminiConnected = false;

  planId: number | null = null;
  savingStep1 = false;
  uploadedDocs: CampaignPlanDocument[] = [];
  pendingFiles: File[] = [];
  driveImportUrls = '';
  importingFromDrive = false;
  docsMode: 'drive' | 'upload' = 'drive';

  contacts: ProspectContact[] = [];
  generatingContacts = false;
  contactGenError: string | null = null;
  editingContactId: number | null = null;
  step2Completed = false;

  contactColumns = ['select', 'name', 'title', 'email', 'roleType', 'teamDomain', 'senioritySignal', 'tanzuRelevance', 'source'];

  generatingEmails = false;
  emailGenError: string | null = null;
  emailsByContact: { [contactId: number]: GeneratedEmail[] } = {};
  activeContactId: number | null = null;
  activeEmails: GeneratedEmail[] = [];
  activeEmailId: number | null = null;
  activeEmail: GeneratedEmail | null = null;

  loadingSummary = false;
  summary: CampaignPlanSummary | null = null;

  saving = false;

  constructor(
    private fb: FormBuilder,
    private gemService: GemService,
    private planService: CampaignPlanService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.step1Form = this.fb.group({
      name: ['', Validators.required],
      customer: ['', Validators.required],
      tanzuContact: [''],
      contactGemId: [null, Validators.required],
      emailGemId: [null, Validators.required],
      emailFormat: ['']
    });

    this.loadGems();
    this.checkGeminiStatus();

    const planId = this.route.snapshot.paramMap.get('planId');
    if (planId) {
      this.planId = +planId;
      this.loadExistingPlan(this.planId);
    }
  }

  loadGems(): void {
    this.gemService.getByType('CONTACT_RESEARCH').subscribe(g => this.contactGems = g);
    this.gemService.getByType('EMAIL_GENERATION').subscribe(g => this.emailGems = g);
  }

  checkGeminiStatus(): void {
    // Check via settings endpoint — if request succeeds and connected is true
    fetch('/api/settings/gemini', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cm_jwt')}` }
    }).then(r => r.json()).then((d: any) => {
      this.geminiConnected = d?.connected === true;
    }).catch(() => this.geminiConnected = false);
  }

  loadExistingPlan(id: number): void {
    this.planService.getById(id).subscribe(plan => {
      this.step1Form.patchValue({
        name: plan.name,
        customer: plan.customer,
        tanzuContact: plan.tanzuContact,
        contactGemId: plan.contactGemId,
        emailGemId: plan.emailGemId,
        emailFormat: plan.emailFormat
      });
    });
    this.planService.getDocuments(id).subscribe(docs => this.uploadedDocs = docs);
  }

  hasDocuments(): boolean {
    if (this.docsMode === 'drive') return !!this.driveImportUrls.trim() || this.uploadedDocs.length > 0;
    return this.pendingFiles.length > 0 || this.uploadedDocs.length > 0;
  }

  parseDriveUrls(): string[] {
    return this.driveImportUrls
      .split(/[\n,]+/)
      .map(u => u.trim())
      .filter(u => u.length > 0);
  }

  saveStep1(stepper: any): void {
    if (this.step1Form.invalid) return;
    this.savingStep1 = true;
    const dto = this.step1Form.value as CampaignPlan;

    const save$ = this.planId
        ? this.planService.update(this.planId, dto)
        : this.planService.create(dto);

    save$.subscribe({
      next: plan => {
        this.planId = plan.id!;

        if (this.docsMode === 'drive' && this.driveImportUrls.trim()) {
          // Import files from individual Drive/Docs URLs, then advance
          const urls = this.parseDriveUrls();
          this.planService.importDocumentsFromDrive(this.planId, urls).subscribe({
            next: newDocs => {
              this.uploadedDocs = [...this.uploadedDocs, ...newDocs];
              this.driveImportUrls = '';
              this.savingStep1 = false;
              stepper.selectedIndex = 1;
              this.generateContacts();
            },
            error: err => {
              this.savingStep1 = false;
              const msg = err?.error?.message ?? 'Failed to import documents. Make sure the links are Google Docs or Slides and your Gmail account is connected in Settings.';
              this.snackBar.open(msg, 'Close', { duration: 10000 });
            }
          });
        } else if (this.pendingFiles.length > 0) {
          // Upload local files, then advance
          this.planService.uploadDocuments(this.planId, this.pendingFiles).subscribe({
            next: newDocs => {
              this.uploadedDocs = [...this.uploadedDocs, ...newDocs];
              this.pendingFiles = [];
              this.savingStep1 = false;
              stepper.selectedIndex = 1;
              this.generateContacts();
            },
            error: err => {
              this.savingStep1 = false;
              this.snackBar.open('Failed to upload documents: ' + (err?.error?.message ?? err.message), 'Close', { duration: 6000 });
            }
          });
        } else {
          // Already have uploaded docs, just advance
          this.savingStep1 = false;
          stepper.selectedIndex = 1;
          this.generateContacts();
        }
      },
      error: err => {
        this.savingStep1 = false;
        this.snackBar.open('Failed to save plan: ' + (err?.error?.message ?? err.message), 'Close', { duration: 6000 });
      }
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const newFiles = Array.from(input.files);
    newFiles.forEach(f => {
      if (!this.pendingFiles.some(p => p.name === f.name)) {
        this.pendingFiles = [...this.pendingFiles, f];
      }
    });
    input.value = ''; // reset so same file can be re-added if removed
  }

  removePendingFile(file: File): void {
    this.pendingFiles = this.pendingFiles.filter(f => f !== file);
  }

  removeUploadedDoc(doc: CampaignPlanDocument): void {
    if (!this.planId) return;
    this.planService.deleteDocument(this.planId, doc.id).subscribe({
      next: () => this.uploadedDocs = this.uploadedDocs.filter(d => d.id !== doc.id),
      error: () => this.snackBar.open('Failed to remove document', 'Close', { duration: 3000 })
    });
  }

  importFromDrive(): void {
    if (!this.driveImportUrls.trim()) return;
    this.importingFromDrive = true;
    const urls = this.parseDriveUrls();

    const doImport = (planId: number) => {
      this.planService.importDocumentsFromDrive(planId, urls).subscribe({
        next: docs => {
          this.uploadedDocs = [...this.uploadedDocs, ...docs];
          this.driveImportUrls = '';
          this.importingFromDrive = false;
          this.snackBar.open(`${docs.length} file(s) imported from Drive`, '', { duration: 4000, panelClass: 'snack-success' });
        },
        error: err => {
          this.importingFromDrive = false;
          const msg = err?.error?.message ?? 'Failed to import from Drive. Make sure the folder is publicly shared and your API key has the Google Drive API enabled.';
          this.snackBar.open(msg, 'Close', { duration: 8000 });
        }
      });
    };

    if (this.planId) {
      doImport(this.planId);
    } else if (this.step1Form.valid) {
      // Auto-save plan first, then import
      const dto = this.step1Form.value as CampaignPlan;
      this.planService.create(dto).subscribe({
        next: plan => {
          this.planId = plan.id!;
          doImport(this.planId);
        },
        error: err => {
          this.importingFromDrive = false;
          this.snackBar.open('Fill in required fields before importing from Drive.', 'Close', { duration: 5000 });
        }
      });
    } else {
      this.importingFromDrive = false;
      this.snackBar.open('Fill in required fields (Campaign Name, Customer, Gems) before importing from Drive.', 'Close', { duration: 5000 });
    }
  }

  generateContacts(): void {
    if (!this.planId) return;
    this.generatingContacts = true;
    this.contactGenError = null;
    this.step2Completed = false;
    this.contacts = [];

    this.planService.generateContacts(this.planId).subscribe({
      next: contacts => {
        this.contacts = contacts;
        this.generatingContacts = false;
        this.step2Completed = true;
      },
      error: err => {
        this.generatingContacts = false;
        this.contactGenError = err?.error?.message ?? 'Gemini could not generate contacts. Check your API key and Gem instructions.';
      }
    });
  }

  get selectedContacts(): ProspectContact[] {
    return this.contacts.filter(c => c.selected);
  }

  selectAll(): void { this.contacts.forEach(c => c.selected = true); }
  deselectAll(): void { this.contacts.forEach(c => c.selected = false); }

  onContactSelectionChange(contact: ProspectContact): void {
    if (!this.planId || !contact.id) return;
    this.planService.updateContact(this.planId, contact.id, contact).subscribe();
  }

  startEditContact(contact: ProspectContact): void {
    this.editingContactId = contact.id ?? null;
  }

  saveContact(contact: ProspectContact): void {
    this.editingContactId = null;
    if (!this.planId || !contact.id) return;
    this.planService.updateContact(this.planId, contact.id, contact).subscribe({
      error: () => this.snackBar.open('Failed to save contact', 'Close', { duration: 4000 })
    });
  }

  goToStep3(stepper: any): void {
    const selected = this.selectedContacts.map(c => c.id!);
    if (selected.length === 0) return;

    this.generatingEmails = true;
    this.emailGenError = null;
    this.emailsByContact = {};

    this.planService.generateEmails(this.planId!, selected).subscribe({
      next: result => {
        this.emailsByContact = result;
        this.generatingEmails = false;
        stepper.selectedIndex = 2;
        if (this.selectedContacts.length > 0) {
          this.selectContact(this.selectedContacts[0]);
        }
      },
      error: err => {
        this.generatingEmails = false;
        this.emailGenError = err?.error?.message ?? 'Email generation failed. Check your API key, model selection, and Gem instructions.';
      }
    });
  }

  retryEmailGen(stepper: any): void {
    this.emailGenError = null;
    this.goToStep3(stepper);
  }

  selectContact(contact: ProspectContact): void {
    this.activeContactId = contact.id ?? null;
    this.activeEmails = this.emailsByContact[contact.id!] ?? [];
    this.activeEmail = null;
    this.activeEmailId = null;
    if (this.activeEmails.length > 0) {
      this.selectEmail(this.activeEmails[0]);
    }
  }

  selectEmail(email: GeneratedEmail): void {
    this.activeEmailId = email.id ?? null;
    this.activeEmail = { ...email };
  }

  saveEmail(email: GeneratedEmail): void {
    if (!this.planId || !email.id) return;
    this.planService.updateEmail(this.planId, email.id, email).subscribe({
      next: updated => {
        // Update in emailsByContact map
        for (const cid in this.emailsByContact) {
          const idx = this.emailsByContact[cid].findIndex(e => e.id === updated.id);
          if (idx >= 0) { this.emailsByContact[cid][idx] = updated; }
        }
      },
      error: () => this.snackBar.open('Failed to save email', 'Close', { duration: 4000 })
    });
  }

  formatScheduledAt(scheduledAt?: string): string {
    if (!scheduledAt) return '—';
    try {
      return new Date(scheduledAt).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York'
      }) + ' ET';
    } catch { return scheduledAt; }
  }

  goToStep4(stepper: any): void {
    stepper.next();
    this.loadingSummary = true;
    this.planService.getSummary(this.planId!).subscribe({
      next: s => { this.summary = s; this.loadingSummary = false; },
      error: () => { this.loadingSummary = false; }
    });
  }

  saveCampaign(): void {
    this.saving = true;
    this.planService.convert(this.planId!).subscribe({
      next: campaign => {
        this.saving = false;
        this.snackBar.open('Campaign created!', '', { duration: 3000, panelClass: 'snack-success' });
        this.router.navigate(['/campaigns/plan', this.planId, 'detail']);
      },
      error: err => {
        this.saving = false;
        this.snackBar.open('Failed to save campaign: ' + (err?.error?.message ?? 'Unknown error'), 'Close', { duration: 8000 });
      }
    });
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  cancel(): void {
    this.router.navigate(['/campaigns']);
  }
}
