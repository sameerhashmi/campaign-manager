import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NavComponent } from '../../shared/nav/nav.component';
import { CampaignService } from '../../../services/campaign.service';

@Component({
  selector: 'app-campaign-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule,
    NavComponent
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

              <mat-form-field appearance="outline">
                <mat-label>Gmail Account</mat-label>
                <input matInput formControlName="gmailEmail" type="email" placeholder="you@gmail.com">
                <mat-icon matSuffix>email</mat-icon>
                @if (form.get('gmailEmail')?.hasError('required')) {
                  <mat-error>Gmail address is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Gmail App Password</mat-label>
                <input matInput formControlName="gmailPassword" [type]="hidePassword ? 'password' : 'text'"
                       placeholder="App password (not your main password)">
                <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword">
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-hint>Use a Gmail App Password for best results. <a href="https://myaccount.google.com/apppasswords" target="_blank">Create one here</a></mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" style="margin-top: 8px">
                <mat-label>Email Interval Days</mat-label>
                <input matInput formControlName="intervalDays" placeholder="0,3,7,14,21,30">
                <mat-hint>Comma-separated days from enrollment. E.g. "0,3,7,14,21,30" sends 6 emails.</mat-hint>
                @if (form.get('intervalDays')?.hasError('required')) {
                  <mat-error>Interval days is required</mat-error>
                }
              </mat-form-field>

              <div class="tokens-info">
                <strong>Available template tokens:</strong>
                <span class="token">{{ tokenName }}</span>
                <span class="token">{{ tokenRole }}</span>
                <span class="token">{{ tokenCompany }}</span>
                <span class="token">{{ tokenCategory }}</span>
              </div>

              <div class="form-actions">
                <button mat-button type="button" (click)="cancel()">Cancel</button>
                <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
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
    .tokens-info {
      background: #e8f0fe; padding: 12px 16px; border-radius: 8px;
      font-size: 13px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
    }
    .token {
      background: #1a73e8; color: white; padding: 2px 8px;
      border-radius: 4px; font-family: monospace; font-size: 12px;
    }
    mat-spinner { margin: 0 auto; }
    a { color: #1a73e8; }
  `]
})
export class CampaignFormComponent implements OnInit {
  form: FormGroup;
  saving = false;
  hidePassword = true;
  editId?: number;

  readonly tokenName = '{{name}}';
  readonly tokenRole = '{{role}}';
  readonly tokenCompany = '{{company}}';
  readonly tokenCategory = '{{category}}';

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
      gmailEmail: ['', [Validators.required, Validators.email]],
      gmailPassword: [''],
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

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const campaign = this.form.value;

    const request = this.editId
        ? this.campaignService.update(this.editId, campaign)
        : this.campaignService.create(campaign);

    request.subscribe({
      next: c => {
        this.snackBar.open(this.editId ? 'Campaign updated' : 'Campaign created', '', { duration: 3000, panelClass: 'snack-success' });
        this.router.navigate(['/campaigns', c.id]);
      },
      error: err => {
        this.saving = false;
        this.snackBar.open(err.error?.message || 'Save failed', 'Close', { duration: 4000, panelClass: 'snack-error' });
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/campaigns']);
  }
}
