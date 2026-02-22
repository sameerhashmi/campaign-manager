import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { NavComponent } from '../../shared/nav/nav.component';
import { CampaignService, ExcelImportResult } from '../../../services/campaign.service';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule,
    MatDividerModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>{{ editId ? 'Edit Campaign' : 'New Campaign' }}</h1>
        </div>

        <mat-card style="max-width: 700px">
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="save()">

              <mat-form-field appearance="outline">
                <mat-label>Campaign Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Q1 Outreach">
                @if (form.get('name')?.hasError('required')) {
                  <mat-error>Name is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Description (optional)</mat-label>
                <textarea matInput formControlName="description" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline" style="margin-top: 8px">
                <mat-label>Email Interval Days</mat-label>
                <input matInput formControlName="intervalDays" placeholder="0,3,7,14,21,30">
                <mat-hint>Comma-separated days from enrollment. E.g. "0,3,7,14,21,30" sends 6 emails.</mat-hint>
                @if (form.get('intervalDays')?.hasError('required')) {
                  <mat-error>Interval days is required</mat-error>
                }
              </mat-form-field>

              <div class="session-notice">
                <mat-icon class="notice-icon">info</mat-icon>
                <span>
                  Emails are sent using the Gmail session configured in
                  <a routerLink="/settings">Settings</a>.
                  No credentials needed here.
                </span>
              </div>

              <mat-divider style="margin: 8px 0"></mat-divider>

              <!-- Excel Import Section (only for new campaigns) -->
              @if (!editId) {
                <div class="excel-section">
                  <div class="excel-header">
                    <mat-icon>table_chart</mat-icon>
                    <div>
                      <strong>Import Contacts &amp; Templates from Excel</strong>
                      <div class="excel-sub">
                        Upload an .xlsx file to automatically import contacts and email templates.
                      </div>
                    </div>
                  </div>

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

                  <div class="excel-format-hint">
                    <strong>Expected format:</strong>
                    Sheet 1 "Contacts" — columns: <code>name</code>, <code>email</code>, <code>role</code>, <code>company</code>
                    &nbsp;|&nbsp;
                    Sheet 2 "Templates" — columns: <code>step_number</code>, <code>subject</code>, <code>body</code>
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
                  @else { {{ editId ? 'Save Changes' : 'Create Campaign' }} }
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
    .excel-section { display: flex; flex-direction: column; gap: 12px; }
    .excel-header {
      display: flex; align-items: flex-start; gap: 10px;
      mat-icon { color: #188038; margin-top: 2px; }
    }
    .excel-sub { font-size: 12px; color: #5f6368; margin-top: 2px; }
    .file-drop-area {
      border: 2px dashed #dadce0; border-radius: 8px;
      padding: 20px; display: flex; align-items: center; gap: 10px;
      cursor: pointer; color: #5f6368; font-size: 14px;
      transition: border-color 0.2s;
      &:hover { border-color: #1a73e8; color: #1a73e8; }
      &.has-file { border-color: #188038; color: #188038; background: #f0faf4; }
      mat-icon { flex-shrink: 0; }
    }
    .excel-format-hint {
      font-size: 12px; color: #5f6368;
      background: #f8f9fa; padding: 8px 12px; border-radius: 4px;
      code { background: #e8eaed; padding: 1px 4px; border-radius: 3px; }
    }
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
  selectedFile: File | null = null;
  importResult: ExcelImportResult | null = null;

  constructor(
    private fb: FormBuilder,
    private campaignService: CampaignService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      gmailEmail: [''],
      intervalDays: ['0,3,7,14,21,30', Validators.required]
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.editId = +id;
      this.campaignService.getById(this.editId).subscribe(c => {
        this.form.patchValue({
          name: c.name,
          description: c.description,
          gmailEmail: c.gmailEmail,
          intervalDays: c.intervalDays
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
        if (!this.editId && this.selectedFile) {
          // After creation, import the Excel file
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
            error: () => {
              this.saving = false;
              this.snackBar.open('Campaign created, but Excel import failed.', 'Close', {
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
