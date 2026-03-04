import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../shared/nav/nav.component';
import { SettingsService, GmailSessionStatus, ConnectedSession } from '../../services/settings.service';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
    MatInputModule, MatFormFieldModule, MatTableModule, MatTooltipModule,
    NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>Settings</h1>
        </div>

        <!-- Gmail Sessions Card -->
        <mat-card class="settings-card">
          <mat-card-header>
            <div mat-card-avatar class="gmail-avatar">
              <mat-icon>mail</mat-icon>
            </div>
            <mat-card-title>Gmail Sessions</mat-card-title>
            <mat-card-subtitle>
              Each Gmail account is stored as a separate session.
              Campaigns send from the account assigned to them.
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            @if (loading) {
              <div class="status-row">
                <mat-spinner diameter="24"></mat-spinner>
                <span class="status-text">Checking sessions...</span>
              </div>
            } @else if (status?.connecting) {
              <div class="connecting-banner">
                <mat-spinner diameter="28"></mat-spinner>
                <div>
                  <div class="connecting-title">Browser window is open</div>
                  <div class="connecting-sub">
                    Log into Gmail in the Chrome window that just appeared on your screen.
                    <strong>Do not close it.</strong> This page updates automatically when done.
                  </div>
                </div>
              </div>
            } @else {
              <!-- Sessions table -->
              @if (sessions.length > 0) {
                <table mat-table [dataSource]="sessions" class="sessions-table">
                  <ng-container matColumnDef="email">
                    <th mat-header-cell *matHeaderCellDef>Gmail Account</th>
                    <td mat-cell *matCellDef="let s">
                      <div class="session-email">
                        <mat-icon class="email-icon">check_circle</mat-icon>
                        <div>
                          <div class="email-addr">{{ s.email }}</div>
                          @if (s.connectedAt) {
                            <div class="email-sub">Connected {{ s.connectedAt | date:'mediumDate' }}</div>
                          }
                        </div>
                      </div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="campaigns">
                    <th mat-header-cell *matHeaderCellDef>Campaigns</th>
                    <td mat-cell *matCellDef="let s">{{ s.campaignCount }}</td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let s" style="white-space:nowrap">
                      <button mat-stroked-button (click)="refreshSession(s.email)"
                              [disabled]="uploading"
                              matTooltip="Upload a new session file for this account — no need to disconnect first"
                              style="margin-right:6px">
                        <mat-icon>sync</mat-icon> Refresh
                      </button>
                      <button mat-stroked-button color="warn"
                              (click)="disconnectOne(s.email, s.campaignCount)"
                              matTooltip="Remove this Gmail session">
                        <mat-icon>link_off</mat-icon> Disconnect
                      </button>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="['email','campaigns','actions']"></tr>
                  <tr mat-row *matRowDef="let row; columns: ['email','campaigns','actions'];"></tr>
                </table>
              } @else {
                <div class="no-sessions">
                  <mat-icon>cancel</mat-icon>
                  <span>No Gmail sessions connected. Use one of the options below.</span>
                </div>
              }

              @if (status?.connectError) {
                <div class="error-message" style="margin-top:8px">
                  <mat-icon style="font-size:16px;width:16px;height:16px">error_outline</mat-icon>
                  {{ status!.connectError }}
                </div>
              }
            }
          </mat-card-content>

          @if (status?.cloudEnvironment) {
            <div class="cloud-notice">
              <mat-icon class="cloud-notice-icon">cloud</mat-icon>
              <span>Running in a cloud / headless environment — browser login is not available.
                Use <strong>Upload Session File</strong> below.</span>
            </div>
          }

          <mat-divider></mat-divider>

          <mat-card-actions>
            <input #fileInput type="file" accept=".json" style="display:none"
                   (change)="onFileSelected($event)">
            <input #refreshInput type="file" accept=".json" style="display:none"
                   (change)="onRefreshFileSelected($event)">

            @if (!status?.connecting) {
              @if (!status?.cloudEnvironment) {
                <button mat-raised-button color="primary" (click)="connect()">
                  <mat-icon>add</mat-icon>
                  Add Gmail Account
                </button>
              }
              <button mat-stroked-button (click)="fileInput.click()"
                      [disabled]="uploading" style="margin-left:8px">
                <mat-icon>upload_file</mat-icon>
                {{ uploading ? 'Uploading…' : 'Upload Session File' }}
              </button>
            }
          </mat-card-actions>
        </mat-card>

        <!-- How it works -->
        <mat-card class="info-card">
          <mat-card-header>
            <mat-card-title>How Gmail Sessions Work</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="section-heading">Running locally (normal setup)</p>
            <ol class="steps-list">
              <li>Click <strong>Add Gmail Account</strong> — a Chrome browser window opens.</li>
              <li>Log into the Gmail account you want to send from.</li>
              <li>Once you reach the Gmail inbox the session is saved automatically.</li>
              <li>Repeat for each additional Gmail account you want to use.</li>
              <li>When creating a campaign, choose which account to send from.</li>
            </ol>
            <p class="section-heading" style="margin-top:16px">Running in a headless / cloud environment (e.g. Cloud Foundry)</p>
            <ol class="steps-list">
              <li>Run the app locally: <code>java -jar campaign-manager-1.0.0.jar</code></li>
              <li>Go to <strong>http://localhost:8080 → Settings → Add Gmail Account</strong> and log in.</li>
              <li>The session is saved to <code>./data/sessions/&#123;email&#125;.json</code>.</li>
              <li>Upload that file here using <strong>Upload Session File</strong>.</li>
            </ol>
          </mat-card-content>
        </mat-card>


      </div>
    </app-nav>
  `,
  styles: [`
    .settings-card { max-width: 760px; margin-bottom: 24px; }
    .info-card     { max-width: 760px; }
    mat-card-header { margin-bottom: 16px; }
    .gmail-avatar {
      background: #ea4335; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; width: 40px; height: 40px;
    }
    .gmail-avatar mat-icon { color: white; }
    .connecting-banner {
      display: flex; align-items: flex-start; gap: 16px;
      background: #e8f0fe; border-radius: 8px; padding: 16px;
    }
    .connecting-title { font-weight: 600; font-size: 15px; color: #1a73e8; margin-bottom: 4px; }
    .connecting-sub   { font-size: 13px; color: #3c4043; }
    .status-row {
      display: flex; align-items: flex-start; gap: 16px;
      padding: 16px 0; min-height: 48px;
    }
    .status-text { color: #5f6368; }
    .no-sessions {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 0; color: #9aa0a6; font-size: 14px;
      mat-icon { color: #ea4335; }
    }
    .sessions-table { width: 100%; margin-bottom: 8px; }
    .session-email { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .email-icon { color: #34a853; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .email-addr { font-weight: 600; font-size: 14px; color: #202124; }
    .email-sub  { font-size: 12px; color: #5f6368; }
    .error-message {
      display: flex; align-items: center; gap: 4px;
      font-size: 13px; color: #c5221f;
    }
    mat-card-actions { padding: 8px 16px 12px; display: flex; align-items: center; }
    .steps-list { margin: 0; padding-left: 20px; line-height: 2; color: #3c4043; }
    .section-heading { font-weight: 600; font-size: 13px; color: #3c4043; margin: 0 0 4px; }
    code { background: #f1f3f4; border-radius: 3px; padding: 1px 5px; font-size: 12px; }
    .paste-avatar {
      background: #1a73e8; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; width: 40px; height: 40px;
    }
    .paste-avatar mat-icon { color: white; }
    .cookie-avatar {
      background: #f9ab00; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; width: 40px; height: 40px;
    }
    .cookie-avatar mat-icon { color: white; }
    .ext-link { color: #1a73e8; font-weight: 600; }
    .cloud-notice {
      display: flex; align-items: center; gap: 10px;
      background: #e8f0fe; border-radius: 6px;
      padding: 10px 16px; margin: 0 16px 8px; font-size: 13px; color: #3c4043;
    }
    .cloud-notice-icon { color: #1a73e8; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
  `]
})
export class SettingsComponent implements OnInit, OnDestroy {
  @ViewChild('refreshInput') refreshInputEl!: ElementRef<HTMLInputElement>;

  status: GmailSessionStatus | null = null;
  sessions: ConnectedSession[] = [];
  loading = true;
  uploading = false;
  pastedJson = '';
  cookieJson = '';
  refreshTargetEmail = '';
  private pollSub?: Subscription;

  constructor(
    private settingsService: SettingsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadStatus(): void {
    this.loading = true;
    this.settingsService.getStatus().subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  connect(): void {
    this.settingsService.connectGmail().subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        if (s.connecting) {
          this.snackBar.open(
            'Chrome window opened — log into Gmail, then wait for this page to update.',
            '', { duration: 15000, panelClass: 'snack-info' }
          );
          this.startPolling();
        }
      },
      error: (err) => {
        const msg: string = err?.error?.message ?? 'Could not start browser.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.snackBar.open('Uploading and verifying session — this may take 10–20 seconds…', '', { duration: 30000 });
    this.settingsService.uploadSession(file).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.uploading = false;
        this.snackBar.dismiss();
        this.snackBar.open(s.message || 'Session uploaded!', '', {
          duration: 5000, panelClass: 'snack-success'
        });
      },
      error: (err) => {
        this.uploading = false;
        this.snackBar.dismiss();
        const msg = err?.error?.message ?? 'Upload failed.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
    (event.target as HTMLInputElement).value = '';
  }

  savePastedJson(): void {
    const trimmed = this.pastedJson.trim();
    try {
      JSON.parse(trimmed);
    } catch {
      this.snackBar.open('Invalid JSON — please paste the full contents of gmail-session.json.', 'Close', {
        duration: 6000, panelClass: 'snack-error'
      });
      return;
    }
    const blob = new Blob([trimmed], { type: 'application/json' });
    const file = new File([blob], 'gmail-session.json', { type: 'application/json' });
    this.uploading = true;
    this.snackBar.open('Saving and verifying session — this may take 10–20 seconds…', '', { duration: 30000 });
    this.settingsService.uploadSession(file).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.uploading = false;
        this.pastedJson = '';
        this.snackBar.dismiss();
        this.snackBar.open(s.message || 'Session saved!', '', {
          duration: 5000, panelClass: 'snack-success'
        });
      },
      error: (err) => {
        this.uploading = false;
        this.snackBar.dismiss();
        const msg = err?.error?.message ?? 'Save failed.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
  }

  saveCookieJson(): void {
    const trimmed = this.cookieJson.trim();
    try {
      JSON.parse(trimmed);
    } catch {
      this.snackBar.open('Invalid JSON — paste the Cookie Editor export (an array starting with [).', 'Close', {
        duration: 6000, panelClass: 'snack-error'
      });
      return;
    }
    this.uploading = true;
    this.snackBar.open('Importing cookies and verifying session — this may take 10–20 seconds…', '', { duration: 30000 });
    this.settingsService.importCookies(trimmed).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.uploading = false;
        this.cookieJson = '';
        this.snackBar.dismiss();
        this.snackBar.open(s.message || 'Gmail cookies imported!', '', {
          duration: 5000, panelClass: 'snack-success'
        });
      },
      error: err => {
        this.uploading = false;
        this.snackBar.dismiss();
        const msg = err?.error?.message ?? 'Import failed.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
  }

  refreshSession(email: string): void {
    this.refreshTargetEmail = email;
    this.refreshInputEl.nativeElement.value = '';
    this.refreshInputEl.nativeElement.click();
  }

  onRefreshFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.snackBar.open(
      `Refreshing session for ${this.refreshTargetEmail} — this may take 10–20 seconds…`,
      '', { duration: 30000 }
    );
    this.settingsService.uploadSession(file).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.uploading = false;
        this.snackBar.dismiss();
        this.snackBar.open(s.message || `Session refreshed for ${this.refreshTargetEmail}!`, '', {
          duration: 5000, panelClass: 'snack-success'
        });
        this.refreshTargetEmail = '';
      },
      error: (err) => {
        this.uploading = false;
        this.snackBar.dismiss();
        const msg = err?.error?.message ?? 'Refresh failed.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
        this.refreshTargetEmail = '';
      }
    });
    (event.target as HTMLInputElement).value = '';
  }

  disconnectOne(email: string, campaignCount: number): void {
    const warning = campaignCount > 0
      ? `\n\nWarning: ${campaignCount} campaign(s) use this account. Their scheduled emails will fail until you reconnect.\n\nTip: Use "Refresh" to replace the session without any downtime.`
      : '';
    if (!confirm(`Disconnect Gmail session for ${email}?${warning}`)) return;
    this.settingsService.disconnectSession(email).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.snackBar.open(`${email} disconnected.`, '', { duration: 3000 });
      },
      error: () => this.snackBar.open('Disconnect failed', 'Close', { duration: 4000 })
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollSub = interval(3000).pipe(
      switchMap(() => this.settingsService.getStatus()),
      takeWhile(s => s.connecting, true)
    ).subscribe(s => {
      this.status = s;
      this.sessions = s.sessions ?? [];
      if (!s.connecting) {
        this.stopPolling();
        this.snackBar.dismiss();
        if (s.connected) {
          this.snackBar.open('Gmail account connected!', '', {
            duration: 4000, panelClass: 'snack-success'
          });
        } else if (s.connectError) {
          this.snackBar.open(s.connectError, 'Close', {
            duration: 8000, panelClass: 'snack-error'
          });
        }
      }
    });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }
}
