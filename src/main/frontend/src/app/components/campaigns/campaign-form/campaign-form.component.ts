import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../../shared/nav/nav.component';
import { CampaignService, ExcelImportResult } from '../../../services/campaign.service';
import { SettingsService, GmailSessionStatus } from '../../../services/settings.service';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule,
    MatDividerModule, MatTooltipModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>{{ editId ? 'Edit Campaign' : 'New Campaign' }}</h1>
        </div>

        <mat-card style="max-width: 760px">
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="save()">

              <mat-form-field appearance="outline">
                <mat-label>Campaign Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Citadel Email Campaign by SA">
                <mat-hint>Format: &lt;Company Name&gt; Email Campaign By &lt;AE/SA&gt; — e.g. Citadel Email Campaign by SA</mat-hint>
                @if (form.get('name')?.hasError('required')) {
                  <mat-error>Name is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Description (optional)</mat-label>
                <textarea matInput formControlName="description" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Tanzu Contact (optional)</mat-label>
                <input matInput formControlName="tanzuContact" placeholder="e.g. Jane Smith">
                <mat-hint>Internal VMware/Tanzu contact associated with this campaign</mat-hint>
              </mat-form-field>

              <div class="session-notice">
                <mat-icon class="notice-icon">info</mat-icon>
                <div>
                  @if (gmailStatus?.connectedEmail) {
                    Emails will be sent from <strong>{{ gmailStatus!.connectedEmail }}</strong>
                    (Gmail session configured in <a routerLink="/settings">Settings</a>).
                  } @else {
                    Emails are sent using the Gmail session configured in
                    <a routerLink="/settings">Settings</a>.
                    No credentials needed here.
                  }
                </div>
              </div>

              <mat-divider style="margin: 8px 0"></mat-divider>

              <!-- Import Section (only for new campaigns) -->
              @if (!editId) {
                <div class="import-section">
                  <div class="section-title">
                    <mat-icon>upload_file</mat-icon>
                    <strong>Import Contacts from Spreadsheet</strong>
                  </div>
                  <div class="section-sub">
                    Each row = one contact with their own 7-email schedule and Google Doc link.
                  </div>

                  <!-- Mode toggle -->
                  <div class="mode-tabs">
                    <button type="button" class="mode-tab" [class.active]="importMode === 'excel'"
                            (click)="importMode = 'excel'">
                      <mat-icon>table_chart</mat-icon> Upload Excel File
                    </button>
                    <button type="button" class="mode-tab" [class.active]="importMode === 'gsheet'"
                            (click)="importMode = 'gsheet'">
                      <mat-icon>table_view</mat-icon> Google Sheets URL
                    </button>
                  </div>

                  <!-- Excel upload -->
                  @if (importMode === 'excel') {
                    <div class="file-drop-area" (click)="fileInput.click()"
                         [class.has-file]="selectedFile">
                      <mat-icon>upload_file</mat-icon>
                      @if (selectedFile) {
                        <span>{{ selectedFile.name }}</span>
                        <button mat-icon-button type="button" (click)="clearFile($event)"
                                matTooltip="Remove file">
                          <mat-icon>close</mat-icon>
                        </button>
                      } @else {
                        <span>Click to choose an Excel file (.xlsx)</span>
                      }
                      <input #fileInput type="file" accept=".xlsx,.xls" hidden
                             (change)="onFileSelected($event)">
                    </div>
                  }

                  <!-- Google Sheets URL -->
                  @if (importMode === 'gsheet') {
                    <mat-form-field appearance="outline" style="width:100%">
                      <mat-label>Google Sheets URL</mat-label>
                      <input matInput [(ngModel)]="gsheetUrl"
                             [ngModelOptions]="{standalone: true}"
                             placeholder="https://docs.google.com/spreadsheets/d/...">
                      <mat-icon matSuffix>link</mat-icon>
                      <mat-hint>Must be accessible with your connected Google/Gmail account</mat-hint>
                    </mat-form-field>
                  }

                  <!-- Column reference grid -->
                  <div class="col-ref">
                    <div class="col-ref-title">Expected spreadsheet columns:</div>
                    <div class="col-grid">
                      <div class="col-item required">
                        <span class="col-name">Name</span>
                        <span class="col-badge req">Required</span>
                      </div>
                      <div class="col-item required">
                        <span class="col-name">Email</span>
                        <span class="col-badge req">Required</span>
                      </div>
                      <div class="col-item">
                        <span class="col-name">Title</span>
                        <span class="col-badge opt">Optional</span>
                      </div>
                      <div class="col-item">
                        <span class="col-name">Phone</span>
                        <span class="col-badge opt">Optional</span>
                      </div>
                      <div class="col-item">
                        <span class="col-name">Company</span>
                        <span class="col-badge opt">Optional</span>
                      </div>
                      <div class="col-item">
                        <span class="col-name">Play</span>
                        <span class="col-badge opt">Optional</span>
                      </div>
                      <div class="col-item">
                        <span class="col-name">Sub Play</span>
                        <span class="col-badge opt">Optional</span>
                      </div>
                      <div class="col-item">
                        <span class="col-name">AE/SA</span>
                        <span class="col-badge opt">Optional</span>
                      </div>
                      <div class="col-item required">
                        <span class="col-name">Email Link</span>
                        <span class="col-badge req">Google Doc URL</span>
                      </div>
                      <div class="col-item required">
                        <span class="col-name">Email 1–7</span>
                        <span class="col-badge req">Send dates</span>
                      </div>
                      <div class="col-item">
                        <span class="col-name">Opt Out</span>
                        <span class="col-badge skip">Y = skip row</span>
                      </div>
                    </div>
                  </div>

                  <!-- Google Doc format hint -->
                  <div class="doc-hint">
                    <mat-icon class="doc-hint-icon">description</mat-icon>
                    <div>
                      <strong>Email Link</strong> must be a Google Doc URL. The doc must contain sections:
                      <div class="doc-example">
                        Email 1:<br>
                        Subject: Your subject line here<br>
                        Body of the first email…<br><br>
                        Email 2:<br>
                        Subject: Follow-up subject<br>
                        Body of the second email…
                      </div>
                      Supported tokens in subject &amp; body:
                      <code>{{ tokenName }}</code>
                      <code>{{ tokenTitle }}</code>
                      <code>{{ tokenCompany }}</code>
                      <code>{{ tokenPlay }}</code>
                    </div>
                  </div>

                  @if (importResult) {
                    <div class="import-result" [class.has-errors]="importResult.errors.length > 0">
                      <mat-icon>{{ importResult.errors.length === 0 ? 'check_circle' : 'warning' }}</mat-icon>
                      <div>
                        <strong>{{ importResult.message }}</strong>
                        @for (err of importResult.errors; track err) {
                          <div class="import-error">{{ err }}</div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              <div class="form-actions">
                <button mat-button type="button" (click)="cancel()">Cancel</button>
                <button mat-raised-button color="primary" type="submit"
                        [disabled]="form.invalid || saving">
                  @if (saving) { <mat-spinner diameter="18"></mat-spinner> }
                  @else {
                    {{ editId ? 'Save Changes' : (hasImport ? 'Create &amp; Import' : 'Create Campaign') }}
                  }
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    </app-nav>
  `,
  styles: [`
    form { display: flex; flex-direction: column; gap: 16px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 8px; }
    .session-notice {
      display: flex; align-items: center; gap: 10px;
      background: #e8f0fe; padding: 10px 14px; border-radius: 8px;
      font-size: 13px; color: #1a73e8;
    }
    .notice-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .session-notice a { color: #1a73e8; font-weight: 600; }
    .import-section { display: flex; flex-direction: column; gap: 12px; }
    .section-title {
      display: flex; align-items: center; gap: 8px; font-size: 15px;
      mat-icon { color: #188038; }
    }
    .section-sub { font-size: 12px; color: #5f6368; margin-top: -4px; }
    .mode-tabs {
      display: flex; gap: 0; border: 1px solid #dadce0; border-radius: 8px;
      overflow: hidden; width: fit-content;
    }
    .mode-tab {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 18px; border: none; background: #f8f9fa; cursor: pointer;
      font-size: 13px; font-weight: 500; color: #5f6368; transition: background 0.15s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.active { background: #1a73e8; color: #fff; }
      &:not(.active):hover { background: #e8eaed; }
    }
    .file-drop-area {
      border: 2px dashed #dadce0; border-radius: 8px;
      padding: 20px; display: flex; align-items: center; gap: 10px;
      cursor: pointer; color: #5f6368; font-size: 14px;
      transition: border-color 0.2s;
      &:hover { border-color: #1a73e8; color: #1a73e8; }
      &.has-file { border-color: #188038; color: #188038; background: #f0faf4; }
      mat-icon { flex-shrink: 0; }
    }
    .col-ref {
      background: #f8f9fa; border-radius: 8px; padding: 12px 14px;
    }
    .col-ref-title { font-size: 12px; font-weight: 600; color: #5f6368; margin-bottom: 10px; }
    .col-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px;
    }
    .col-item {
      display: flex; flex-direction: column; gap: 3px;
      background: #fff; border: 1px solid #e8eaed; border-radius: 6px; padding: 8px 10px;
      &.required { border-color: #1a73e8; }
    }
    .col-name { font-size: 13px; font-weight: 600; color: #202124; }
    .col-badge {
      font-size: 10px; border-radius: 3px; padding: 1px 5px; width: fit-content;
      &.req { background: #e8f0fe; color: #1a73e8; }
      &.opt { background: #f1f3f4; color: #5f6368; }
      &.skip { background: #fce8e6; color: #c5221f; }
    }
    .doc-hint {
      display: flex; gap: 10px; align-items: flex-start;
      background: #fff8e1; padding: 12px 14px; border-radius: 8px; font-size: 12px; color: #5f6368;
    }
    .doc-hint-icon { color: #f9ab00; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px; }
    .doc-example {
      font-family: monospace; font-size: 11px; background: #fff3cd; padding: 8px;
      border-radius: 4px; margin: 6px 0; white-space: pre-wrap; line-height: 1.6;
    }
    code { background: #e8eaed; padding: 1px 5px; border-radius: 3px; font-size: 11px; margin: 0 2px; }
    .import-result {
      display: flex; gap: 10px; align-items: flex-start;
      background: #e8f5e9; padding: 10px 14px; border-radius: 8px;
      font-size: 13px; color: #1e8e3e;
      mat-icon { flex-shrink: 0; }
      &.has-errors { background: #fff3e0; color: #e37400; }
    }
    .import-error { font-size: 12px; margin-top: 4px; color: #c5221f; }
    mat-spinner { margin: 0 auto; }
  `]
})
export class CampaignFormComponent implements OnInit {
  form: FormGroup;
  saving = false;
  editId?: number;
  importMode: 'excel' | 'gsheet' = 'excel';
  selectedFile: File | null = null;
  gsheetUrl = '';
  importResult: ExcelImportResult | null = null;
  gmailStatus: GmailSessionStatus | null = null;

  // Token display strings (avoids Angular treating {{...}} as interpolation bindings)
  readonly tokenName = '{{name}}';
  readonly tokenTitle = '{{title}}';
  readonly tokenCompany = '{{company}}';
  readonly tokenPlay = '{{play}}';

  get hasImport(): boolean {
    return this.importMode === 'excel' ? !!this.selectedFile : !!this.gsheetUrl.trim();
  }

  constructor(
    private fb: FormBuilder,
    private campaignService: CampaignService,
    private settingsService: SettingsService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      gmailEmail: [''],
      tanzuContact: ['']
    });
  }

  ngOnInit(): void {
    this.settingsService.getStatus().subscribe({ next: s => this.gmailStatus = s, error: () => {} });
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.editId = +id;
      this.campaignService.getById(this.editId).subscribe(c => {
        this.form.patchValue({
          name: c.name,
          description: c.description,
          gmailEmail: c.gmailEmail,
          tanzuContact: c.tanzuContact
        });
      });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.importResult = null;
  }

  clearFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
    this.importResult = null;
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const campaign = this.form.value;

    const request = this.editId
        ? this.campaignService.update(this.editId, campaign)
        : this.campaignService.create(campaign);

    request.subscribe({
      next: c => {
        if (!this.editId && this.importMode === 'excel' && this.selectedFile) {
          this.campaignService.importExcel(c.id!, this.selectedFile).subscribe({
            next: result => {
              this.saving = false;
              this.importResult = result;
              const msg = result.errors.length === 0
                  ? `Campaign created! ${result.message}`
                  : `Campaign created with warnings. ${result.message}`;
              this.snackBar.open(msg, '', { duration: 5000, panelClass: 'snack-success' });
              this.router.navigate(['/campaigns', c.id]);
            },
            error: err => {
              this.saving = false;
              this.snackBar.open(err?.error?.message || 'Campaign created, but Excel import failed.', 'Close', {
                duration: 5000, panelClass: 'snack-error'
              });
              this.router.navigate(['/campaigns', c.id]);
            }
          });
        } else if (!this.editId && this.importMode === 'gsheet' && this.gsheetUrl.trim()) {
          this.campaignService.importGoogleSheet(c.id!, this.gsheetUrl.trim()).subscribe({
            next: result => {
              this.saving = false;
              this.importResult = result;
              const msg = result.errors.length === 0
                  ? `Campaign created! ${result.message}`
                  : `Campaign created with warnings. ${result.message}`;
              this.snackBar.open(msg, '', { duration: 5000, panelClass: 'snack-success' });
              this.router.navigate(['/campaigns', c.id]);
            },
            error: err => {
              this.saving = false;
              this.snackBar.open(err?.error?.message || 'Campaign created, but Google Sheet import failed.', 'Close', {
                duration: 5000, panelClass: 'snack-error'
              });
              this.router.navigate(['/campaigns', c.id]);
            }
          });
        } else {
          this.saving = false;
          this.snackBar.open(this.editId ? 'Campaign updated' : 'Campaign created', '', {
            duration: 3000, panelClass: 'snack-success'
          });
          this.router.navigate(['/campaigns', c.id]);
        }
      },
      error: err => {
        this.saving = false;
        this.snackBar.open(err.error?.message || 'Save failed', 'Close', {
          duration: 4000, panelClass: 'snack-error'
        });
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/campaigns']);
  }
}
