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
    MatTooltipModule, NavComponent
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

          <mat-tab-group animationDuration="200ms">

            <!-- TAB 1: Overview -->
            <mat-tab label="Overview">
              <div class="tab-content">
                <mat-card style="max-width:600px">
                  <mat-card-header><mat-card-title>Campaign Settings</mat-card-title></mat-card-header>
                  <mat-card-content>
                    <div class="detail-grid">
                      <div class="detail-row">
                        <span class="label">Gmail Account</span>
                        <span>{{ campaign.gmailEmail || gmailStatus?.connectedEmail || '—' }}</span>
                      </div>
                      @if (campaign.tanzuContact) {
                        <div class="detail-row"><span class="label">Tanzu Contact</span><span>{{ campaign.tanzuContact }}</span></div>
                      }
                      <div class="detail-row"><span class="label">Contacts</span><span>{{ campaign.contactCount }}</span></div>
                      <div class="detail-row"><span class="label">Created</span><span>{{ campaign.createdAt | date:'medium' }}</span></div>
                      @if (campaign.launchedAt) {
                        <div class="detail-row"><span class="label">Launched</span><span>{{ campaign.launchedAt | date:'medium' }}</span></div>
                      }
                    </div>
                    <div class="card-actions">
                      <button mat-stroked-button [routerLink]="['/campaigns', campaign.id, 'edit']"
                              (click)="editCampaign()">
                        <mat-icon>edit</mat-icon> Edit
                      </button>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </mat-tab>

            <!-- TAB 2: Contacts -->
            <mat-tab label="Contacts ({{ enrolledContacts.length }})">
              <div class="tab-content">
                <div class="tab-actions">
                  <button mat-raised-button color="primary" (click)="showContactPicker = !showContactPicker">
                    <mat-icon>person_add</mat-icon> Add Contacts
                  </button>
                </div>

                <!-- Google Sheets import -->
                <mat-card class="gsheet-card">
                  <mat-card-header>
                    <mat-icon mat-card-avatar style="color:#1a73e8">table_view</mat-icon>
                    <mat-card-title>Import from Google Sheet</mat-card-title>
                    <mat-card-subtitle>Paste a Google Sheets URL to import directly — uses your connected Gmail session</mat-card-subtitle>
                  </mat-card-header>
                  <mat-card-content>
                    <mat-form-field appearance="outline" style="width:100%;margin-top:8px">
                      <mat-label>Google Sheets URL</mat-label>
                      <input matInput [(ngModel)]="gsheetUrl"
                             placeholder="https://docs.google.com/spreadsheets/d/..."
                             [disabled]="importingGSheet">
                      <mat-icon matSuffix>link</mat-icon>
                    </mat-form-field>
                    <div style="display:flex;gap:8px;margin-top:4px">
                      <button mat-stroked-button color="primary"
                              (click)="onImportGSheet(false)"
                              [disabled]="!gsheetUrl || importingGSheet"
                              matTooltip="Add contacts from Google Sheet to existing list">
                        <mat-icon>add</mat-icon>
                        {{ importingGSheet ? 'Importing…' : 'Add from Sheet' }}
                      </button>
                      <button mat-stroked-button color="warn"
                              (click)="onImportGSheet(true)"
                              [disabled]="!gsheetUrl || importingGSheet"
                              matTooltip="Replace ALL existing contacts with contacts from this sheet">
                        <mat-icon>sync</mat-icon>
                        {{ importingGSheet ? 'Importing…' : 'Replace with Sheet' }}
                      </button>
                    </div>
                  </mat-card-content>
                </mat-card>

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
                  <ng-container matColumnDef="play">
                    <th mat-header-cell *matHeaderCellDef>Play</th>
                    <td mat-cell *matCellDef="let c">
                      @if (c.play) {
                        <span>{{ c.play }}</span>
                        @if (c.subPlay) { <div class="cell-sub">{{ c.subPlay }}</div> }
                      } @else { <span>—</span> }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="aeRole">
                    <th mat-header-cell *matHeaderCellDef>AE/SA</th>
                    <td mat-cell *matCellDef="let c">{{ c.aeRole || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="phone">
                    <th mat-header-cell *matHeaderCellDef>Phone</th>
                    <td mat-cell *matCellDef="let c">{{ c.phone || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="emailLink">
                    <th mat-header-cell *matHeaderCellDef>Email Doc</th>
                    <td mat-cell *matCellDef="let c">
                      @if (c.emailLink) {
                        <a [href]="c.emailLink" target="_blank" rel="noopener"
                           matTooltip="Open Google Doc" style="color:#1a73e8">
                          <mat-icon style="font-size:16px;vertical-align:middle">open_in_new</mat-icon>
                          View Doc
                        </a>
                      } @else { <span>—</span> }
                    </td>
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

            <!-- TAB 4: Email Jobs -->
            <mat-tab label="Email Jobs ({{ jobsDataSource.data.length }})">
              <div class="tab-content">
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
    }
    .tab-content { padding: 24px 0; }
    .tab-actions { margin-bottom: 16px; }
    mat-card-header { display: flex; align-items: center; }
    .detail-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .detail-row { display: flex; gap: 16px; align-items: baseline; }
    .label { width: 130px; font-weight: 500; color: #5f6368; font-size: 13px; flex-shrink: 0; }
    .card-actions { padding-top: 8px; border-top: 1px solid #f0f0f0; }
    .full-table { width: 100%; }
    .cell-sub { font-size: 12px; color: #9aa0a6; }
    .empty-state {
      text-align: center; padding: 60px; color: #9aa0a6;
      mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; }
    }
    .gsheet-card { margin: 16px 0; max-width: 700px; }
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

  contactColumns = ['name', 'email', 'company', 'play', 'aeRole', 'phone', 'emailLink', 'actions'];
  jobColumns = ['contact', 'step', 'subject', 'scheduledAt', 'sentAt', 'status', 'actions'];

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
}
