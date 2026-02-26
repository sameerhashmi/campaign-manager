import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../shared/nav/nav.component';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardStats, EmailJob } from '../../models/email-job.model';
import { SettingsService, GmailSessionStatus } from '../../services/settings.service';
import { CampaignService } from '../../services/campaign.service';
import { ContactService } from '../../services/contact.service';
import { EmailJobService } from '../../services/email-job.service';
import { Campaign } from '../../models/campaign.model';
import { Contact } from '../../models/contact.model';

type Panel = 'campaigns' | 'contacts' | 'sent' | 'scheduled' | 'failed' | null;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatTableModule, MatSortModule, MatFormFieldModule, MatInputModule,
    MatChipsModule, MatTooltipModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>Dashboard</h1>
          <button mat-raised-button color="primary" routerLink="/campaigns/new">
            <mat-icon>add</mat-icon> New Campaign
          </button>
        </div>

        @if (loading) {
          <div class="loading-center"><mat-spinner></mat-spinner></div>
        } @else if (stats) {

          <!-- Gmail session warning -->
          @if (gmailStatus && !gmailStatus.connected && !gmailStatus.connecting) {
            <div class="gmail-warning" routerLink="/settings" style="cursor:pointer">
              <mat-icon>warning_amber</mat-icon>
              <span>Gmail session not connected — emails will not send.
                <strong>Go to Settings to connect.</strong>
              </span>
            </div>
          }

          <!-- Stats Grid -->
          <div class="stats-grid">

            <mat-card class="stats-card clickable" [class.expanded]="activePanel === 'campaigns'"
                      (click)="toggle('campaigns')">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.totalCampaigns }}</div>
                    <div class="stat-label">Total Campaigns</div>
                    <div class="stat-sub">{{ stats.activeCampaigns }} active · {{ stats.draftCampaigns }} draft</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#1a73e8">campaign</mat-icon>
                </div>
                <div class="expand-hint">
                  <mat-icon>{{ activePanel === 'campaigns' ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stats-card clickable" [class.expanded]="activePanel === 'contacts'"
                      (click)="toggle('contacts')">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.totalContacts }}</div>
                    <div class="stat-label">Total Contacts</div>
                    <div class="stat-sub">Across all campaigns</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#34a853">people</mat-icon>
                </div>
                <div class="expand-hint">
                  <mat-icon>{{ activePanel === 'contacts' ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stats-card clickable" [class.expanded]="activePanel === 'sent'"
                      (click)="toggle('sent')">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.totalEmailsSent }}</div>
                    <div class="stat-label">Emails Sent</div>
                    <div class="stat-sub">{{ stats.emailsSentToday }} today</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#fbbc04">send</mat-icon>
                </div>
                <div class="expand-hint">
                  <mat-icon>{{ activePanel === 'sent' ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stats-card clickable" [class.expanded]="activePanel === 'scheduled'"
                      (click)="toggle('scheduled')">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.emailsScheduled }}</div>
                    <div class="stat-label">Scheduled</div>
                    <div class="stat-sub">Pending delivery</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#1a73e8">schedule</mat-icon>
                </div>
                <div class="expand-hint">
                  <mat-icon>{{ activePanel === 'scheduled' ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stats-card clickable" [class.expanded]="activePanel === 'failed'"
                      (click)="toggle('failed')">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.emailsFailed }}</div>
                    <div class="stat-label">Failed</div>
                    <div class="stat-sub">Click to view &amp; retry</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#ea4335">error_outline</mat-icon>
                </div>
                <div class="expand-hint">
                  <mat-icon>{{ activePanel === 'failed' ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>

          </div>

          <!-- Drill-down Detail Panel -->
          @if (activePanel) {
            <mat-card class="detail-panel">
              <mat-card-header>
                <mat-card-title>{{ panelTitle }}</mat-card-title>
                <button mat-icon-button (click)="activePanel = null" style="margin-left:auto">
                  <mat-icon>close</mat-icon>
                </button>
              </mat-card-header>
              <mat-card-content>

                @if (panelLoading) {
                  <div class="panel-loading"><mat-spinner diameter="32"></mat-spinner></div>
                }

                <!-- Campaigns panel -->
                @if (activePanel === 'campaigns' && !panelLoading) {
                  <table mat-table [dataSource]="campaignsDS" matSort #campaignsSort="matSort" class="panel-table">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="name">Name</th>
                      <td mat-cell *matCellDef="let c">
                        <a [routerLink]="['/campaigns', c.id]" class="link">{{ c.name }}</a>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="gmailEmail">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="gmailEmail">Email Sender</th>
                      <td mat-cell *matCellDef="let c">{{ c.gmailEmail || gmailStatus?.connectedEmail || '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="status">Status</th>
                      <td mat-cell *matCellDef="let c">
                        <span class="chip {{ c.status?.toLowerCase() }}">{{ c.status }}</span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="contacts">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="contactCount">Contacts</th>
                      <td mat-cell *matCellDef="let c">{{ c.contactCount }}</td>
                    </ng-container>
                    <ng-container matColumnDef="created">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="createdAt">Created</th>
                      <td mat-cell *matCellDef="let c">{{ c.createdAt | date:'mediumDate' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['name','gmailEmail','status','contacts','created']"></tr>
                    <tr mat-row *matRowDef="let row; columns: ['name','gmailEmail','status','contacts','created'];"></tr>
                  </table>
                  @if (campaignsDS.data.length === 0) {
                    <p class="empty-msg">No campaigns yet.</p>
                  }
                }

                <!-- Contacts panel -->
                @if (activePanel === 'contacts' && !panelLoading) {
                  <table mat-table [dataSource]="contactsDS" matSort #contactsSort="matSort" class="panel-table">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="name">Name</th>
                      <td mat-cell *matCellDef="let c">{{ c.name }}</td>
                    </ng-container>
                    <ng-container matColumnDef="role">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="role">Role</th>
                      <td mat-cell *matCellDef="let c">{{ c.role }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['name','role']"></tr>
                    <tr mat-row *matRowDef="let row; columns: ['name','role'];"></tr>
                  </table>
                  @if (contactsDS.data.length === 0) {
                    <p class="empty-msg">No contacts yet.</p>
                  }
                }

                <!-- Email jobs panels (sent / scheduled / failed) -->
                @if ((activePanel === 'sent' || activePanel === 'scheduled' || activePanel === 'failed') && !panelLoading) {
                  <div class="filter-row">
                    <mat-form-field appearance="outline" class="filter-field">
                      <mat-label>Filter by email sender</mat-label>
                      <input matInput [(ngModel)]="senderFilter" (ngModelChange)="applyFilter($event)"
                             placeholder="e.g. john@example.com">
                      <mat-icon matSuffix>search</mat-icon>
                    </mat-form-field>
                  </div>
                  <table mat-table [dataSource]="jobsDS" matSort #jobsSort="matSort" class="panel-table">
                    <ng-container matColumnDef="contact">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="contactName">Contact</th>
                      <td mat-cell *matCellDef="let j">
                        <strong>{{ j.contactName }}</strong>
                        <div class="sub">{{ j.contactEmail }}</div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="campaign">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="campaignName">Campaign</th>
                      <td mat-cell *matCellDef="let j">
                        <a [routerLink]="['/campaigns', j.campaignId]" class="link">{{ j.campaignName }}</a>
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
                    <ng-container matColumnDef="sender">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="sender">Email Sender</th>
                      <td mat-cell *matCellDef="let j">{{ gmailStatus?.connectedEmail ?? '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="time">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header="time">
                        {{ activePanel === 'sent' ? 'Sent At' : 'Scheduled For' }}
                      </th>
                      <td mat-cell *matCellDef="let j">
                        {{ (activePanel === 'sent' ? j.sentAt : j.scheduledAt) | date:'medium' }}
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="error">
                      <th mat-header-cell *matHeaderCellDef>Error</th>
                      <td mat-cell *matCellDef="let j">
                        <span class="error-msg" [matTooltip]="j.errorMessage ?? ''">
                          {{ j.errorMessage ? (j.errorMessage | slice:0:60) + (j.errorMessage.length > 60 ? '…' : '') : '' }}
                        </span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let j">
                        @if (j.status === 'FAILED') {
                          <button mat-icon-button (click)="retryJob(j)" matTooltip="Retry">
                            <mat-icon>replay</mat-icon>
                          </button>
                        }
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="jobColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: jobColumns;"></tr>
                  </table>
                  @if (jobsDS.data.length === 0) {
                    <p class="empty-msg">No {{ activePanel }} emails.</p>
                  }
                }

              </mat-card-content>
            </mat-card>
          }

          <!-- Quick Actions -->
          <div class="quick-actions">
            <h2>Quick Actions</h2>
            <div class="action-cards">
              <mat-card class="action-card" routerLink="/campaigns/new" style="cursor:pointer">
                <mat-card-content>
                  <mat-icon color="primary">add_circle</mat-icon>
                  <span>Create Campaign</span>
                </mat-card-content>
              </mat-card>
              <mat-card class="action-card" routerLink="/contacts" style="cursor:pointer">
                <mat-card-content>
                  <mat-icon color="accent">person_add</mat-icon>
                  <span>Manage Contacts</span>
                </mat-card-content>
              </mat-card>
              <mat-card class="action-card" routerLink="/campaigns" style="cursor:pointer">
                <mat-card-content>
                  <mat-icon style="color:#34a853">list</mat-icon>
                  <span>View Campaigns</span>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        }
      </div>
    </app-nav>
  `,
  styles: [`
    .loading-center { display: flex; justify-content: center; padding: 80px; }
    .gmail-warning {
      display: flex; align-items: center; gap: 10px;
      background: #fff8e1; border: 1px solid #ffca28; border-radius: 8px;
      padding: 12px 16px; margin-bottom: 20px; color: #5d4037; font-size: 14px;
      mat-icon { color: #f9a825; flex-shrink: 0; }
      &:hover { background: #fff3cd; }
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stats-card {
      cursor: pointer;
      transition: box-shadow 0.15s, border-color 0.15s;
      border: 2px solid transparent;
      &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important; }
      &.expanded { border-color: #1a73e8; }
    }
    .stat-row { display: flex; align-items: center; justify-content: space-between; }
    .stat-value { font-size: 36px; font-weight: 700; color: #202124; }
    .stat-label { font-size: 14px; color: #5f6368; font-weight: 500; margin-top: 4px; }
    .stat-sub { font-size: 12px; color: #9aa0a6; margin-top: 2px; }
    .stat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.8; }
    .expand-hint {
      display: flex; justify-content: center; margin-top: 8px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #9aa0a6; }
    }
    .detail-panel {
      margin-bottom: 24px;
      mat-card-header { display: flex; align-items: center; }
    }
    .panel-loading { display: flex; justify-content: center; padding: 32px; }
    .panel-table { width: 100%; }
    .filter-row { display: flex; align-items: center; padding-bottom: 4px; }
    .filter-field { width: 320px; }
    .link { color: #1a73e8; text-decoration: none; font-weight: 500; &:hover { text-decoration: underline; } }
    .sub { font-size: 11px; color: #9aa0a6; }
    .empty-msg { text-align: center; color: #9aa0a6; padding: 24px; font-size: 14px; }
    .error-msg { font-size: 12px; color: #c62828; }
    .chip {
      padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;
      &.draft     { background:#fff3e0; color:#e65100; }
      &.active    { background:#e8f5e9; color:#2e7d32; }
      &.paused    { background:#fff9c4; color:#f57f17; }
      &.completed { background:#ede7f6; color:#4527a0; }
    }
    .quick-actions h2 { font-size: 16px; font-weight: 500; color: #5f6368; margin-bottom: 12px; }
    .action-cards { display: flex; gap: 12px; flex-wrap: wrap; }
    .action-card {
      cursor: pointer; border-radius: 12px !important;
      transition: transform 0.15s, box-shadow 0.15s; min-width: 160px;
      &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important; }
      mat-card-content { display: flex; align-items: center; gap: 12px; padding: 16px !important; }
      span { font-size: 14px; font-weight: 500; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  gmailStatus: GmailSessionStatus | null = null;
  loading = true;

  activePanel: Panel = null;
  panelLoading = false;

  campaignsDS = new MatTableDataSource<Campaign>();
  contactsDS  = new MatTableDataSource<Contact>();
  jobsDS      = new MatTableDataSource<EmailJob>();

  senderFilter = '';

  // Setter-based ViewChild so sort attaches as soon as the conditional table renders
  @ViewChild('campaignsSort') set campaignsSortSetter(s: MatSort) {
    if (s) this.campaignsDS.sort = s;
  }
  @ViewChild('contactsSort') set contactsSortSetter(s: MatSort) {
    if (s) this.contactsDS.sort = s;
  }
  @ViewChild('jobsSort') set jobsSortSetter(s: MatSort) {
    if (s) {
      this.jobsDS.sortingDataAccessor = (item: EmailJob, prop: string) => {
        switch (prop) {
          case 'time':   return this.activePanel === 'sent' ? (item.sentAt ?? '') : (item.scheduledAt ?? '');
          case 'sender': return this.gmailStatus?.connectedEmail ?? '';
          default:       return (item as any)[prop] ?? '';
        }
      };
      this.jobsDS.sort = s;
    }
  }

  get panelTitle(): string {
    switch (this.activePanel) {
      case 'campaigns': return 'All Campaigns';
      case 'contacts':  return 'All Contacts';
      case 'sent':      return 'Sent Emails';
      case 'scheduled': return 'Scheduled Emails';
      case 'failed':    return 'Failed Emails';
      default:          return '';
    }
  }

  get jobColumns(): string[] {
    if (this.activePanel === 'failed') {
      return ['contact', 'campaign', 'step', 'subject', 'sender', 'time', 'error', 'actions'];
    }
    return ['contact', 'campaign', 'step', 'subject', 'sender', 'time'];
  }

  constructor(
    private dashboardService: DashboardService,
    private settingsService: SettingsService,
    private campaignService: CampaignService,
    private contactService: ContactService,
    private emailJobService: EmailJobService
  ) {}

  ngOnInit(): void {
    this.dashboardService.getStats().subscribe({
      next: s => { this.stats = s; this.loading = false; },
      error: () => { this.loading = false; }
    });
    this.settingsService.getStatus().subscribe({
      next: s => this.gmailStatus = s,
      error: () => {}
    });
  }

  toggle(panel: Panel): void {
    if (this.activePanel === panel) {
      this.activePanel = null;
      return;
    }
    this.senderFilter = '';
    this.activePanel = panel;
    this.loadPanel(panel!);
  }

  private loadPanel(panel: NonNullable<Panel>): void {
    this.panelLoading = true;
    switch (panel) {
      case 'campaigns':
        this.campaignService.getAll().subscribe({
          next: c => { this.campaignsDS.data = c; this.panelLoading = false; },
          error: () => { this.panelLoading = false; }
        });
        break;
      case 'contacts':
        this.contactService.getAll().subscribe({
          next: c => { this.contactsDS.data = c; this.panelLoading = false; },
          error: () => { this.panelLoading = false; }
        });
        break;
      case 'sent':
        this.emailJobService.getAll('SENT').subscribe({
          next: j => { this.jobsDS.data = j; this.panelLoading = false; },
          error: () => { this.panelLoading = false; }
        });
        break;
      case 'scheduled':
        this.emailJobService.getAll('SCHEDULED').subscribe({
          next: j => { this.jobsDS.data = j; this.panelLoading = false; },
          error: () => { this.panelLoading = false; }
        });
        break;
      case 'failed':
        this.emailJobService.getAll('FAILED').subscribe({
          next: j => { this.jobsDS.data = j; this.panelLoading = false; },
          error: () => { this.panelLoading = false; }
        });
        break;
    }
  }

  applyFilter(value: string): void {
    const filter = value.trim().toLowerCase();
    const sender = this.gmailStatus?.connectedEmail?.toLowerCase() ?? '';
    this.jobsDS.filterPredicate = (job: EmailJob, f: string) =>
      job.contactName.toLowerCase().includes(f) ||
      job.contactEmail.toLowerCase().includes(f) ||
      job.campaignName.toLowerCase().includes(f) ||
      job.subject.toLowerCase().includes(f) ||
      sender.includes(f);
    this.jobsDS.filter = filter;
  }

  retryJob(job: EmailJob): void {
    this.emailJobService.retry(job.id).subscribe({
      next: () => {
        this.emailJobService.getAll('FAILED').subscribe(j => this.jobsDS.data = j);
        this.dashboardService.getStats().subscribe(s => this.stats = s);
      }
    });
  }
}
