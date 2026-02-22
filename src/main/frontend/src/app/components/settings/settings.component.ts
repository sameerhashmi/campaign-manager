import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { NavComponent } from '../shared/nav/nav.component';
import { SettingsService, GmailSessionStatus } from '../../services/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
    NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>Settings</h1>
        </div>

        <!-- Gmail Session Card -->
        <mat-card class="settings-card">
          <mat-card-header>
            <div mat-card-avatar class="gmail-avatar">
              <mat-icon>mail</mat-icon>
            </div>
            <mat-card-title>Gmail Session</mat-card-title>
            <mat-card-subtitle>
              Log in to Gmail once — Playwright will reuse the session to send all campaign emails.
              No passwords are stored in the app.
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            @if (loading) {
              <div class="status-row">
                <mat-spinner diameter="24"></mat-spinner>
                <span class="status-text">Checking session status...</span>
              </div>
            } @else if (status) {
              <div class="status-row">
                <mat-icon [class]="status.connected ? 'icon-connected' : 'icon-disconnected'">
                  {{ status.connected ? 'check_circle' : 'cancel' }}
                </mat-icon>
                <div>
                  <div class="status-label">
                    {{ status.connected ? 'Connected' : 'Not connected' }}
                  </div>
                  @if (status.connected && status.sessionCreatedAt) {
                    <div class="status-sub">
                      Session established: {{ status.sessionCreatedAt | date:'medium' }}
                    </div>
                  }
                  <div class="status-message">{{ status.message }}</div>
                </div>
              </div>
            }
          </mat-card-content>

          <mat-divider></mat-divider>

          <mat-card-actions>
            @if (connecting) {
              <div class="connecting-hint">
                <mat-spinner diameter="20"></mat-spinner>
                <span>A browser window has opened — please log into Gmail, then wait...</span>
              </div>
            } @else {
              @if (!status?.connected) {
                <button mat-raised-button color="primary" (click)="connect()" [disabled]="connecting">
                  <mat-icon>open_in_new</mat-icon>
                  Connect Gmail
                </button>
              } @else {
                <button mat-raised-button color="primary" (click)="connect()" [disabled]="connecting">
                  <mat-icon>refresh</mat-icon>
                  Re-connect Gmail
                </button>
                <button mat-stroked-button color="warn" (click)="disconnect()" style="margin-left:8px">
                  <mat-icon>link_off</mat-icon>
                  Disconnect
                </button>
              }
            }
          </mat-card-actions>
        </mat-card>

        <!-- How it works -->
        <mat-card class="info-card">
          <mat-card-header>
            <mat-card-title>How Gmail Session Works</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <ol class="steps-list">
              <li>Click <strong>Connect Gmail</strong> — a Chrome browser window will open on your computer.</li>
              <li>Log into your Gmail account in that window (including any 2-step verification).</li>
              <li>Once you reach the Gmail inbox, the session is automatically saved and the browser closes.</li>
              <li>When campaigns run, Playwright reuses the saved session to compose and send emails —
                  no username or password is stored in the app.</li>
              <li>If your session expires (e.g. after a long period), just click <strong>Re-connect Gmail</strong>.</li>
            </ol>
          </mat-card-content>
        </mat-card>

      </div>
    </app-nav>
  `,
  styles: [`
    .settings-card { max-width: 680px; margin-bottom: 24px; }
    .info-card     { max-width: 680px; }
    mat-card-header { margin-bottom: 16px; }
    .gmail-avatar {
      background: #ea4335; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; width: 40px; height: 40px;
    }
    .gmail-avatar mat-icon { color: white; }
    .status-row {
      display: flex; align-items: flex-start; gap: 16px;
      padding: 16px 0; min-height: 48px;
    }
    .icon-connected   { color: #34a853; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .icon-disconnected{ color: #ea4335; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .status-label  { font-weight: 600; font-size: 16px; }
    .status-sub    { font-size: 13px; color: #5f6368; margin-top: 2px; }
    .status-message{ font-size: 13px; color: #5f6368; margin-top: 4px; }
    .status-text   { color: #5f6368; }
    mat-card-actions { padding: 8px 16px 12px; display: flex; align-items: center; }
    .connecting-hint {
      display: flex; align-items: center; gap: 12px;
      color: #1a73e8; font-size: 14px; padding: 4px 0;
    }
    .steps-list { margin: 0; padding-left: 20px; line-height: 2; color: #3c4043; }
  `]
})
export class SettingsComponent implements OnInit {
  status: GmailSessionStatus | null = null;
  loading = true;
  connecting = false;

  constructor(
    private settingsService: SettingsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.loading = true;
    this.settingsService.getStatus().subscribe({
      next: s => { this.status = s; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  connect(): void {
    this.connecting = true;
    this.snackBar.open('Browser opening — please log into Gmail in the new window...', '', {
      duration: 90000,
      panelClass: 'snack-info'
    });

    this.settingsService.connectGmail().subscribe({
      next: s => {
        this.connecting = false;
        this.status = s;
        this.snackBar.dismiss();
        if (s.connected) {
          this.snackBar.open('Gmail session connected successfully!', '', {
            duration: 4000, panelClass: 'snack-success'
          });
        } else {
          this.snackBar.open(s.message || 'Connection failed', 'Close', {
            duration: 6000, panelClass: 'snack-error'
          });
        }
      },
      error: err => {
        this.connecting = false;
        this.snackBar.dismiss();
        const msg = err.error?.message || 'Failed to connect Gmail session';
        this.snackBar.open(msg, 'Close', { duration: 6000, panelClass: 'snack-error' });
      }
    });
  }

  disconnect(): void {
    this.settingsService.disconnectGmail().subscribe({
      next: s => {
        this.status = s;
        this.snackBar.open('Gmail session disconnected.', '', { duration: 3000 });
      },
      error: () => this.snackBar.open('Disconnect failed', 'Close', { duration: 4000 })
    });
  }
}
