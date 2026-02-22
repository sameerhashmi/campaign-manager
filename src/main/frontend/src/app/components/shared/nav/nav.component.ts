import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatTooltipModule
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav mode="side" opened class="sidenav" color="primary">
        <div class="sidenav-header">
          <mat-icon class="logo-icon">campaign</mat-icon>
          <span class="logo-text">Campaign<br>Manager</span>
        </div>

        <mat-nav-list>
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active-link">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </a>
          <a mat-list-item routerLink="/campaigns" routerLinkActive="active-link">
            <mat-icon matListItemIcon>email</mat-icon>
            <span matListItemTitle>Campaigns</span>
          </a>
          <a mat-list-item routerLink="/contacts" routerLinkActive="active-link">
            <mat-icon matListItemIcon>people</mat-icon>
            <span matListItemTitle>Contacts</span>
          </a>
          <a mat-list-item routerLink="/settings" routerLinkActive="active-link">
            <mat-icon matListItemIcon>settings</mat-icon>
            <span matListItemTitle>Settings</span>
          </a>
        </mat-nav-list>

        <div class="sidenav-footer">
          <button mat-button (click)="logout()" class="logout-btn">
            <mat-icon>logout</mat-icon>
            <span>Logout ({{ username }})</span>
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="content-area">
        <ng-content></ng-content>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container { height: 100vh; }
    .sidenav {
      width: 230px;
      background: #1a73e8;
      color: white;
      display: flex;
      flex-direction: column;
    }
    .sidenav-header {
      display: flex;
      align-items: center;
      padding: 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.2);
      gap: 12px;
    }
    .logo-icon { font-size: 32px; width: 32px; height: 32px; color: white; }
    .logo-text { font-size: 14px; font-weight: 600; color: white; line-height: 1.3; }
    mat-nav-list { flex: 1; padding-top: 8px; }
    .active-link {
      background: rgba(255,255,255,0.2) !important;
      border-radius: 4px;
    }
    ::ng-deep .sidenav .mat-mdc-list-item {
      color: white !important;
      margin: 2px 8px;
      border-radius: 4px;
    }
    ::ng-deep .sidenav .mat-icon { color: white !important; }
    .sidenav-footer {
      padding: 8px;
      border-top: 1px solid rgba(255,255,255,0.2);
    }
    .logout-btn {
      width: 100%;
      color: white;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .content-area { overflow-y: auto; background: #f8f9fa; }
  `]
})
export class NavComponent {
  username = this.auth.getUsername();

  constructor(private auth: AuthService, private router: Router) {}

  logout(): void {
    this.auth.logout();
  }
}
