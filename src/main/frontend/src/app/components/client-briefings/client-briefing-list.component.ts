import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../shared/nav/nav.component';
import { ClientBriefingService } from '../../services/client-briefing.service';
import { ClientBriefing } from '../../models/client-briefing.model';
import { AddBriefingDialogComponent } from './add-briefing-dialog.component';

@Component({
  selector: 'app-client-briefing-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>Client Sales Briefings</h1>
          <button mat-raised-button color="primary" (click)="openAddDialog()">
            <mat-icon>add</mat-icon> Add Client
          </button>
        </div>

        @if (loading) {
          <div class="loading-center"><mat-spinner></mat-spinner></div>
        } @else {
          <mat-card>
            <mat-card-content style="padding:0">
              <table mat-table [dataSource]="briefings" class="full-table">

                <ng-container matColumnDef="clientName">
                  <th mat-header-cell *matHeaderCellDef>Client Name</th>
                  <td mat-cell *matCellDef="let b">{{ b.clientName }}</td>
                </ng-container>

                <ng-container matColumnDef="salesBriefing">
                  <th mat-header-cell *matHeaderCellDef>Sales Briefing</th>
                  <td mat-cell *matCellDef="let b">
                    <div class="briefing-links">
                      @if (b.documentLink) {
                        <a [href]="b.documentLink" target="_blank" rel="noopener noreferrer"
                           class="doc-link" matTooltip="Open external document">
                          <mat-icon class="link-icon">open_in_new</mat-icon>
                          Document Link
                        </a>
                      }
                      @if (b.documentUrl) {
                        <a [href]="b.documentUrl" target="_blank" rel="noopener noreferrer"
                           class="doc-link" [matTooltip]="b.originalFileName || 'Uploaded File'">
                          <mat-icon class="link-icon">description</mat-icon>
                          {{ b.originalFileName || 'Uploaded File' }}
                        </a>
                      }
                      @if (!b.documentLink && !b.documentUrl) {
                        <span class="no-doc">—</span>
                      }
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="createdAt">
                  <th mat-header-cell *matHeaderCellDef>Added</th>
                  <td mat-cell *matCellDef="let b">{{ b.createdAt | date:'mediumDate' }}</td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let b">
                    <button mat-icon-button (click)="delete(b)" matTooltip="Delete">
                      <mat-icon style="color:#ea4335">delete</mat-icon>
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>

              @if (briefings.length === 0) {
                <div class="empty-state">
                  <mat-icon>folder_open</mat-icon>
                  <p>No client briefings yet. Click "Add Client" to create one.</p>
                </div>
              }
            </mat-card-content>
          </mat-card>

          <div class="record-count">{{ briefings.length }} briefing(s)</div>
        }
      </div>
    </app-nav>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .page-header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #202124; }
    .full-table { width: 100%; }
    .loading-center { display: flex; justify-content: center; padding: 80px; }
    .briefing-links { display: flex; flex-direction: column; gap: 4px; }
    .doc-link {
      display: inline-flex; align-items: center; gap: 4px;
      color: #1a73e8; text-decoration: none; font-size: 13px;
    }
    .doc-link:hover { text-decoration: underline; }
    .link-icon { font-size: 16px; width: 16px; height: 16px; }
    .no-doc { color: #9aa0a6; }
    .record-count { font-size: 13px; color: #9aa0a6; margin-top: 8px; }
    .empty-state { text-align: center; padding: 60px; color: #9aa0a6; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; }
  `]
})
export class ClientBriefingListComponent implements OnInit {
  briefings: ClientBriefing[] = [];
  loading = true;
  displayedColumns = ['clientName', 'salesBriefing', 'createdAt', 'actions'];

  private briefingService = inject(ClientBriefingService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.briefingService.getAll().subscribe({
      next: (data: ClientBriefing[]) => { this.briefings = data; this.loading = false; },
      error: () => this.loading = false
    });
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(AddBriefingDialogComponent, {
      width: '520px',
      disableClose: true,
      data: {}
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (!result) return;
      if (result.error) {
        this.snackBar.open(result.error, 'Close', { duration: 4000, panelClass: 'snack-error' });
        return;
      }
      this.snackBar.open('Client briefing added', '', { duration: 3000, panelClass: 'snack-success' });
      this.load();
    });
  }

  delete(b: ClientBriefing): void {
    if (!confirm(`Delete briefing for "${b.clientName}"? This cannot be undone.`)) return;
    this.briefingService.delete(b.id!).subscribe({
      next: () => {
        this.snackBar.open('Briefing deleted', '', { duration: 3000 });
        this.load();
      },
      error: () => this.snackBar.open('Delete failed', 'Close', { duration: 4000, panelClass: 'snack-error' })
    });
  }
}
