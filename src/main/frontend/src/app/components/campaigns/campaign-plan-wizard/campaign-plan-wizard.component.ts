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
import { CampaignPlanService, CampaignPlan, ProspectContact, GeneratedEmail, CampaignPlanSummary } from '../../../services/campaign-plan.service';

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
              <p class="step-desc">Provide campaign details and select your Gemini Gems.</p>

              @if (!geminiConnected) {
                <div class="warning-banner">
                  <mat-icon>warning</mat-icon>
                  <span>No Gemini API key configured.
                    <a (click)="goToSettings()" class="link">Go to Settings → Gemini</a> to add your key first.
                  </span>
                </div>
              }

              <form [formGroup]="step1Form" class="step-form">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Campaign Name *</mat-label>
                  <input matInput formControlName="name" placeholder="e.g. Citadel Q2 Outreach">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Customer / Account Name *</mat-label>
                  <input matInput formControlName="customer" placeholder="e.g. Citadel">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Tanzu Specialist (optional)</mat-label>
                  <input matInput formControlName="tanzuContact" placeholder="e.g. Brian Smith">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Google Drive Folder URL *</mat-label>
                  <input matInput formControlName="driveFolderUrl"
                         placeholder="https://drive.google.com/drive/folders/...">
                  <mat-hint>Share the folder with "anyone with the link" or ensure Workspace Gemini has access.</mat-hint>
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
                  <mat-hint>Gem used to extract contacts from your Drive folder.</mat-hint>
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
                  <mat-hint>Gem used to generate 7 personalized emails per contact.</mat-hint>
                </mat-form-field>
              </form>

              <div class="step-actions">
                <button mat-stroked-button (click)="cancel()">Cancel</button>
                <button mat-raised-button color="primary"
                        [disabled]="step1Form.invalid || savingStep1"
                        (click)="saveStep1()">
                  @if (savingStep1) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                  Next: Generate Customer List
                  <mat-icon>arrow_forward</mat-icon>
                </button>
              </div>
            </div>
          </mat-step>

          <!-- ═══ STEP 2: Customer List ═══ -->
          <mat-step label="Customer List">
            <div class="step-content">
              @if (generatingContacts) {
                <div class="generating-state">
                  <mat-spinner diameter="48"></mat-spinner>
                  <p class="generating-text">Gemini is analyzing your Drive folder…</p>
                  <p class="generating-sub">This may take 20–60 seconds depending on the number of documents.</p>
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
              } @else {
                <div class="table-toolbar">
                  <p class="step-desc">{{ contacts.length }} contact(s) found. Edit inline, then select who to include.</p>
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

              <div class="step-actions">
                <button mat-stroked-button (click)="cancel()">Cancel</button>
                <button mat-stroked-button matStepperPrevious>
                  <mat-icon>arrow_back</mat-icon> Back
                </button>
                <button mat-raised-button color="primary"
                        [disabled]="selectedContacts.length === 0 || generatingEmails"
                        (click)="goToStep3(stepper)">
                  @if (generatingEmails) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                  Generate Emails
                  <mat-icon>arrow_forward</mat-icon>
                </button>
              </div>
            </div>
          </mat-step>

          <!-- ═══ STEP 3: Email Review ═══ -->
          <mat-step label="Email Review">
            <div class="step-content">
              @if (generatingEmails) {
                <div class="generating-state">
                  <mat-spinner diameter="48"></mat-spinner>
                  <p class="generating-text">Generating emails for {{ selectedContacts.length }} contact(s)…</p>
                  <p class="generating-sub">This may take 30–90 seconds.</p>
                </div>
              } @else {
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

  contacts: ProspectContact[] = [];
  generatingContacts = false;
  contactGenError: string | null = null;
  editingContactId: number | null = null;

  contactColumns = ['select', 'name', 'title', 'email', 'roleType', 'teamDomain', 'senioritySignal', 'tanzuRelevance', 'source'];

  generatingEmails = false;
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
      driveFolderUrl: ['', Validators.required],
      contactGemId: [null, Validators.required],
      emailGemId: [null, Validators.required]
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
        driveFolderUrl: plan.driveFolderUrl,
        contactGemId: plan.contactGemId,
        emailGemId: plan.emailGemId
      });
    });
  }

  saveStep1(): void {
    if (this.step1Form.invalid) return;
    this.savingStep1 = true;
    const dto = this.step1Form.value as CampaignPlan;

    const save$ = this.planId
        ? this.planService.update(this.planId, dto)
        : this.planService.create(dto);

    save$.subscribe({
      next: plan => {
        this.planId = plan.id!;
        this.savingStep1 = false;
        this.generateContacts();
      },
      error: err => {
        this.savingStep1 = false;
        this.snackBar.open('Failed to save plan: ' + (err?.error?.message ?? err.message), 'Close', { duration: 6000 });
      }
    });
  }

  generateContacts(): void {
    if (!this.planId) return;
    this.generatingContacts = true;
    this.contactGenError = null;
    this.contacts = [];

    this.planService.generateContacts(this.planId).subscribe({
      next: contacts => {
        this.contacts = contacts;
        this.generatingContacts = false;
      },
      error: err => {
        this.generatingContacts = false;
        this.contactGenError = err?.error?.message ?? 'Gemini could not generate contacts. Check your API key, Drive URL, and Gem instructions.';
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

    stepper.next();
    this.generatingEmails = true;
    this.emailsByContact = {};

    this.planService.generateEmails(this.planId!, selected).subscribe({
      next: result => {
        this.emailsByContact = result;
        this.generatingEmails = false;
        // Auto-select first contact
        if (this.selectedContacts.length > 0) {
          this.selectContact(this.selectedContacts[0]);
        }
      },
      error: err => {
        this.generatingEmails = false;
        this.snackBar.open('Email generation failed: ' + (err?.error?.message ?? 'Unknown error'), 'Close', { duration: 8000 });
      }
    });
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
