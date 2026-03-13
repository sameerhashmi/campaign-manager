import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <div class="login-header">
            <mat-icon class="login-icon">campaign</mat-icon>
            <h1>Campaign Manager</h1>
            <p>{{ isRegisterMode ? 'Create your account' : 'Sign in to your account' }}</p>
          </div>
        </mat-card-header>

        <mat-card-content>
          @if (!isRegisterMode) {
            <form [formGroup]="loginForm" (ngSubmit)="login()">
              <mat-form-field appearance="outline">
                <mat-label>Username</mat-label>
                <input matInput formControlName="username" autocomplete="username">
                <mat-icon matSuffix>person</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Password</mat-label>
                <input matInput [type]="hidePassword ? 'password' : 'text'"
                       formControlName="password" autocomplete="current-password">
                <button mat-icon-button matSuffix type="button"
                        (click)="hidePassword = !hidePassword">
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </mat-form-field>

              <button mat-raised-button color="primary" type="submit"
                      [disabled]="loginForm.invalid || loading" class="login-btn">
                @if (loading) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  Sign In
                }
              </button>
            </form>

            <div class="toggle-row">
              <span>Don't have an account?</span>
              <button mat-button color="primary" type="button" (click)="switchMode(true)">Create Account</button>
            </div>
          } @else {
            <form [formGroup]="registerForm" (ngSubmit)="register()">
              <mat-form-field appearance="outline">
                <mat-label>Email Address</mat-label>
                <input matInput formControlName="email" autocomplete="email" type="email"
                       placeholder="you@gmail.com">
                <mat-icon matSuffix>email</mat-icon>
                @if (registerForm.get('email')?.hasError('required') && registerForm.get('email')?.touched) {
                  <mat-error>Email is required</mat-error>
                }
                @if (registerForm.get('email')?.hasError('email') && registerForm.get('email')?.touched) {
                  <mat-error>Enter a valid email address</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Password</mat-label>
                <input matInput [type]="hidePassword ? 'password' : 'text'"
                       formControlName="password" autocomplete="new-password">
                <button mat-icon-button matSuffix type="button"
                        (click)="hidePassword = !hidePassword">
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (registerForm.get('password')?.hasError('minlength') && registerForm.get('password')?.touched) {
                  <mat-error>Password must be at least 6 characters</mat-error>
                }
              </mat-form-field>

              <button mat-raised-button color="primary" type="submit"
                      [disabled]="registerForm.invalid || loading" class="login-btn">
                @if (loading) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  Create Account
                }
              </button>
            </form>

            <div class="toggle-row">
              <span>Already have an account?</span>
              <button mat-button color="primary" type="button" (click)="switchMode(false)">Sign In</button>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
    }
    .login-card {
      width: 380px;
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2) !important;
    }
    .login-header {
      text-align: center;
      width: 100%;
      padding: 16px 0 8px;
    }
    .login-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1a73e8;
    }
    h1 { font-size: 22px; font-weight: 600; margin: 8px 0 4px; color: #202124; }
    p { color: #5f6368; margin: 0; font-size: 13px; }
    form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px 0;
    }
    .login-btn {
      height: 44px;
      font-size: 15px;
      border-radius: 8px;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-top: 8px;
      font-size: 13px;
      color: #5f6368;
    }
    mat-spinner { margin: 0 auto; }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  registerForm: FormGroup;
  loading = false;
  hidePassword = true;
  isRegisterMode = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  switchMode(register: boolean): void {
    this.isRegisterMode = register;
    this.loading = false;
    this.hidePassword = true;
  }

  login(): void {
    if (this.loginForm.invalid) return;
    this.loading = true;
    const { username, password } = this.loginForm.value;

    this.auth.login(username, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.loading = false;
        this.snackBar.open('Invalid username or password', 'Close', { duration: 3000, panelClass: 'snack-error' });
      }
    });
  }

  register(): void {
    if (this.registerForm.invalid) return;
    this.loading = true;
    const { email, password } = this.registerForm.value;

    this.auth.register(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err: any) => {
        this.loading = false;
        const msg = err?.error?.message || 'Registration failed. Please try again.';
        this.snackBar.open(msg, 'Close', { duration: 4000, panelClass: 'snack-error' });
      }
    });
  }
}
