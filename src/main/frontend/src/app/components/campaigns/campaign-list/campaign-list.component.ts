import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../../shared/nav/nav.component';
import { CampaignService } from '../../../services/campaign.service';
import { SettingsService, GmailSessionStatus } from '../../../services/settings.service';
import { Campaign } from '../../../models/campaign.model';

@Component({
  selector: 'app-campaign-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatTableModule, MatSortModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatMenuModule, MatTooltipModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>Campaigns</h1>
          <button mat-raised-button color="primary" routerLink="/campaigns/new">
            <mat-icon>add</mat-icon> New Campaign
          </button>
        </div>

        @if (loading) {
          <div class="loading-center"><mat-spinner></mat-spinner></div>
        } @else {
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Filter campaigns</mat-label>
            <input matInput [(ngModel)]="filterValue" (input)="applyFilter(filterValue)"
                   placeholder="Name, status, sender...">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-card>
            <mat-card-content style="padding:0">
              <table mat-table [dataSource]="campaignsDS" matSort #campaignsSort="matSort" class="full-table">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Campaign Name</th>
                  <td mat-cell *matCellDef="let c">
                    <a [routerLink]="['/campaigns', c.id]" class="campaign-link">{{ c.name }}</a>
                    @if (c.description) {
                      <div class="cell-sub">{{ c.description }}</div>
                    }
                  </td>
                </ng-container>

                <ng-container matColumnDef="gmailEmail">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Email Sender</th>
                  <td mat-cell *matCellDef="let c">{{ c.gmailEmail || gmailStatus?.connectedEmail || '—' }}</td>
                </ng-container>

                <ng-container matColumnDef="contacts">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Contacts</th>
                  <td mat-cell *matCellDef="let c">{{ c.contactCount }}</td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                  <td mat-cell *matCellDef="let c">
                    <span class="status-chip {{ c.status?.toLowerCase() }}">{{ c.status }}</span>
                  </td>
                </ng-container>

                <ng-container matColumnDef="createdAt">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header>Created</th>
                  <td mat-cell *matCellDef="let c">{{ c.createdAt | date:'mediumDate' }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let c">
                    <button mat-icon-button [routerLink]="['/campaigns', c.id]" matTooltip="View">
                      <mat-icon>visibility</mat-icon>
                    </button>
                    <button mat-icon-button [matMenuTriggerFor]="menu">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #menu="matMenu">
                      @if (c.status === 'DRAFT' || c.status === 'PAUSED') {
                        <button mat-menu-item (click)="launch(c)">
                          <mat-icon>rocket_launch</mat-icon> Launch
                        </button>
                      }
                      @if (c.status === 'ACTIVE') {
                        <button mat-menu-item (click)="pause(c)">
                          <mat-icon>pause</mat-icon> Pause
                        </button>
                      }
                      @if (c.status === 'PAUSED') {
                        <button mat-menu-item (click)="resume(c)">
                          <mat-icon>play_arrow</mat-icon> Resume
                        </button>
                      }
                      <button mat-menu-item (click)="delete(c)" class="delete-action">
                        <mat-icon>delete</mat-icon> Delete
                      </button>
                    </mat-menu>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>

              @if (campaignsDS.filteredData.length === 0) {
                <div class="empty-state">
                  <mat-icon>campaign</mat-icon>
                  <p>{{ campaignsDS.data.length === 0 ? 'No campaigns yet. Create your first campaign!' : 'No campaigns match your filter.' }}</p>
                  @if (campaignsDS.data.length === 0) {
                    <button mat-raised-button color="primary" routerLink="/campaigns/new">
                      Create Campaign
                    </button>
                  }
                </div>
              }
            </mat-card-content>
          </mat-card>
        }
      </div>
    </app-nav>
  `,
  styles: [`
    .loading-center { display: flex; justify-content: center; padding: 80px; }
    .filter-field { width: 360px; display: block; margin-bottom: 16px; }
    .full-table { width: 100%; }
    .campaign-link { color: #1a73e8; text-decoration: none; font-weight: 500; }
    .campaign-link:hover { text-decoration: underline; }
    .cell-sub { font-size: 12px; color: #9aa0a6; }
    .status-chip {
      padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;
      &.draft     { background:#fff3e0; color:#e65100; }
      &.active    { background:#e8f5e9; color:#2e7d32; }
      &.paused    { background:#fff9c4; color:#f57f17; }
      &.completed { background:#ede7f6; color:#4527a0; }
    }
    .delete-action { color: #ea4335; }
    .empty-state {
      text-align: center; padding: 60px; color: #9aa0a6;
      mat-icon { font-size: 64px; width: 64px; height: 64px; margin-bottom: 16px; }
      p { font-size: 16px; margin-bottom: 16px; }
    }
  `]
})
export class CampaignListComponent implements OnInit {
  campaignsDS = new MatTableDataSource<Campaign>();
  gmailStatus: GmailSessionStatus | null = null;
  loading = true;
  filterValue = '';
  displayedColumns = ['name', 'gmailEmail', 'contacts', 'status', 'createdAt', 'actions'];

  @ViewChild('campaignsSort') set sortSetter(s: MatSort) {
    if (s) {
      this.campaignsDS.sortingDataAccessor = (item: Campaign, prop: string) => {
        switch (prop) {
          case 'contacts': return item.contactCount ?? 0;
          case 'gmailEmail': return item.gmailEmail || this.gmailStatus?.connectedEmail || '';
          default: return (item as any)[prop] ?? '';
        }
      };
      this.campaignsDS.sort = s;
    }
  }

  constructor(
    private campaignService: CampaignService,
    private settingsService: SettingsService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.settingsService.getStatus().subscribe({ next: s => this.gmailStatus = s, error: () => {} });
    this.load();
  }

  applyFilter(value: string): void {
    const f = value.trim().toLowerCase();
    const sender = this.gmailStatus?.connectedEmail?.toLowerCase() ?? '';
    this.campaignsDS.filterPredicate = (c: Campaign, filter: string) =>
      c.name.toLowerCase().includes(filter) ||
      (c.description?.toLowerCase() ?? '').includes(filter) ||
      (c.status?.toLowerCase() ?? '').includes(filter) ||
      (c.gmailEmail?.toLowerCase() ?? '').includes(filter) ||
      sender.includes(filter);
    this.campaignsDS.filter = f;
  }

  load(): void {
    this.loading = true;
    this.campaignService.getAll().subscribe({
      next: c => { this.campaignsDS.data = c; this.loading = false; },
      error: () => this.loading = false
    });
  }

  launch(c: Campaign): void {
    this.campaignService.launch(c.id!).subscribe({
      next: () => { this.snackBar.open('Campaign launched!', '', { duration: 3000, panelClass: 'snack-success' }); this.load(); },
      error: err => this.snackBar.open(err.error?.message || 'Launch failed', 'Close', { duration: 4000, panelClass: 'snack-error' })
    });
  }

  pause(c: Campaign): void {
    this.campaignService.pause(c.id!).subscribe({
      next: () => { this.snackBar.open('Campaign paused', '', { duration: 3000 }); this.load(); }
    });
  }

  resume(c: Campaign): void {
    this.campaignService.resume(c.id!).subscribe({
      next: () => { this.snackBar.open('Campaign resumed', '', { duration: 3000, panelClass: 'snack-success' }); this.load(); }
    });
  }

  delete(c: Campaign): void {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
    this.campaignService.delete(c.id!).subscribe({
      next: () => { this.snackBar.open('Campaign deleted', '', { duration: 3000 }); this.load(); }
    });
  }
}
