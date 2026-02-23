import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { NavComponent } from '../shared/nav/nav.component';
import { SettingsService, GmailSessionStatus } from '../../services/settings.service';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

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
              Log in to Gmail once — Playwright reuses the session to send all campaign emails.
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

              @if (status.connecting) {
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
                    @if (status.connectError) {
                      <div class="error-message">
                        <mat-icon style="font-size:16px;width:16px;height:16px">error_outline</mat-icon>
                        {{ status.connectError }}
                      </div>
                    }
                  </div>
                </div>
              }
            }
          </mat-card-content>

          <mat-divider></mat-divider>

          <mat-card-actions>
            <!-- Hidden file picker — triggered by the upload button -->
            <input #fileInput type="file" accept=".json" style="display:none"
                   (change)="onFileSelected($event)">

            @if (!status?.connecting) {
              @if (!status?.connected) {
                <button mat-raised-button color="primary" (click)="connect()">
                  <mat-icon>open_in_new</mat-icon>
                  Connect Gmail
                </button>
              } @else {
                <button mat-raised-button color="primary" (click)="connect()">
                  <mat-icon>refresh</mat-icon>
                  Re-connect Gmail
                </button>
                <button mat-stroked-button color="warn" (click)="disconnect()" style="margin-left:8px">
                  <mat-icon>link_off</mat-icon>
                  Disconnect
                </button>
              }
              <button mat-stroked-button color="accent" (click)="fileInput.click()"
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
            <mat-card-title>How Gmail Session Works</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="section-heading">Running locally (normal setup)</p>
            <ol class="steps-list">
              <li>Click <strong>Connect Gmail</strong> — a Chrome browser window opens on your computer.</li>
              <li>Log into your Gmail account in that window (including any 2-step verification).</li>
              <li>Once you reach the Gmail inbox, the session is saved and the browser closes automatically.</li>
              <li>Playwright reuses the saved session to send emails — no username or password stored in the app.</li>
              <li>If the session expires later, click <strong>Re-connect Gmail</strong>.</li>
            </ol>
            <p class="section-heading" style="margin-top:16px">Running in a headless / cloud environment (e.g. Cloud Foundry)</p>
            <ol class="steps-list">
              <li>Run the app <strong>locally</strong> on your laptop: <code>java -jar campaign-manager-1.0.0.jar</code></li>
              <li>Go to <strong>http://localhost:8080 → Settings → Connect Gmail</strong> and log in.</li>
              <li>The session file is saved to <code>./data/gmail-session.json</code> in the directory where you ran the JAR.</li>
              <li>Come back to <strong>this Settings page</strong> on the cloud app and click <strong>Upload Session File</strong>.</li>
              <li>Pick the <code>gmail-session.json</code> file — done.</li>
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
    .icon-connected    { color: #34a853; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .icon-disconnected { color: #ea4335; font-size: 28px; width: 28px; height: 28px; flex-shrink: 0; }
    .status-label   { font-weight: 600; font-size: 16px; }
    .status-sub     { font-size: 13px; color: #5f6368; margin-top: 2px; }
    .status-message { font-size: 13px; color: #5f6368; margin-top: 4px; }
    .status-text    { color: #5f6368; }
    .error-message  {
      display: flex; align-items: center; gap: 4px;
      font-size: 13px; color: #c5221f; margin-top: 6px;
    }
    mat-card-actions { padding: 8px 16px 12px; display: flex; align-items: center; }
    .steps-list { margin: 0; padding-left: 20px; line-height: 2; color: #3c4043; }
    .section-heading { font-weight: 600; font-size: 13px; color: #3c4043; margin: 0 0 4px; }
    code { background: #f1f3f4; border-radius: 3px; padding: 1px 5px; font-size: 12px; }
  `]
})
export class SettingsComponent implements OnInit, OnDestroy {
  status: GmailSessionStatus | null = null;
  loading = true;
  uploading = false;
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
      next: s => { this.status = s; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  connect(): void {
    this.settingsService.connectGmail().subscribe({
      next: s => {
        this.status = s;
        if (s.connecting) {
          this.snackBar.open(
            'Chrome window opened — log into Gmail, then wait for this page to update.',
            '', { duration: 15000, panelClass: 'snack-info' }
          );
          this.startPolling();
        }
      },
      error: (err) => {
        const msg: string = err?.error?.message
          ?? 'Could not start browser. Check that the app is running.';
        if (err?.error) { this.status = { ...this.status!, message: msg }; }
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.settingsService.uploadSession(file).subscribe({
      next: s => {
        this.status = s;
        this.uploading = false;
        this.snackBar.open('Session file uploaded — Gmail is now connected!', '', {
          duration: 5000, panelClass: 'snack-success'
        });
      },
      error: (err) => {
        this.uploading = false;
        const msg = err?.error?.message ?? 'Upload failed. Make sure the file is a valid gmail-session.json.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
    // Reset the input so the same file can be re-uploaded if needed
    (event.target as HTMLInputElement).value = '';
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

  /** Poll /status every 3 seconds while connecting; stops automatically when done. */
  private startPolling(): void {
    this.stopPolling();
    this.pollSub = interval(3000).pipe(
      switchMap(() => this.settingsService.getStatus()),
      takeWhile(s => s.connecting, true)  // include final non-connecting value then stop
    ).subscribe(s => {
      this.status = s;
      if (!s.connecting) {
        this.stopPolling();
        this.snackBar.dismiss();
        if (s.connected) {
          this.snackBar.open('Gmail session connected!', '', {
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
