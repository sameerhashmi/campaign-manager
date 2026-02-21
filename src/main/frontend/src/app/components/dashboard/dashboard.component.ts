import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NavComponent } from '../shared/nav/nav.component';
import { DashboardService } from '../../services/dashboard.service';
import { DashboardStats } from '../../models/email-job.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    NavComponent
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
          <!-- Stats Grid -->
          <div class="stats-grid">
            <mat-card class="stats-card">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.totalCampaigns }}</div>
                    <div class="stat-label">Total Campaigns</div>
                    <div class="stat-sub">{{ stats.activeCampaigns }} active · {{ stats.draftCampaigns }} draft</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#1a73e8">campaign</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stats-card">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.totalContacts }}</div>
                    <div class="stat-label">Total Contacts</div>
                    <div class="stat-sub">Across all campaigns</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#34a853">people</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stats-card">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.totalEmailsSent }}</div>
                    <div class="stat-label">Emails Sent</div>
                    <div class="stat-sub">{{ stats.emailsSentToday }} today</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#fbbc04">send</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stats-card">
              <mat-card-content>
                <div class="stat-row">
                  <div class="stat-info">
                    <div class="stat-value">{{ stats.emailsScheduled }}</div>
                    <div class="stat-label">Scheduled</div>
                    <div class="stat-sub">{{ stats.emailsFailed }} failed</div>
                  </div>
                  <mat-icon class="stat-icon" style="color:#ea4335">schedule</mat-icon>
                </div>
              </mat-card-content>
            </mat-card>
          </div>

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
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-row { display: flex; align-items: center; justify-content: space-between; }
    .stat-value { font-size: 36px; font-weight: 700; color: #202124; }
    .stat-label { font-size: 14px; color: #5f6368; font-weight: 500; margin-top: 4px; }
    .stat-sub { font-size: 12px; color: #9aa0a6; margin-top: 2px; }
    .stat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.8; }
    .quick-actions h2 { font-size: 16px; font-weight: 500; color: #5f6368; margin-bottom: 12px; }
    .action-cards { display: flex; gap: 12px; flex-wrap: wrap; }
    .action-card {
      cursor: pointer;
      border-radius: 12px !important;
      transition: transform 0.15s, box-shadow 0.15s;
      min-width: 160px;
    }
    .action-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important; }
    .action-card mat-card-content { display: flex; align-items: center; gap: 12px; padding: 16px !important; }
    .action-card span { font-size: 14px; font-weight: 500; }
  `]
})
export class DashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.dashboardService.getStats().subscribe({
      next: s => { this.stats = s; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}
