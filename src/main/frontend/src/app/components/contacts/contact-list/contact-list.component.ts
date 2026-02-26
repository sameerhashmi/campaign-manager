import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from '../../shared/nav/nav.component';
import { ContactService } from '../../../services/contact.service';
import { Contact } from '../../../models/contact.model';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-contact-list',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatTableModule, MatButtonModule, MatIconModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
    MatSnackBarModule, MatDialogModule, MatTooltipModule, NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>Contacts</h1>
          <button mat-raised-button color="primary" (click)="openForm()">
            <mat-icon>person_add</mat-icon> Add Contact
          </button>
        </div>

        <!-- Search bar -->
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search contacts</mat-label>
          <input matInput [formControl]="searchControl" placeholder="Name, email, company...">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        @if (showForm) {
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>{{ editingContact ? 'Edit Contact' : 'New Contact' }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <form [formGroup]="contactForm" (ngSubmit)="saveContact()">
                <div class="form-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Name *</mat-label>
                    <input matInput formControlName="name">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Email *</mat-label>
                    <input matInput formControlName="email" type="email">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Role</mat-label>
                    <input matInput formControlName="role">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Company</mat-label>
                    <input matInput formControlName="company">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Category</mat-label>
                    <input matInput formControlName="category" placeholder="Enterprise, SMB...">
                  </mat-form-field>
                </div>
                <div class="form-actions">
                  <button mat-button type="button" (click)="closeForm()">Cancel</button>
                  <button mat-raised-button color="primary" type="submit" [disabled]="contactForm.invalid">
                    {{ editingContact ? 'Save' : 'Create' }}
                  </button>
                </div>
              </form>
            </mat-card-content>
          </mat-card>
        }

        @if (loading) {
          <div class="loading-center"><mat-spinner></mat-spinner></div>
        } @else {
          <mat-card>
            <mat-card-content style="padding:0">
              <table mat-table [dataSource]="contacts" class="full-table">
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
                <ng-container matColumnDef="category">
                  <th mat-header-cell *matHeaderCellDef>Category</th>
                  <td mat-cell *matCellDef="let c">{{ c.category }}</td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let c">
                    <button mat-icon-button (click)="editContact(c)" matTooltip="Edit">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button (click)="deleteContact(c)" matTooltip="Delete">
                      <mat-icon style="color:#ea4335">delete</mat-icon>
                    </button>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>

              @if (contacts.length === 0) {
                <div class="empty-state">
                  <mat-icon>people_outline</mat-icon>
                  <p>No contacts found. Add a contact or import from a Google Sheet via a Campaign.</p>
                </div>
              }
            </mat-card-content>
          </mat-card>

          <div class="contact-count">{{ contacts.length }} contact(s)</div>
        }
      </div>
    </app-nav>
  `,
  styles: [`
    .header-actions { display: flex; gap: 8px; }
    .search-field { width: 360px; margin-bottom: 16px; display: block; }
    .form-card { margin-bottom: 16px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 8px; }
    .full-table { width: 100%; }
    .loading-center { display: flex; justify-content: center; padding: 80px; }
    .empty-state {
      text-align: center; padding: 60px; color: #9aa0a6;
      mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; }
    }
    .contact-count { font-size: 13px; color: #9aa0a6; margin-top: 8px; }
  `]
})
export class ContactListComponent implements OnInit {
  contacts: Contact[] = [];
  loading = true;
  showForm = false;
  editingContact: Contact | null = null;

  displayedColumns = ['name', 'email', 'role', 'company', 'category', 'actions'];
  contactForm: FormGroup;
  searchControl;
  private searchSubject = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private snackBar: MatSnackBar
  ) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: [''],
      company: [''],
      category: ['']
    });
    this.searchControl = this.fb.control('');
  }

  ngOnInit(): void {
    this.load();
    this.searchControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(val => this.load(val ?? undefined));
  }

  load(search?: string): void {
    this.loading = true;
    this.contactService.getAll(search).subscribe({
      next: c => { this.contacts = c; this.loading = false; },
      error: () => this.loading = false
    });
  }

  openForm(): void {
    this.editingContact = null;
    this.contactForm.reset();
    this.showForm = true;
  }

  editContact(c: Contact): void {
    this.editingContact = c;
    this.contactForm.patchValue(c);
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingContact = null;
  }

  saveContact(): void {
    if (this.contactForm.invalid) return;
    const data = this.contactForm.value;
    const req = this.editingContact
        ? this.contactService.update(this.editingContact.id!, data)
        : this.contactService.create(data);

    req.subscribe({
      next: () => {
        this.snackBar.open('Contact saved', '', { duration: 3000, panelClass: 'snack-success' });
        this.closeForm();
        this.load();
      },
      error: err => this.snackBar.open(err.error?.message || 'Save failed', 'Close', { duration: 4000, panelClass: 'snack-error' })
    });
  }

  deleteContact(c: Contact): void {
    if (!confirm(`Delete contact "${c.name}"?`)) return;
    this.contactService.delete(c.id!).subscribe(() => {
      this.snackBar.open('Contact deleted', '', { duration: 3000 });
      this.load();
    });
  }

}
