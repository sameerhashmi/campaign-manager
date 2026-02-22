import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../../shared/nav/nav.component';
import { CampaignService } from '../../../services/campaign.service';
import { ContactService } from '../../../services/contact.service';
import { Campaign, EmailTemplate } from '../../../models/campaign.model';
import { Contact } from '../../../models/contact.model';
import { EmailJob } from '../../../models/email-job.model';
import { EmailJobService } from '../../../services/email-job.service';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatTabsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatTableModule, MatChipsModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatCheckboxModule,
    MatTooltipModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        @if (loading) {
          <div class="loading-center"><mat-spinner></mat-spinner></div>
        } @else if (campaign) {
          <div class="page-header">
            <div class="header-left">
              <button mat-icon-button routerLink="/campaigns"><mat-icon>arrow_back</mat-icon></button>
              <div>
                <h1>{{ campaign.name }}</h1>
                <span class="status-chip {{ campaign.status?.toLowerCase() }}">{{ campaign.status }}</span>
              </div>
            </div>
            <div class="header-actions">
              @if (campaign.status === 'DRAFT' || campaign.status === 'PAUSED') {
                <button mat-raised-button color="primary" (click)="launch()">
                  <mat-icon>rocket_launch</mat-icon> Launch
                </button>
              }
              @if (campaign.status === 'ACTIVE') {
                <button mat-stroked-button (click)="pause()"><mat-icon>pause</mat-icon> Pause</button>
              }
              @if (campaign.status === 'PAUSED') {
                <button mat-raised-button color="primary" (click)="resume()"><mat-icon>play_arrow</mat-icon> Resume</button>
              }
            </div>
          </div>

          <mat-tab-group animationDuration="200ms">

            <!-- TAB 1: Overview -->
            <mat-tab label="Overview">
              <div class="tab-content">
                <mat-card style="max-width:600px">
                  <mat-card-header><mat-card-title>Campaign Settings</mat-card-title></mat-card-header>
                  <mat-card-content>
                    <div class="detail-grid">
                      <div class="detail-row"><span class="label">Gmail Account</span><span>{{ campaign.gmailEmail }}</span></div>
                      <div class="detail-row"><span class="label">Contacts</span><span>{{ campaign.contactCount }}</span></div>
                      <div class="detail-row"><span class="label">Created</span><span>{{ campaign.createdAt | date:'medium' }}</span></div>
                      @if (campaign.launchedAt) {
                        <div class="detail-row"><span class="label">Launched</span><span>{{ campaign.launchedAt | date:'medium' }}</span></div>
                      }
                    </div>
                    <div class="card-actions">
                      <button mat-stroked-button [routerLink]="['/campaigns', campaign.id, 'edit']"
                              (click)="editCampaign()">
                        <mat-icon>edit</mat-icon> Edit
                      </button>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </mat-tab>

            <!-- TAB 2: Templates -->
            <mat-tab label="Email Templates ({{ templates.length }})">
              <div class="tab-content">
                <div class="tab-actions">
                  <button mat-raised-button color="primary" (click)="openTemplateForm()">
                    <mat-icon>add</mat-icon> Add Step
                  </button>
                </div>

                @if (showTemplateForm) {
                  <mat-card class="form-card">
                    <mat-card-header>
                      <mat-card-title>{{ editingTemplate ? 'Edit' : 'Add' }} Email Step</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                      <form [formGroup]="templateForm" (ngSubmit)="saveTemplate()">
                        <mat-form-field appearance="outline">
                          <mat-label>Step Number</mat-label>
                          <input matInput type="number" formControlName="stepNumber" min="1" max="20">
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Subject</mat-label>
                          <input matInput formControlName="subject" [placeholder]="subjectPlaceholder">
                        </mat-form-field>
                        <mat-form-field appearance="outline">
                          <mat-label>Body Template</mat-label>
                          <textarea matInput formControlName="bodyTemplate" rows="8"
                                    [placeholder]="bodyPlaceholder"></textarea>
                          <mat-hint>Use: {{ tokenName }} {{ tokenRole }} {{ tokenCompany }} {{ tokenCategory }}</mat-hint>
                        </mat-form-field>
                        <div class="scheduled-at-field">
                          <label class="dt-label">Send Date &amp; Time <span class="required-star">*</span></label>
                          <input type="datetime-local" formControlName="scheduledAt" class="dt-input">
                          <div class="dt-hint">Set the exact date and time to send this email step.</div>
                          @if (templateForm.get('scheduledAt')?.hasError('required') && templateForm.get('scheduledAt')?.touched) {
                            <div class="dt-error">Send date and time is required</div>
                          }
                        </div>
                        <div class="form-actions">
                          <button mat-button type="button" (click)="cancelTemplateForm()">Cancel</button>
                          <button mat-raised-button color="primary" type="submit" [disabled]="templateForm.invalid">Save</button>
                        </div>
                      </form>
                    </mat-card-content>
                  </mat-card>
                }

                @for (t of templates; track t.id) {
                  <mat-card class="template-card">
                    <mat-card-header>
                      <mat-card-title>
                        <mat-icon>mail</mat-icon>
                        Step {{ t.stepNumber }} — {{ t.subject }}
                      </mat-card-title>
                      <div class="template-actions">
                        <button mat-icon-button (click)="editTemplate(t)" matTooltip="Edit">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button (click)="deleteTemplate(t)" matTooltip="Delete">
                          <mat-icon style="color:#ea4335">delete</mat-icon>
                        </button>
                      </div>
                    </mat-card-header>
                    <mat-card-content>
                      @if (t.scheduledAt) {
                        <div class="schedule-badge">
                          <mat-icon>schedule</mat-icon>
                          Sends: {{ t.scheduledAt | date:'medium' }}
                        </div>
                      } @else {
                        <div class="schedule-badge missing">
                          <mat-icon>warning</mat-icon>
                          No send date set — edit this step to add one before launching.
                        </div>
                      }
                      <pre class="body-preview">{{ t.bodyTemplate }}</pre>
                    </mat-card-content>
                  </mat-card>
                }

                @if (templates.length === 0 && !showTemplateForm) {
                  <div class="empty-state">
                    <mat-icon>mail_outline</mat-icon>
                    <p>No email templates yet. Add your first email step.</p>
                  </div>
                }
              </div>
            </mat-tab>

            <!-- TAB 3: Contacts -->
            <mat-tab label="Contacts ({{ enrolledContacts.length }})">
              <div class="tab-content">
                <div class="tab-actions">
                  <button mat-raised-button color="primary" (click)="showContactPicker = !showContactPicker">
                    <mat-icon>person_add</mat-icon> Add Contacts
                  </button>
                </div>

                @if (showContactPicker) {
                  <mat-card class="form-card">
                    <mat-card-header><mat-card-title>Select Contacts to Add</mat-card-title></mat-card-header>
                    <mat-card-content>
                      <table mat-table [dataSource]="availableContacts" style="width:100%">
                        <ng-container matColumnDef="select">
                          <th mat-header-cell *matHeaderCellDef></th>
                          <td mat-cell *matCellDef="let c">
                            <mat-checkbox (change)="toggleContact(c.id!)"
                                          [checked]="selectedContactIds.has(c.id!)"></mat-checkbox>
                          </td>
                        </ng-container>
                        <ng-container matColumnDef="name">
                          <th mat-header-cell *matHeaderCellDef>Name</th>
                          <td mat-cell *matCellDef="let c">{{ c.name }}</td>
                        </ng-container>
                        <ng-container matColumnDef="email">
                          <th mat-header-cell *matHeaderCellDef>Email</th>
                          <td mat-cell *matCellDef="let c">{{ c.email }}</td>
                        </ng-container>
                        <ng-container matColumnDef="company">
                          <th mat-header-cell *matHeaderCellDef>Company</th>
                          <td mat-cell *matCellDef="let c">{{ c.company }}</td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="['select','name','email','company']"></tr>
                        <tr mat-row *matRowDef="let row; columns: ['select','name','email','company'];"></tr>
                      </table>
                      <div class="form-actions" style="margin-top:12px">
                        <button mat-button (click)="showContactPicker = false; selectedContactIds.clear()">Cancel</button>
                        <button mat-raised-button color="primary" (click)="assignContacts()"
                                [disabled]="selectedContactIds.size === 0">
                          Add {{ selectedContactIds.size }} Contact(s)
                        </button>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }

                <table mat-table [dataSource]="enrolledContacts" class="full-table">
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Name</th>
                    <td mat-cell *matCellDef="let c">{{ c.name }}</td>
                  </ng-container>
                  <ng-container matColumnDef="email">
                    <th mat-header-cell *matHeaderCellDef>Email</th>
                    <td mat-cell *matCellDef="let c">{{ c.email }}</td>
                  </ng-container>
                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Role</th>
                    <td mat-cell *matCellDef="let c">{{ c.role }}</td>
                  </ng-container>
                  <ng-container matColumnDef="company">
                    <th mat-header-cell *matHeaderCellDef>Company</th>
                    <td mat-cell *matCellDef="let c">{{ c.company }}</td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let c">
                      <button mat-icon-button (click)="removeContact(c.id!)" matTooltip="Remove">
                        <mat-icon style="color:#ea4335">person_remove</mat-icon>
                      </button>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="contactColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: contactColumns;"></tr>
                </table>

                @if (enrolledContacts.length === 0 && !showContactPicker) {
                  <div class="empty-state">
                    <mat-icon>people_outline</mat-icon>
                    <p>No contacts enrolled yet.</p>
                  </div>
                }
              </div>
            </mat-tab>

            <!-- TAB 4: Email Jobs -->
            <mat-tab label="Email Jobs ({{ jobs.length }})">
              <div class="tab-content">
                <table mat-table [dataSource]="jobs" class="full-table">
                  <ng-container matColumnDef="contact">
                    <th mat-header-cell *matHeaderCellDef>Contact</th>
                    <td mat-cell *matCellDef="let j">
                      <strong>{{ j.contactName }}</strong>
                      <div class="cell-sub">{{ j.contactEmail }}</div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="step">
                    <th mat-header-cell *matHeaderCellDef>Step</th>
                    <td mat-cell *matCellDef="let j">{{ j.stepNumber }}</td>
                  </ng-container>
                  <ng-container matColumnDef="subject">
                    <th mat-header-cell *matHeaderCellDef>Subject</th>
                    <td mat-cell *matCellDef="let j">{{ j.subject }}</td>
                  </ng-container>
                  <ng-container matColumnDef="scheduledAt">
                    <th mat-header-cell *matHeaderCellDef>Scheduled</th>
                    <td mat-cell *matCellDef="let j">{{ j.scheduledAt | date:'medium' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="sentAt">
                    <th mat-header-cell *matHeaderCellDef>Sent At</th>
                    <td mat-cell *matCellDef="let j">{{ j.sentAt ? (j.sentAt | date:'medium') : '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let j">
                      <span class="status-chip {{ j.status.toLowerCase() }}">{{ j.status }}</span>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let j">
                      @if (j.status === 'FAILED') {
                        <button mat-icon-button (click)="retryJob(j)" matTooltip="Retry">
                          <mat-icon>replay</mat-icon>
                        </button>
                      }
                      @if (j.errorMessage) {
                        <button mat-icon-button [matTooltip]="j.errorMessage">
                          <mat-icon style="color:#ea4335">error_outline</mat-icon>
                        </button>
                      }
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="jobColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: jobColumns;"></tr>
                </table>

                @if (jobs.length === 0) {
                  <div class="empty-state">
                    <mat-icon>inbox</mat-icon>
                    <p>No email jobs yet. Launch the campaign to generate jobs.</p>
                  </div>
                }
              </div>
            </mat-tab>

          </mat-tab-group>
        }
      </div>
    </app-nav>
  `,
  styles: [`
    .loading-center { display: flex; justify-content: center; padding: 80px; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-actions { display: flex; gap: 8px; }
    .status-chip {
      padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;
      &.draft     { background:#fff3e0; color:#e65100; }
      &.active    { background:#e8f5e9; color:#2e7d32; }
      &.paused    { background:#fff9c4; color:#f57f17; }
      &.completed { background:#ede7f6; color:#4527a0; }
      &.scheduled { background:#e3f2fd; color:#1565c0; }
      &.sent      { background:#e8f5e9; color:#2e7d32; }
      &.failed    { background:#ffebee; color:#c62828; }
    }
    .tab-content { padding: 24px 0; }
    .tab-actions { margin-bottom: 16px; }
    .form-card { margin-bottom: 16px; max-width: 700px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; }
    form { display: flex; flex-direction: column; gap: 12px; }
    .template-card { margin-bottom: 12px; }
    .template-actions { margin-left: auto; display: flex; }
    mat-card-header { display: flex; align-items: center; }
    .body-preview {
      white-space: pre-wrap; font-size: 13px; color: #5f6368;
      background: #f8f9fa; padding: 12px; border-radius: 4px; margin: 0;
      max-height: 150px; overflow-y: auto;
    }
    .schedule-badge {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #1a73e8; margin-bottom: 10px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.missing { color: #e37400; }
    }
    .scheduled-at-field {
      display: flex; flex-direction: column; gap: 4px;
    }
    .dt-label { font-size: 14px; color: #5f6368; font-weight: 500; }
    .required-star { color: #ea4335; }
    .dt-input {
      border: 1px solid #dadce0; border-radius: 4px; padding: 10px 12px;
      font-size: 14px; color: #202124; width: 100%; box-sizing: border-box;
      &:focus { outline: none; border-color: #1a73e8; }
    }
    .dt-hint { font-size: 12px; color: #5f6368; }
    .dt-error { font-size: 12px; color: #ea4335; }
    .detail-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .detail-row { display: flex; gap: 16px; align-items: baseline; }
    .label { width: 130px; font-weight: 500; color: #5f6368; font-size: 13px; flex-shrink: 0; }
    .card-actions { padding-top: 8px; border-top: 1px solid #f0f0f0; }
    .full-table { width: 100%; }
    .cell-sub { font-size: 12px; color: #9aa0a6; }
    .empty-state {
      text-align: center; padding: 60px; color: #9aa0a6;
      mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; }
    }
  `]
})
export class CampaignDetailComponent implements OnInit {
  campaign: Campaign | null = null;
  templates: EmailTemplate[] = [];
  enrolledContacts: Contact[] = [];
  availableContacts: Contact[] = [];
  jobs: EmailJob[] = [];
  loading = true;

  // Token display strings (avoids Angular treating {{...}} as bindings)
  readonly tokenName = '{{name}}';
  readonly tokenRole = '{{role}}';
  readonly tokenCompany = '{{company}}';
  readonly tokenCategory = '{{category}}';
  readonly subjectPlaceholder = 'Hi {{name}}, quick question...';
  readonly bodyPlaceholder = 'Dear {{name}},\n\nI wanted to reach out regarding...';

  showTemplateForm = false;
  showContactPicker = false;
  editingTemplate: EmailTemplate | null = null;
  selectedContactIds = new Set<number>();

  templateForm: FormGroup;
  contactColumns = ['name', 'email', 'role', 'company', 'actions'];
  jobColumns = ['contact', 'step', 'subject', 'scheduledAt', 'sentAt', 'status', 'actions'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private campaignService: CampaignService,
    private contactService: ContactService,
    private emailJobService: EmailJobService,
    private snackBar: MatSnackBar
  ) {
    this.templateForm = this.fb.group({
      stepNumber: [1, [Validators.required, Validators.min(1)]],
      subject: ['', Validators.required],
      bodyTemplate: ['', Validators.required],
      scheduledAt: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.load(id);
  }

  load(id: number): void {
    this.loading = true;
    this.campaignService.getById(id).subscribe(c => {
      this.campaign = c;
      this.loading = false;
    });
    this.campaignService.getTemplates(id).subscribe(t => this.templates = t);
    this.campaignService.getContacts(id).subscribe(c => this.enrolledContacts = c);
    this.campaignService.getJobs(id).subscribe(j => this.jobs = j);
    this.contactService.getAll().subscribe(all => {
      this.availableContacts = all.filter(c => !this.enrolledContacts.some(e => e.id === c.id));
    });
  }

  get campaignId(): number { return this.campaign?.id ?? 0; }

  launch(): void {
    this.campaignService.launch(this.campaignId).subscribe({
      next: c => { this.campaign = c; this.snackBar.open('Campaign launched!', '', { duration: 3000, panelClass: 'snack-success' }); this.load(this.campaignId); },
      error: err => this.snackBar.open(err.error?.message || 'Launch failed', 'Close', { duration: 5000, panelClass: 'snack-error' })
    });
  }

  pause(): void {
    this.campaignService.pause(this.campaignId).subscribe(c => {
      this.campaign = c;
      this.snackBar.open('Campaign paused', '', { duration: 3000 });
    });
  }

  resume(): void {
    this.campaignService.resume(this.campaignId).subscribe(c => {
      this.campaign = c;
      this.snackBar.open('Campaign resumed', '', { duration: 3000, panelClass: 'snack-success' });
    });
  }

  editCampaign(): void {
    this.router.navigate(['/campaigns', this.campaignId, 'edit']);
  }

  openTemplateForm(): void {
    this.editingTemplate = null;
    this.templateForm.reset({ stepNumber: this.templates.length + 1, scheduledAt: '' });
    this.showTemplateForm = true;
  }

  editTemplate(t: EmailTemplate): void {
    this.editingTemplate = t;
    // Convert ISO string (2024-06-01T09:00:00) → datetime-local format (2024-06-01T09:00)
    const scheduledAt = t.scheduledAt ? t.scheduledAt.substring(0, 16) : '';
    this.templateForm.patchValue({ ...t, scheduledAt });
    this.showTemplateForm = true;
  }

  cancelTemplateForm(): void {
    this.showTemplateForm = false;
    this.editingTemplate = null;
  }

  saveTemplate(): void {
    if (this.templateForm.invalid) return;
    // datetime-local gives "2024-06-01T09:00"; backend expects full ISO "2024-06-01T09:00:00"
    const raw = this.templateForm.value;
    const scheduledAt = raw.scheduledAt ? raw.scheduledAt + ':00' : null;
    const data = { ...raw, scheduledAt, campaignId: this.campaignId };
    const req = this.editingTemplate
        ? this.campaignService.updateTemplate(this.campaignId, this.editingTemplate.id!, data)
        : this.campaignService.addTemplate(this.campaignId, data);

    req.subscribe({
      next: () => {
        this.showTemplateForm = false;
        this.snackBar.open('Template saved', '', { duration: 2000, panelClass: 'snack-success' });
        this.campaignService.getTemplates(this.campaignId).subscribe(t => this.templates = t);
      },
      error: err => this.snackBar.open(err.error?.message || 'Save failed', 'Close', { duration: 4000 })
    });
  }

  deleteTemplate(t: EmailTemplate): void {
    if (!confirm('Delete this email step?')) return;
    this.campaignService.deleteTemplate(this.campaignId, t.id!).subscribe(() => {
      this.campaignService.getTemplates(this.campaignId).subscribe(tmpl => this.templates = tmpl);
    });
  }

  toggleContact(id: number): void {
    if (this.selectedContactIds.has(id)) this.selectedContactIds.delete(id);
    else this.selectedContactIds.add(id);
  }

  assignContacts(): void {
    const ids = Array.from(this.selectedContactIds);
    this.campaignService.assignContacts(this.campaignId, ids).subscribe({
      next: res => {
        this.snackBar.open(`Added ${res.added} contact(s)`, '', { duration: 3000, panelClass: 'snack-success' });
        this.showContactPicker = false;
        this.selectedContactIds.clear();
        this.campaignService.getContacts(this.campaignId).subscribe(c => this.enrolledContacts = c);
        this.contactService.getAll().subscribe(all => {
          this.availableContacts = all.filter(c => !this.enrolledContacts.some(e => e.id === c.id));
        });
      }
    });
  }

  removeContact(contactId: number): void {
    if (!confirm('Remove this contact from the campaign?')) return;
    this.campaignService.removeContact(this.campaignId, contactId).subscribe(() => {
      this.campaignService.getContacts(this.campaignId).subscribe(c => this.enrolledContacts = c);
    });
  }

  retryJob(job: EmailJob): void {
    this.emailJobService.retry(job.id).subscribe({
      next: () => {
        this.snackBar.open('Job scheduled for retry', '', { duration: 3000 });
        this.campaignService.getJobs(this.campaignId).subscribe(j => this.jobs = j);
      }
    });
  }
}
