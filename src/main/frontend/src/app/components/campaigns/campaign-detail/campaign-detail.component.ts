import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NavComponent } from '../../shared/nav/nav.component';
import { CampaignService } from '../../../services/campaign.service';
import { ContactService } from '../../../services/contact.service';
import { SettingsService, GmailSessionStatus } from '../../../services/settings.service';
import { Campaign } from '../../../models/campaign.model';
import { Contact } from '../../../models/contact.model';
import { EmailJob } from '../../../models/email-job.model';
import { EmailJobService } from '../../../services/email-job.service';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, FormsModule,
    MatTabsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatTableModule, MatSortModule, MatChipsModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatCheckboxModule,
    MatTooltipModule, MatSlideToggleModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        @if (loading) {
          <div class="loading-center"><mat-spinner></mat-spinner></div>
        } @else if (campaign) {
          <div class="page-header">
            <div class="header-left">
              <button mat-icon-button routerLink="/campaigns"><mat-icon>arrow_back</mat-icon></button>
              <div>
                <h1>{{ campaign.name }}</h1>
                <span class="status-chip {{ campaign.status?.toLowerCase() }}">{{ campaign.status }}</span>
              </div>
            </div>
            <div class="header-actions">
              <button mat-stroked-button [routerLink]="['/campaigns', campaign.id, 'edit']">
                <mat-icon>edit</mat-icon> Edit
              </button>
              @if (campaign.status === 'DRAFT' || campaign.status === 'PAUSED') {
                <button mat-raised-button color="primary" (click)="launch()">
                  <mat-icon>rocket_launch</mat-icon> Launch
                </button>
              }
              @if (campaign.status === 'ACTIVE') {
                <button mat-stroked-button (click)="pause()"><mat-icon>pause</mat-icon> Pause</button>
              }
              @if (campaign.status === 'PAUSED') {
                <button mat-raised-button color="primary" (click)="resume()"><mat-icon>play_arrow</mat-icon> Resume</button>
              }
            </div>
          </div>

          <!-- ── Overview bar (always visible) ── -->
          <div class="overview-bar">
            <div class="overview-item">
              <span class="ov-label">Company</span>
              <span class="ov-value">{{ campaign.company || '—' }}</span>
            </div>
            <div class="overview-divider"></div>
            <div class="overview-item">
              <span class="ov-label">Email Sender</span>
              <span class="ov-value">{{ campaign.gmailEmail || '—' }}</span>
            </div>
            @if (campaign.tanzuContact) {
              <div class="overview-divider"></div>
              <div class="overview-item">
                <span class="ov-label">Tanzu Contact</span>
                <span class="ov-value">{{ campaign.tanzuContact }}</span>
              </div>
            }
            <div class="overview-divider"></div>
            <div class="overview-item">
              <span class="ov-label">Contacts</span>
              <span class="ov-value">{{ campaign.contactCount }}</span>
            </div>
            <div class="overview-divider"></div>
            <div class="overview-item">
              <span class="ov-label">Created</span>
              <span class="ov-value">{{ campaign.createdAt | date:'mediumDate' }}</span>
            </div>
            @if (campaign.launchedAt) {
              <div class="overview-divider"></div>
              <div class="overview-item">
                <span class="ov-label">Launched</span>
                <span class="ov-value">{{ campaign.launchedAt | date:'mediumDate' }}</span>
              </div>
            }
          </div>

          <mat-tab-group animationDuration="200ms">

            <!-- TAB 1: Contacts -->
            <mat-tab label="Contacts ({{ enrolledContacts.length }})">
              <div class="tab-content">
                <div class="tab-actions">
                  <button mat-raised-button color="primary" (click)="showContactPicker = !showContactPicker">
                    <mat-icon>person_add</mat-icon> Add Contacts
                  </button>
                </div>

                @if (showContactPicker) {
                  <mat-card class="form-card">
                    <mat-card-header><mat-card-title>Select Contacts to Add</mat-card-title></mat-card-header>
                    <mat-card-content>
                      <table mat-table [dataSource]="availableContacts" style="width:100%">
                        <ng-container matColumnDef="select">
                          <th mat-header-cell *matHeaderCellDef></th>
                          <td mat-cell *matCellDef="let c">
                            <mat-checkbox (change)="toggleContact(c.id!)"
                                          [checked]="selectedContactIds.has(c.id!)"></mat-checkbox>
                          </td>
                        </ng-container>
                        <ng-container matColumnDef="name">
                          <th mat-header-cell *matHeaderCellDef>Name</th>
                          <td mat-cell *matCellDef="let c">{{ c.name }}</td>
                        </ng-container>
                        <ng-container matColumnDef="email">
                          <th mat-header-cell *matHeaderCellDef>Email</th>
                          <td mat-cell *matCellDef="let c">{{ c.email }}</td>
                        </ng-container>
                        <ng-container matColumnDef="company">
                          <th mat-header-cell *matHeaderCellDef>Company</th>
                          <td mat-cell *matCellDef="let c">{{ c.company }}</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="['select','name','email','company']"></tr>
                        <tr mat-row *matRowDef="let row; columns: ['select','name','email','company'];"></tr>
                      </table>
                      <div class="form-actions" style="margin-top:12px">
                        <button mat-button (click)="showContactPicker = false; selectedContactIds.clear()">Cancel</button>
                        <button mat-raised-button color="primary" (click)="assignContacts()"
                                [disabled]="selectedContactIds.size === 0">
                          Add {{ selectedContactIds.size }} Contact(s)
                        </button>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }

                <div style="overflow-x:auto">
                <table mat-table [dataSource]="enrolledContacts" class="full-table contacts-table">
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Name</th>
                    <td mat-cell *matCellDef="let c">
                      <strong>{{ c.name }}</strong>
                      @if (c.role) { <div class="cell-sub">{{ c.role }}</div> }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="email">
                    <th mat-header-cell *matHeaderCellDef>Email</th>
                    <td mat-cell *matCellDef="let c">{{ c.email }}</td>
                  </ng-container>
                  <ng-container matColumnDef="company">
                    <th mat-header-cell *matHeaderCellDef>Company</th>
                    <td mat-cell *matCellDef="let c">{{ c.company || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let c">
                      <button mat-icon-button (click)="removeContact(c.id!)" matTooltip="Remove">
                        <mat-icon style="color:#ea4335">person_remove</mat-icon>
                      </button>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="contactColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: contactColumns;"></tr>
                </table>
                </div>

                @if (enrolledContacts.length === 0 && !showContactPicker) {
                  <div class="empty-state">
                    <mat-icon>people_outline</mat-icon>
                    <p>No contacts enrolled yet.</p>
                  </div>
                }
              </div>
            </mat-tab>

            <!-- TAB 2: Emails -->
            <mat-tab label="Emails">
              <div class="tab-content">
                @if (emailContacts.length === 0) {
                  <div class="empty-state">
                    <mat-icon>mail_outline</mat-icon>
                    <p>No emails yet. Launch the campaign to generate email jobs.</p>
                  </div>
                } @else {
                  <div class="email-review-panels">
                    <!-- Panel 1: Contacts -->
                    <div class="panel panel-contacts">
                      <div class="panel-header">Contacts ({{ emailContacts.length }})</div>
                      @for (ec of emailContacts; track ec.email) {
                        <div class="contact-item"
                             [class.active]="activeEmailContact === ec"
                             (click)="selectEmailContact(ec)">
                          <div class="contact-item-name">{{ ec.name }}</div>
                          <div class="contact-item-sub">{{ ec.email }}</div>
                          <span class="email-count-badge">{{ ec.jobs.length }} emails</span>
                        </div>
                      }
                    </div>
                    <!-- Panel 2: Email list -->
                    <div class="panel panel-emails">
                      <div class="panel-header">Emails</div>
                      @if (!activeEmailContact) {
                        <div class="panel-empty">Select a contact to view emails</div>
                      } @else {
                        @for (job of activeEmailContact.jobs; track job.id) {
                          <div class="email-item"
                               [class.active]="activeJob?.id === job.id"
                               (click)="selectEmailJob(job)">
                            <div class="email-item-step">Email {{ job.stepNumber }}</div>
                            <div class="email-item-date">{{ job.scheduledAt | date:'EEE, MMM d, y' }}</div>
                            <div class="email-item-subject">{{ job.subject }}</div>
                            <span class="status-chip {{ job.status.toLowerCase() }}">{{ job.status }}</span>
                          </div>
                        }
                      }
                    </div>
                    <!-- Panel 3: Body viewer -->
                    <div class="panel panel-editor">
                      <div class="panel-header">Email Body</div>
                      @if (!activeJob) {
                        <div class="panel-empty">Select an email to preview</div>
                      } @else {
                        <div class="email-viewer">
                          <div class="email-viewer-meta">
                            <div class="email-viewer-row">
                              <span class="ev-label">To</span>
                              <span>{{ activeEmailContact?.name }} &lt;{{ activeEmailContact?.email }}&gt;</span>
                            </div>
                            <div class="email-viewer-row">
                              <span class="ev-label">Subject</span>
                              <span class="ev-subject">{{ activeJob.subject }}</span>
                            </div>
                            <div class="email-viewer-row">
                              <span class="ev-label">Scheduled</span>
                              <span>{{ activeJob.scheduledAt | date:'medium' }}</span>
                            </div>
                            @if (activeJob.sentAt) {
                              <div class="email-viewer-row">
                                <span class="ev-label">Sent</span>
                                <span style="color:#2e7d32">{{ activeJob.sentAt | date:'medium' }}</span>
                              </div>
                            }
                            <div class="email-viewer-row">
                              <span class="ev-label">Status</span>
                              <span class="status-chip {{ activeJob.status.toLowerCase() }}">{{ activeJob.status }}</span>
                            </div>
                          </div>
                          <pre class="email-body-pre">{{ activeJob.body }}</pre>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </mat-tab>

            <!-- TAB 3: Email Jobs -->
            <mat-tab label="Email Jobs ({{ jobsDataSource.data.length }})">
              <div class="tab-content">
                <div class="jobs-toolbar">
                  <button mat-stroked-button (click)="refreshJobs()" matTooltip="Refresh jobs list">
                    <mat-icon>refresh</mat-icon> Refresh
                  </button>
                </div>
                <table mat-table [dataSource]="jobsDataSource" matSort class="full-table">
                  <ng-container matColumnDef="contact">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header="contactName">Contact</th>
                    <td mat-cell *matCellDef="let j">
                      <strong>{{ j.contactName }}</strong>
                      <div class="cell-sub">{{ j.contactEmail }}</div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="step">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header="stepNumber">Step</th>
                    <td mat-cell *matCellDef="let j">{{ j.stepNumber }}</td>
                  </ng-container>
                  <ng-container matColumnDef="subject">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header="subject">Subject</th>
                    <td mat-cell *matCellDef="let j">{{ j.subject }}</td>
                  </ng-container>
                  <ng-container matColumnDef="scheduledAt">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header="scheduledAt">Scheduled</th>
                    <td mat-cell *matCellDef="let j">{{ j.scheduledAt | date:'medium' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="sentAt">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header="sentAt">Sent At</th>
                    <td mat-cell *matCellDef="let j">{{ j.sentAt ? (j.sentAt | date:'medium') : '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header="status">Status</th>
                    <td mat-cell *matCellDef="let j">
                      <span class="status-chip {{ j.status.toLowerCase() }}">{{ j.status }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="hold">
                    <th mat-header-cell *matHeaderCellDef>Hold</th>
                    <td mat-cell *matCellDef="let j">
                      <mat-slide-toggle
                        [checked]="j.status === 'HOLD'"
                        [disabled]="j.status === 'SENT' || j.status === 'FAILED' || j.status === 'SKIPPED'"
                        (change)="toggleHold(j)"
                        matTooltip="Pause this email without losing the scheduled date">
                      </mat-slide-toggle>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let j">
                      @if (j.status === 'FAILED' || j.status === 'SKIPPED') {
                        <button mat-icon-button (click)="retryJob(j)"
                                [matTooltip]="j.status === 'SKIPPED' ? 'Send now' : 'Retry'">
                          <mat-icon>replay</mat-icon>
                        </button>
                      }
                      @if (j.errorMessage) {
                        <button mat-icon-button [matTooltip]="j.errorMessage">
                          <mat-icon style="color:#ea4335">error_outline</mat-icon>
                        </button>
                      }
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="jobColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: jobColumns;"></tr>
                </table>

                @if (jobsDataSource.data.length === 0) {
                  <div class="empty-state">
                    <mat-icon>inbox</mat-icon>
                    <p>No email jobs yet. Launch the campaign to generate jobs.</p>
                  </div>
                }
              </div>
            </mat-tab>

          </mat-tab-group>
        }
      </div>
    </app-nav>
  `,
  styles: [`
    .loading-center { display: flex; justify-content: center; padding: 80px; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-actions { display: flex; gap: 8px; }
    .status-chip {
      padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;
      &.draft     { background:#fff3e0; color:#e65100; }
      &.active    { background:#e8f5e9; color:#2e7d32; }
      &.paused    { background:#fff9c4; color:#f57f17; }
      &.completed { background:#ede7f6; color:#4527a0; }
      &.scheduled { background:#e3f2fd; color:#1565c0; }
      &.sent      { background:#e8f5e9; color:#2e7d32; }
      &.failed    { background:#ffebee; color:#c62828; }
      &.skipped   { background:#f1f3f4; color:#5f6368; }
      &.hold      { background:#fff8e1; color:#e65100; }
    }
    .tab-content { padding: 24px 0; }
    .tab-actions { margin-bottom: 16px; }
    mat-card-header { display: flex; align-items: center; }
    .detail-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .detail-row { display: flex; gap: 16px; align-items: baseline; }
    .label { width: 130px; font-weight: 500; color: #5f6368; font-size: 13px; flex-shrink: 0; }
    .full-table { width: 100%; }
    .cell-sub { font-size: 12px; color: #9aa0a6; }
    .empty-state {
      text-align: center; padding: 60px; color: #9aa0a6;
      mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; }
    }
    .jobs-toolbar { margin-bottom: 12px; }

    /* Overview bar */
    .overview-bar {
      display: flex; align-items: center;
      background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 10px;
      padding: 14px 20px; margin-bottom: 20px; flex-wrap: wrap; gap: 0;
    }
    .overview-item { display: flex; flex-direction: column; gap: 2px; padding: 0 16px; }
    .overview-item:first-child { padding-left: 0; }
    .overview-divider { width: 1px; background: #e0e0e0; height: 32px; flex-shrink: 0; }
    .ov-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: #9aa0a6; }
    .ov-value { font-size: 14px; color: #202124; font-weight: 500; }

    /* Email review panels */
    .email-review-panels {
      display: grid;
      grid-template-columns: 220px 260px 1fr;
      gap: 0; border: 1px solid #e0e0e0; border-radius: 10px;
      overflow: hidden; height: calc(100vh - 320px); min-height: 480px;
    }
    .panel { display: flex; flex-direction: column; overflow: hidden; }
    .panel-contacts { border-right: 1px solid #e0e0e0; background: #fafafa; overflow-y: auto; }
    .panel-emails { border-right: 1px solid #e0e0e0; overflow-y: auto; }
    .panel-editor { overflow-y: auto; background: inherit; }
    .panel-header {
      padding: 12px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #5f6368; background: inherit;
      border-bottom: 1px solid #e0e0e0; position: sticky; top: 0; z-index: 1; flex-shrink: 0;
    }
    .panel-empty { padding: 32px 16px; color: #9aa0a6; font-size: 13px; text-align: center; }
    .contact-item {
      padding: 12px 16px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.06);
      &:hover { background: rgba(0,0,0,0.04); }
      &.active { background: #e8f0fe; border-left: 3px solid #1a73e8; }
    }
    .contact-item-name { font-size: 14px; font-weight: 600; }
    .contact-item-sub { font-size: 12px; color: #5f6368; margin-top: 2px; }
    .email-count-badge {
      display: inline-block; margin-top: 4px;
      background: #e8f0fe; color: #1a73e8; font-size: 11px; font-weight: 600;
      padding: 1px 7px; border-radius: 10px;
    }
    .email-item {
      padding: 12px 16px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.06);
      &:hover { background: rgba(0,0,0,0.04); }
      &.active { background: #e8f0fe; border-left: 3px solid #1a73e8; }
    }
    .email-item-step { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9aa0a6; }
    .email-item-date { font-size: 11px; color: #5f6368; margin-top: 2px; }
    .email-item-subject { font-size: 13px; font-weight: 500; margin-top: 4px; }
    .email-viewer { padding: 16px; display: flex; flex-direction: column; gap: 0; height: 100%; }
    .email-viewer-meta {
      border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; margin-bottom: 16px; flex-shrink: 0;
    }
    .email-viewer-row {
      display: flex; align-items: baseline; gap: 12px; padding: 8px 14px;
      border-bottom: 1px solid rgba(0,0,0,0.06); font-size: 13px;
      &:last-child { border-bottom: none; }
    }
    .ev-label { width: 64px; font-size: 11px; font-weight: 600; color: #9aa0a6; text-transform: uppercase; flex-shrink: 0; }
    .ev-subject { font-weight: 600; }
    .email-body-pre {
      flex: 1; white-space: pre-wrap; word-break: break-word; font-family: inherit;
      font-size: 13px; line-height: 1.6;
      background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;
      padding: 16px; margin: 0; overflow-y: auto;
    }
  `]
})
export class CampaignDetailComponent implements OnInit, AfterViewInit {
  campaign: Campaign | null = null;
  gmailStatus: GmailSessionStatus | null = null;
  enrolledContacts: Contact[] = [];
  availableContacts: Contact[] = [];
  jobsDataSource = new MatTableDataSource<EmailJob>();
  loading = true;

  @ViewChild(MatSort) sort!: MatSort;

  showContactPicker = false;
  selectedContactIds = new Set<number>();
  importingGSheet = false;
  gsheetUrl = '';

  contactColumns = ['name', 'email', 'company', 'actions'];
  jobColumns = ['contact', 'step', 'subject', 'scheduledAt', 'sentAt', 'status', 'hold', 'actions'];

  // Emails tab
  emailContacts: { name: string; email: string; jobs: EmailJob[] }[] = [];
  activeEmailContact: { name: string; email: string; jobs: EmailJob[] } | null = null;
  activeJob: EmailJob | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private campaignService: CampaignService,
    private contactService: ContactService,
    private emailJobService: EmailJobService,
    private settingsService: SettingsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.load(id);
    this.settingsService.getStatus().subscribe({ next: s => this.gmailStatus = s, error: () => {} });
  }

  ngAfterViewInit(): void {
    this.jobsDataSource.sortingDataAccessor = (item: EmailJob, property: string) => {
      switch (property) {
        case 'scheduledAt': return item.scheduledAt ?? '';
        case 'sentAt': return item.sentAt ?? '';
        default: return (item as any)[property] ?? '';
      }
    };
    this.jobsDataSource.sort = this.sort;
  }

  load(id: number): void {
    this.loading = true;
    this.campaignService.getById(id).subscribe(c => {
      this.campaign = c;
      this.loading = false;
    });
    this.campaignService.getContacts(id).subscribe(c => this.enrolledContacts = c);
    this.campaignService.getJobs(id).subscribe(j => {
      this.jobsDataSource.data = j;
      this.buildEmailContacts(j);
    });
    this.contactService.getAll().subscribe(all => {
      this.availableContacts = all.filter(c => !this.enrolledContacts.some(e => e.id === c.id));
    });
  }

  get campaignId(): number { return this.campaign?.id ?? 0; }

  launch(): void {
    this.campaignService.launch(this.campaignId).subscribe({
      next: c => { this.campaign = c; this.snackBar.open('Campaign launched!', '', { duration: 3000, panelClass: 'snack-success' }); this.load(this.campaignId); },
      error: err => this.snackBar.open(err.error?.message || 'Launch failed', 'Close', { duration: 5000, panelClass: 'snack-error' })
    });
  }

  pause(): void {
    this.campaignService.pause(this.campaignId).subscribe(c => {
      this.campaign = c;
      this.snackBar.open('Campaign paused', '', { duration: 3000 });
    });
  }

  resume(): void {
    this.campaignService.resume(this.campaignId).subscribe(c => {
      this.campaign = c;
      this.snackBar.open('Campaign resumed', '', { duration: 3000, panelClass: 'snack-success' });
    });
  }

  editCampaign(): void {
    this.router.navigate(['/campaigns', this.campaignId, 'edit']);
  }

  toggleContact(id: number): void {
    if (this.selectedContactIds.has(id)) this.selectedContactIds.delete(id);
    else this.selectedContactIds.add(id);
  }

  assignContacts(): void {
    const ids = Array.from(this.selectedContactIds);
    this.campaignService.assignContacts(this.campaignId, ids).subscribe({
      next: res => {
        this.snackBar.open(`Added ${res.added} contact(s)`, '', { duration: 3000, panelClass: 'snack-success' });
        this.showContactPicker = false;
        this.selectedContactIds.clear();
        this.campaignService.getContacts(this.campaignId).subscribe(c => this.enrolledContacts = c);
        this.contactService.getAll().subscribe(all => {
          this.availableContacts = all.filter(c => !this.enrolledContacts.some(e => e.id === c.id));
        });
      }
    });
  }

  removeContact(contactId: number): void {
    if (!confirm('Remove this contact from the campaign?')) return;
    this.campaignService.removeContact(this.campaignId, contactId).subscribe(() => {
      this.campaignService.getContacts(this.campaignId).subscribe(c => this.enrolledContacts = c);
    });
  }

  onImportGSheet(replace: boolean): void {
    const url = this.gsheetUrl.trim();
    if (!url) return;
    if (replace && !confirm(`Replace ALL ${this.enrolledContacts.length} existing contacts with contacts from the Google Sheet?`)) return;
    this.importingGSheet = true;
    this.campaignService.importGoogleSheet(this.campaignId, url, replace).subscribe({
      next: result => {
        this.importingGSheet = false;
        const msg = result.message + (result.errors?.length ? ` (${result.errors.length} error(s))` : '');
        this.snackBar.open(msg, 'Close', { duration: 6000, panelClass: result.errors?.length ? 'snack-error' : 'snack-success' });
        this.campaignService.getContacts(this.campaignId).subscribe(c => this.enrolledContacts = c);
        this.campaignService.getById(this.campaignId).subscribe(c => this.campaign = c);
        this.campaignService.getJobs(this.campaignId).subscribe(j => this.jobsDataSource.data = j);
      },
      error: err => {
        this.importingGSheet = false;
        this.snackBar.open(err?.error?.message ?? 'Google Sheet import failed', 'Close', { duration: 6000, panelClass: 'snack-error' });
      }
    });
  }

  refreshJobs(): void {
    this.campaignService.getJobs(this.campaignId).subscribe(j => {
      this.jobsDataSource.data = j;
      this.buildEmailContacts(j);
      this.snackBar.open('Jobs refreshed', '', { duration: 2000 });
    });
  }

  private buildEmailContacts(jobs: EmailJob[]): void {
    const map = new Map<string, { name: string; email: string; jobs: EmailJob[] }>();
    for (const job of jobs) {
      const key = job.contactEmail ?? job.contactName ?? '';
      if (!map.has(key)) {
        map.set(key, { name: job.contactName ?? '', email: job.contactEmail ?? '', jobs: [] });
      }
      map.get(key)!.jobs.push(job);
    }
    // Sort jobs within each contact by stepNumber
    this.emailContacts = Array.from(map.values()).map(ec => ({
      ...ec,
      jobs: ec.jobs.sort((a, b) => a.stepNumber - b.stepNumber)
    }));
    this.activeEmailContact = null;
    this.activeJob = null;
  }

  selectEmailContact(ec: { name: string; email: string; jobs: EmailJob[] }): void {
    this.activeEmailContact = ec;
    this.activeJob = ec.jobs[0] ?? null;
  }

  selectEmailJob(job: EmailJob): void {
    this.activeJob = job;
  }

  retryJob(job: EmailJob): void {
    this.emailJobService.retry(job.id).subscribe({
      next: () => {
        this.snackBar.open('Job scheduled for retry', '', { duration: 3000 });
        this.campaignService.getJobs(this.campaignId).subscribe(j => {
          this.jobsDataSource.data = j;
        });
      }
    });
  }

  toggleHold(job: EmailJob): void {
    this.emailJobService.toggleHold(job.id).subscribe({
      next: updated => {
        job.status = updated.status;
        this.jobsDataSource._updateChangeSubscription();
        const msg = updated.status === 'HOLD' ? 'Job placed on hold' : 'Job re-scheduled';
        this.snackBar.open(msg, '', { duration: 2000 });
      },
      error: err => {
        this.snackBar.open(err.error?.message || 'Could not toggle hold', 'Close', { duration: 3000 });
      }
    });
  }
}
