import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NavComponent } from '../../shared/nav/nav.component';
import { CampaignPlanService, ProspectContact, GeneratedEmail, CampaignPlan } from '../../../services/campaign-plan.service';
import { CampaignService } from '../../../services/campaign.service';
import { EmailJobService } from '../../../services/email-job.service';

@Component({
  selector: 'app-campaign-v2-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTabsModule, MatButtonModule, MatIconModule,
    MatTableModule, MatChipsModule, MatProgressSpinnerModule,
    MatCardModule, MatTooltipModule, MatSnackBarModule,
    MatSlideToggleModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        @if (loading) {
          <div class="loading-state"><mat-spinner diameter="48"></mat-spinner></div>
        } @else {
          <!-- Header -->
          <div class="page-header">
            <button mat-icon-button (click)="back()" matTooltip="Back to campaigns">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="header-info">
              <h1>{{ plan?.name }} <span class="ai-badge">✦ AI</span></h1>
              <div class="header-sub">{{ plan?.customer }}</div>
            </div>
            <div class="header-actions">
              <span [class]="'status-chip status-' + (campaign?.status ?? 'draft').toLowerCase()">
                {{ campaign?.status }}
              </span>
              @if (campaign?.status === 'DRAFT') {
                <button mat-raised-button color="primary" (click)="launch()" [disabled]="launching">
                  @if (launching) { <mat-spinner diameter="18" style="display:inline-block"></mat-spinner> }
                  <mat-icon>send</mat-icon> Launch
                </button>
              }
              @if (campaign?.status === 'ACTIVE') {
                <button mat-stroked-button color="warn" (click)="pause()">
                  <mat-icon>pause</mat-icon> Pause
                </button>
              }
              @if (campaign?.status === 'PAUSED') {
                <button mat-raised-button color="primary" (click)="resume()">
                  <mat-icon>play_arrow</mat-icon> Resume
                </button>
              }
            </div>
          </div>

          <!-- Tabs -->
          <mat-tab-group>

            <!-- Tab 1: Prospects -->
            <mat-tab>
              <ng-template mat-tab-label>
                Prospects ({{ contacts.length }})
              </ng-template>
              <div class="tab-content">
                <div class="prospects-table-wrap">
                  <table mat-table [dataSource]="contacts" class="prospects-table">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Name</th>
                      <td mat-cell *matCellDef="let c"><strong>{{ c.name }}</strong></td>
                    </ng-container>
                    <ng-container matColumnDef="title">
                      <th mat-header-cell *matHeaderCellDef>Title</th>
                      <td mat-cell *matCellDef="let c">{{ c.title }}</td>
                    </ng-container>
                    <ng-container matColumnDef="email">
                      <th mat-header-cell *matHeaderCellDef>Email</th>
                      <td mat-cell *matCellDef="let c">{{ c.email || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="roleType">
                      <th mat-header-cell *matHeaderCellDef>Role Type</th>
                      <td mat-cell *matCellDef="let c">{{ c.roleType }}</td>
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
                      <th mat-header-cell *matHeaderCellDef>Relevance</th>
                      <td mat-cell *matCellDef="let c">
                        <span [class]="'relevance-' + (c.tanzuRelevance || '').toLowerCase()">
                          {{ c.tanzuRelevance }}
                        </span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="tanzuTeam">
                      <th mat-header-cell *matHeaderCellDef>Tanzu Team</th>
                      <td mat-cell *matCellDef="let c">{{ c.tanzuTeam }}</td>
                    </ng-container>
                    <ng-container matColumnDef="emailCount">
                      <th mat-header-cell *matHeaderCellDef>Emails</th>
                      <td mat-cell *matCellDef="let c">
                        <span class="email-count-badge">{{ c.generatedEmailCount || 7 }}</span>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="prospectColumns; sticky: true"></tr>
                    <tr mat-row *matRowDef="let row; columns: prospectColumns;"></tr>
                  </table>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 2: Emails -->
            <mat-tab label="Emails">
              <div class="tab-content">
                <div class="email-review-panels">
                  <div class="panel panel-contacts">
                    <div class="panel-header">Contacts</div>
                    @for (c of contacts; track c.id) {
                      <div class="contact-item"
                           [class.active]="activeContactId === c.id"
                           (click)="selectContact(c)">
                        <div class="contact-item-name">{{ c.name }}</div>
                        <div class="contact-item-sub">{{ c.title }}</div>
                      </div>
                    }
                  </div>
                  <div class="panel panel-emails">
                    <div class="panel-header">Emails</div>
                    @if (!activeContactId) {
                      <div class="panel-empty">Select a contact</div>
                    } @else {
                      @for (email of activeEmails; track email.id) {
                        <div class="email-item"
                             [class.active]="activeEmailId === email.id"
                             (click)="selectEmail(email)">
                          <div class="email-item-step">Email {{ email.stepNumber }}</div>
                          <div class="email-item-date">{{ formatDate(email.scheduledAt) }}</div>
                          <div class="email-item-subject">{{ email.subject }}</div>
                        </div>
                      }
                    }
                  </div>
                  <div class="panel panel-viewer">
                    <div class="panel-header">Email Content</div>
                    @if (!activeEmail) {
                      <div class="panel-empty">Select an email</div>
                    } @else {
                      <div class="email-view">
                        <div class="email-field">
                          <span class="field-label">Subject</span>
                          <span class="field-value">{{ activeEmail.subject }}</span>
                        </div>
                        <div class="email-field">
                          <span class="field-label">Scheduled</span>
                          <span class="field-value">{{ formatDate(activeEmail.scheduledAt) }}</span>
                        </div>
                        <div class="email-body-view">{{ activeEmail.body }}</div>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 3: Email Jobs -->
            <mat-tab>
              <ng-template mat-tab-label>
                Email Jobs ({{ jobs.length }})
              </ng-template>
              <div class="tab-content">
                <div class="jobs-toolbar">
                  <button mat-stroked-button (click)="refreshJobs()">
                    <mat-icon>refresh</mat-icon> Refresh
                  </button>
                </div>
                <table mat-table [dataSource]="jobs" class="jobs-table">
                  <ng-container matColumnDef="contact">
                    <th mat-header-cell *matHeaderCellDef>Contact</th>
                    <td mat-cell *matCellDef="let j">{{ j.contactName }}</td>
                  </ng-container>
                  <ng-container matColumnDef="step">
                    <th mat-header-cell *matHeaderCellDef>Step</th>
                    <td mat-cell *matCellDef="let j">{{ j.stepNumber }}</td>
                  </ng-container>
                  <ng-container matColumnDef="subject">
                    <th mat-header-cell *matHeaderCellDef>Subject</th>
                    <td mat-cell *matCellDef="let j">{{ j.subject }}</td>
                  </ng-container>
                  <ng-container matColumnDef="scheduledAt">
                    <th mat-header-cell *matHeaderCellDef>Scheduled</th>
                    <td mat-cell *matCellDef="let j">{{ formatDate(j.scheduledAt) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="sentAt">
                    <th mat-header-cell *matHeaderCellDef>Sent</th>
                    <td mat-cell *matCellDef="let j">{{ j.sentAt ? formatDate(j.sentAt) : '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let j">
                      <span [class]="'job-status job-' + j.status.toLowerCase()">{{ j.status }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="hold">
                    <th mat-header-cell *matHeaderCellDef>Hold</th>
                    <td mat-cell *matCellDef="let j">
                      <mat-slide-toggle
                        [checked]="j.status === 'HOLD'"
                        [disabled]="['SENT','FAILED','SKIPPED'].includes(j.status)"
                        (change)="toggleHold(j)">
                      </mat-slide-toggle>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let j">
                      @if (j.status === 'FAILED' || j.status === 'SKIPPED') {
                        <button mat-icon-button matTooltip="Retry now"
                                (click)="retry(j)">
                          <mat-icon>replay</mat-icon>
                        </button>
                      }
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="jobColumns; sticky: true"></tr>
                  <tr mat-row *matRowDef="let row; columns: jobColumns;"></tr>
                </table>
              </div>
            </mat-tab>

          </mat-tab-group>
        }
      </div>
    </app-nav>
  `,
  styles: [`
    .loading-state { display: flex; justify-content: center; padding: 80px; }
    .page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .header-info h1 { margin: 0; font-size: 22px; }
    .header-info .header-sub { font-size: 14px; color: #5f6368; margin-top: 2px; }
    .header-actions { display: flex; align-items: center; gap: 10px; margin-left: auto; }
    .ai-badge {
      font-size: 12px; background: #e8f0fe; color: #1a73e8;
      padding: 2px 8px; border-radius: 12px; font-weight: 600; vertical-align: middle;
    }
    .status-chip {
      padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;
    }
    .status-draft   { background: #f1f3f4; color: #5f6368; }
    .status-active  { background: #e6f4ea; color: #137333; }
    .status-paused  { background: #fef3cd; color: #856404; }
    .status-completed { background: #e8f0fe; color: #1a73e8; }
    .tab-content { padding: 20px 0; }
    .prospects-table-wrap { overflow-x: auto; }
    .prospects-table { width: 100%; min-width: 900px; }
    .relevance-high   { color: #137333; font-weight: 600; }
    .relevance-medium { color: #e37400; }
    .relevance-low    { color: #9aa0a6; }
    .email-count-badge {
      background: #1a73e8; color: white; font-size: 11px;
      border-radius: 10px; padding: 2px 8px;
    }

    /* 3-panel */
    .email-review-panels {
      display: flex; gap: 0; border: 1px solid #e0e0e0; border-radius: 8px;
      overflow: hidden; min-height: 480px;
    }
    .panel { display: flex; flex-direction: column; overflow-y: auto; }
    .panel-contacts { width: 22%; border-right: 1px solid #e0e0e0; background: #fafafa; }
    .panel-emails   { width: 28%; border-right: 1px solid #e0e0e0; }
    .panel-viewer   { flex: 1; }
    .panel-header {
      padding: 12px 16px; font-weight: 600; font-size: 13px; color: #3c4043;
      border-bottom: 1px solid #e0e0e0; position: sticky; top: 0;
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
    .email-item {
      padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f1f3f4;
      &:hover { background: #f8f9fa; }
      &.active { background: #e8f0fe; border-left: 3px solid #1a73e8; }
    }
    .email-item-step   { font-weight: 600; font-size: 13px; color: #1a73e8; }
    .email-item-date   { font-size: 11px; color: #5f6368; margin: 2px 0; }
    .email-item-subject { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .email-view { padding: 16px; }
    .email-field { margin-bottom: 12px; }
    .field-label { display: block; font-size: 11px; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; }
    .field-value { font-size: 14px; font-weight: 500; }
    .email-body-view {
      margin-top: 16px; font-size: 13px; line-height: 1.7; color: #3c4043;
      white-space: pre-wrap; background: #f8f9fa; border-radius: 6px; padding: 16px;
    }

    /* Jobs table */
    .jobs-toolbar { margin-bottom: 12px; }
    .jobs-table { width: 100%; }
    .job-status { padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; }
    .job-scheduled { background: #e8f0fe; color: #1a73e8; }
    .job-sent      { background: #e6f4ea; color: #137333; }
    .job-failed    { background: #fce8e6; color: #c5221f; }
    .job-skipped   { background: #f1f3f4; color: #5f6368; }
    .job-hold      { background: #fef3cd; color: #856404; }
  `]
})
export class CampaignV2DetailComponent implements OnInit {
  planId!: number;
  plan: CampaignPlan | null = null;
  campaign: any = null;
  contacts: ProspectContact[] = [];
  jobs: any[] = [];
  loading = true;
  launching = false;

  activeContactId: number | null = null;
  activeEmails: GeneratedEmail[] = [];
  activeEmailId: number | null = null;
  activeEmail: GeneratedEmail | null = null;

  prospectColumns = ['name', 'title', 'email', 'roleType', 'teamDomain', 'senioritySignal', 'tanzuRelevance', 'tanzuTeam', 'emailCount'];
  jobColumns = ['contact', 'step', 'subject', 'scheduledAt', 'sentAt', 'status', 'hold', 'actions'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private planService: CampaignPlanService,
    private campaignService: CampaignService,
    private emailJobService: EmailJobService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.planId = +this.route.snapshot.paramMap.get('planId')!;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.planService.getById(this.planId).subscribe({
      next: plan => {
        this.plan = plan;
        this.loading = false;
        this.planService.getContacts(this.planId).subscribe(c => this.contacts = c.filter(x => x.selected));
        if (plan.resultCampaignId) {
          this.campaignService.getById(plan.resultCampaignId).subscribe(c => {
            this.campaign = c;
            this.refreshJobs();
          });
        }
      },
      error: () => { this.loading = false; }
    });
  }

  refreshJobs(): void {
    if (!this.plan?.resultCampaignId) return;
    this.campaignService.getJobs(this.plan.resultCampaignId).subscribe(jobs => this.jobs = jobs);
  }

  selectContact(contact: ProspectContact): void {
    this.activeContactId = contact.id ?? null;
    this.activeEmail = null;
    this.activeEmailId = null;
    this.planService.getEmailsForContact(this.planId, contact.id!).subscribe(emails => {
      this.activeEmails = emails;
      if (emails.length > 0) this.selectEmail(emails[0]);
    });
  }

  selectEmail(email: GeneratedEmail): void {
    this.activeEmailId = email.id ?? null;
    this.activeEmail = email;
  }

  formatDate(dt?: string): string {
    if (!dt) return '—';
    try {
      return new Date(dt).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York'
      }) + ' ET';
    } catch { return dt; }
  }

  launch(): void {
    if (!this.plan?.resultCampaignId) return;
    this.launching = true;
    this.campaignService.launch(this.plan.resultCampaignId).subscribe({
      next: c => { this.campaign = c; this.launching = false; this.refreshJobs(); },
      error: err => {
        this.launching = false;
        this.snackBar.open(err?.error?.message ?? 'Launch failed', 'Close', { duration: 6000 });
      }
    });
  }

  pause(): void {
    if (!this.plan?.resultCampaignId) return;
    this.campaignService.pause(this.plan.resultCampaignId).subscribe(c => { this.campaign = c; });
  }

  resume(): void {
    if (!this.plan?.resultCampaignId) return;
    this.campaignService.resume(this.plan.resultCampaignId).subscribe(c => { this.campaign = c; });
  }

  toggleHold(job: any): void {
    this.emailJobService.toggleHold(job.id).subscribe({
      next: updated => {
        const idx = this.jobs.findIndex(j => j.id === updated.id);
        if (idx >= 0) this.jobs[idx] = updated;
      },
      error: () => this.snackBar.open('Failed to toggle hold', 'Close', { duration: 4000 })
    });
  }

  retry(job: any): void {
    this.emailJobService.retry(job.id).subscribe({
      next: updated => {
        const idx = this.jobs.findIndex(j => j.id === updated.id);
        if (idx >= 0) this.jobs[idx] = updated;
      },
      error: () => this.snackBar.open('Retry failed', 'Close', { duration: 4000 })
    });
  }

  back(): void {
    this.router.navigate(['/campaigns']);
  }
}
