import { Component, Inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ClientBriefingService } from '../../services/client-briefing.service';

@Component({
  selector: 'app-add-briefing-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule
  ],
  template: `
    <h2 mat-dialog-title>Add Client Briefing</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Client Name *</mat-label>
          <input matInput formControlName="clientName" placeholder="e.g. Citadel">
          @if (form.get('clientName')?.hasError('required') && form.get('clientName')?.touched) {
            <mat-error>Client name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Document Link (optional)</mat-label>
          <input matInput formControlName="documentLink"
                 placeholder="https://docs.google.com/...">
          <mat-hint>URL to any external document</mat-hint>
        </mat-form-field>

        <div class="upload-section">
          <div class="upload-label">Upload Document (optional)</div>
          <div class="upload-hint">Accepted: PDF, DOC, DOCX, HTML — max 10 MB</div>
          <div class="upload-row">
            <button mat-stroked-button type="button" (click)="fileInput.click()">
              <mat-icon>upload_file</mat-icon>
              {{ selectedFile ? 'Change File' : 'Choose File' }}
            </button>
            @if (selectedFile) {
              <span class="file-name">{{ selectedFile.name }}</span>
              <button mat-icon-button type="button" (click)="clearFile()">
                <mat-icon>close</mat-icon>
              </button>
            } @else {
              <span class="no-file">No file chosen</span>
            }
          </div>
          <input #fileInput type="file"
                 accept=".pdf,.doc,.docx,.html,.htm"
                 style="display:none"
                 (change)="onFileSelected($event)">
        </div>

      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-raised-button color="primary"
              [disabled]="form.invalid || saving || !hasAtLeastOneDocument()"
              (click)="save()">
        {{ saving ? 'Saving...' : 'Add Client' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 16px; min-width: 420px; padding-top: 8px; }
    .full-width { width: 100%; }
    .upload-section { display: flex; flex-direction: column; gap: 6px; }
    .upload-label { font-size: 14px; font-weight: 500; color: rgba(0,0,0,0.7); }
    .upload-hint { font-size: 12px; color: rgba(0,0,0,0.5); }
    .upload-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .file-name { font-size: 13px; color: #1a73e8; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .no-file { font-size: 13px; color: rgba(0,0,0,0.4); }
  `]
})
export class AddBriefingDialogComponent {
  form: FormGroup;
  selectedFile: File | null = null;
  saving = false;

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AddBriefingDialogComponent>,
    private briefingService: ClientBriefingService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.form = this.fb.group({
      clientName: ['', Validators.required],
      documentLink: ['']
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  clearFile(): void {
    this.selectedFile = null;
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  hasAtLeastOneDocument(): boolean {
    const link = this.form.get('documentLink')?.value?.trim();
    return !!(link || this.selectedFile);
  }

  save(): void {
    if (this.form.invalid || !this.hasAtLeastOneDocument()) return;
    this.saving = true;
    const { clientName, documentLink } = this.form.value;
    this.briefingService.create(clientName, documentLink || null, this.selectedFile).subscribe({
      next: (result: any) => {
        this.saving = false;
        this.dialogRef.close(result);
      },
      error: (err: any) => {
        this.saving = false;
        this.dialogRef.close({ error: err?.error?.message || 'Failed to save briefing' });
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
