import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../services/auth.service';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    MatSidenavModule, MatIconModule, MatButtonModule, MatTooltipModule
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav
        mode="side"
        opened
        class="sidenav"
        [style.width]="collapsed ? '60px' : '220px'">

        <!-- Header -->
        <div class="nav-header">
          <div class="brand" [class.brand-collapsed]="collapsed">
            <div class="brand-hex">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A1.001 1.001 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z"/>
              </svg>
            </div>
            @if (!collapsed) {
              <div class="brand-text">
                <span class="brand-title">Campaign</span>
                <span class="brand-sub">Manager</span>
              </div>
            }
          </div>
          <div style="display:flex;align-items:center;gap:2px">
            <button class="collapse-btn" (click)="themeService.toggle()"
                    [matTooltip]="themeService.isDark ? 'Light mode' : 'Dark mode'" matTooltipPosition="right">
              <mat-icon>{{ themeService.isDark ? 'light_mode' : 'dark_mode' }}</mat-icon>
            </button>
            <button class="collapse-btn" (click)="collapsed = !collapsed"
                    [matTooltip]="collapsed ? 'Expand' : 'Collapse'" matTooltipPosition="right">
              <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
            </button>
          </div>
        </div>

        <!-- Nav Items -->
        <nav class="nav-list">
          <a class="nav-item" routerLink="/dashboard" routerLinkActive="nav-active"
             [matTooltip]="collapsed ? 'Dashboard' : ''" matTooltipPosition="right">
            <mat-icon>dashboard</mat-icon>
            @if (!collapsed) { <span>Dashboard</span> }
          </a>
          <a class="nav-item" routerLink="/campaigns" routerLinkActive="nav-active"
             [matTooltip]="collapsed ? 'Campaigns' : ''" matTooltipPosition="right">
            <mat-icon>email</mat-icon>
            @if (!collapsed) { <span>Campaigns</span> }
          </a>
          <a class="nav-item" routerLink="/contacts" routerLinkActive="nav-active"
             [matTooltip]="collapsed ? 'Contacts' : ''" matTooltipPosition="right">
            <mat-icon>people</mat-icon>
            @if (!collapsed) { <span>Contacts</span> }
          </a>
          <a class="nav-item" routerLink="/client-briefings" routerLinkActive="nav-active"
             [matTooltip]="collapsed ? 'Client Briefings' : ''" matTooltipPosition="right">
            <mat-icon>article</mat-icon>
            @if (!collapsed) { <span>Client Briefings</span> }
          </a>

          <div class="nav-divider"></div>

          <a class="nav-item" routerLink="/setup" routerLinkActive="nav-active"
             [matTooltip]="collapsed ? 'Setup Guide' : ''" matTooltipPosition="right">
            <mat-icon>menu_book</mat-icon>
            @if (!collapsed) { <span>Setup Guide</span> }
          </a>
          <a class="nav-item" routerLink="/settings" routerLinkActive="nav-active"
             [matTooltip]="collapsed ? 'Settings' : ''" matTooltipPosition="right">
            <mat-icon>settings</mat-icon>
            @if (!collapsed) { <span>Settings</span> }
          </a>
        </nav>

        <!-- Footer -->
        <div class="nav-footer">
          @if (!collapsed) {
            <div class="user-row">
              <div class="user-avatar">{{ userInitial }}</div>
              <div class="user-info">
                <span class="user-name">{{ username }}</span>
                @if (isAdmin) { <span class="role-chip">Admin</span> }
              </div>
            </div>
          } @else {
            <div class="user-avatar-only" [matTooltip]="username" matTooltipPosition="right">
              {{ userInitial }}
            </div>
          }
          <button class="logout-item nav-item" (click)="logout()"
                  [matTooltip]="collapsed ? 'Logout' : ''" matTooltipPosition="right">
            <mat-icon>logout</mat-icon>
            @if (!collapsed) { <span>Logout</span> }
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="content-area">
        <ng-content></ng-content>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    :host { display: block; height: 100vh; }

    .sidenav-container {
      height: 100%;
      background: #0d1117;
    }

    /* Sidenav */
    .sidenav {
      background: #161b27;
      border-right: 1px solid rgba(255,255,255,0.06);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.22s cubic-bezier(.4,0,.2,1);
    }

    /* Header */
    .nav-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 8px 0 12px;
      height: 56px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
    }

    .brand-collapsed {
      justify-content: center;
    }

    .brand-hex {
      width: 34px;
      height: 34px;
      background: linear-gradient(140deg, #0ea5e9 0%, #2563eb 100%);
      clip-path: polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
    }
    .brand-title {
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,0.95);
      letter-spacing: 0.3px;
    }
    .brand-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.45);
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .collapse-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      color: rgba(255,255,255,0.4);
      flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
      &:hover {
        color: rgba(255,255,255,0.8);
        background: rgba(255,255,255,0.07);
      }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    /* Nav list */
    .nav-list {
      flex: 1;
      padding: 8px 0;
      overflow-y: auto;
      overflow-x: hidden;
      &::-webkit-scrollbar { width: 0; }
    }

    .nav-divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 6px 12px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 14px;
      height: 42px;
      color: rgba(255,255,255,0.55);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      white-space: nowrap;
      border-left: 3px solid transparent;
      transition: color 0.15s, background 0.15s, border-color 0.15s;
      cursor: pointer;
      background: none;
      border-right: none;
      border-top: none;
      border-bottom: none;
      width: 100%;
      box-sizing: border-box;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        color: rgba(255,255,255,0.45);
        transition: color 0.15s;
      }

      &:hover {
        background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.85);
        mat-icon { color: rgba(255,255,255,0.75); }
      }

      &.nav-active {
        background: rgba(14,165,233,0.12);
        color: #38bdf8;
        border-left-color: #0ea5e9;
        mat-icon { color: #38bdf8; }
      }
    }

    /* Footer */
    .nav-footer {
      flex-shrink: 0;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 8px 0 4px;
    }

    .user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px 8px;
      overflow: hidden;
    }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(140deg, #0ea5e9, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
      text-transform: uppercase;
    }

    .user-avatar-only {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(140deg, #0ea5e9, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: white;
      text-transform: uppercase;
      margin: 4px auto 8px;
      cursor: default;
    }

    .user-info {
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .user-name {
      font-size: 12px;
      color: rgba(255,255,255,0.7);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .role-chip {
      font-size: 10px;
      font-weight: 600;
      color: #38bdf8;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }

    .logout-item {
      font-family: inherit;
      border-radius: 0;
      margin-top: 2px;
    }

    /* Content area */
    .content-area {
      background: #0d1117;
      overflow-y: auto;
    }
  `]
})
export class NavComponent {
  collapsed = false;
  username = this.auth.getUsername() ?? '';
  isAdmin = this.auth.isAdmin();

  get userInitial(): string {
    return this.username ? this.username[0].toUpperCase() : '?';
  }

  constructor(
    private auth: AuthService,
    private router: Router,
    public themeService: ThemeService
  ) {}

  logout(): void {
    this.auth.logout();
  }
}
