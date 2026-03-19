import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { NavComponent } from '../shared/nav/nav.component';
import { SettingsService, GmailSessionStatus, ConnectedSession } from '../../services/settings.service';
import { GemService, Gem } from '../../services/gem.service';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
    MatInputModule, MatFormFieldModule, MatTableModule, MatTooltipModule, MatSelectModule, MatChipsModule, MatSelectModule, MatChipsModule,
    NavComponent
  ],
  template: `
    <app-nav>
      <div class="page-container">
        <div class="page-header">
          <h1>Settings</h1>
        </div>

        <!-- Gmail Sessions Card -->
        <mat-card class="settings-card">
          <mat-card-header>
            <div mat-card-avatar class="gmail-avatar">
              <mat-icon>mail</mat-icon>
            </div>
            <mat-card-title>Gmail Sessions</mat-card-title>
            <mat-card-subtitle>
              Each Gmail account is stored as a separate session.
              Campaigns send from the account assigned to them.
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            @if (loading) {
              <div class="status-row">
                <mat-spinner diameter="24"></mat-spinner>
                <span class="status-text">Checking sessions...</span>
              </div>
            } @else if (status?.connecting) {
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
              <!-- Sessions table -->
              @if (sessions.length > 0) {
                <table mat-table [dataSource]="sessions" class="sessions-table">
                  <ng-container matColumnDef="email">
                    <th mat-header-cell *matHeaderCellDef>Gmail Account</th>
                    <td mat-cell *matCellDef="let s">
                      <div class="session-email">
                        <mat-icon class="email-icon">check_circle</mat-icon>
                        <div>
                          <div class="email-addr">{{ s.email }}</div>
                          @if (s.connectedAt) {
                            <div class="email-sub">Connected {{ s.connectedAt | date:'mediumDate' }}</div>
                          }
                        </div>
                      </div>
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="campaigns">
                    <th mat-header-cell *matHeaderCellDef>Campaigns</th>
                    <td mat-cell *matCellDef="let s">{{ s.campaignCount }}</td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let s" style="white-space:nowrap">
                      <button mat-stroked-button (click)="refreshSession(s.email)"
                              [disabled]="uploading"
                              matTooltip="Upload a new session file for this account — no need to disconnect first"
                              style="margin-right:6px">
                        <mat-icon>sync</mat-icon> Refresh
                      </button>
                      <button mat-stroked-button color="warn"
                              (click)="disconnectOne(s.email, s.campaignCount)"
                              matTooltip="Remove this Gmail session">
                        <mat-icon>link_off</mat-icon> Disconnect
                      </button>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="['email','campaigns','actions']"></tr>
                  <tr mat-row *matRowDef="let row; columns: ['email','campaigns','actions'];"></tr>
                </table>
              } @else {
                <div class="no-sessions">
                  <mat-icon>cancel</mat-icon>
                  <span>No Gmail sessions connected. Use one of the options below.</span>
                </div>
              }

              @if (status?.connectError) {
                <div class="error-message" style="margin-top:8px">
                  <mat-icon style="font-size:16px;width:16px;height:16px">error_outline</mat-icon>
                  {{ status!.connectError }}
                </div>
              }
            }
          </mat-card-content>

          @if (status?.cloudEnvironment) {
            <div class="cloud-notice">
              <mat-icon class="cloud-notice-icon">cloud</mat-icon>
              <span>Running in a cloud / headless environment — browser login is not available.
                Use <strong>Upload Session File</strong> below.</span>
            </div>
          }

          <mat-divider></mat-divider>

          <mat-card-actions>
            <input #fileInput type="file" accept=".json" style="display:none"
                   (change)="onFileSelected($event)">
            <input #refreshInput type="file" accept=".json" style="display:none"
                   (change)="onRefreshFileSelected($event)">
            <input #gemTestInput type="file" multiple accept=".html,.htm,.pdf,.docx,.txt"
                   style="display:none" (change)="onGemTestFilesSelected($event)">

            @if (!status?.connecting) {
              @if (!status?.cloudEnvironment) {
                <button mat-raised-button color="primary" (click)="connect()">
                  <mat-icon>add</mat-icon>
                  Add Gmail Account
                </button>
              }
              <button mat-stroked-button (click)="fileInput.click()"
                      [disabled]="uploading" style="margin-left:8px">
                <mat-icon>upload_file</mat-icon>
                {{ uploading ? 'Uploading…' : 'Upload Session File' }}
              </button>
            }
          </mat-card-actions>
        </mat-card>

        <!-- Gemini API Key Card (admin only) -->
        @if (isAdmin) {
        <mat-card class="settings-card">
          <mat-card-header>
            <div mat-card-avatar class="gemini-avatar">
              <mat-icon>auto_awesome</mat-icon>
            </div>
            <mat-card-title>Gemini AI</mat-card-title>
            <mat-card-subtitle>Connect your Gemini API key to enable AI-powered campaign planning.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (geminiStatus?.connected) {
              <div class="connected-row">
                <mat-icon class="connected-icon">check_circle</mat-icon>
                <div>
                  <div class="connected-title">API Key Connected</div>
                  <div class="connected-sub">{{ geminiStatus?.maskedKey }}</div>
                </div>
                <button mat-icon-button color="warn" matTooltip="Remove API key" (click)="deleteGeminiKey()">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>

              <!-- Model selection -->
              <div style="margin-top:16px">
                <div style="font-size:13px;color:#5f6368;margin-bottom:8px">
                  Active model:
                  <strong>{{ geminiStatus?.model || 'not configured — load and select below' }}</strong>
                </div>
                @if (availableModels.length > 0) {
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">
                    <mat-form-field appearance="outline" style="min-width:280px">
                      <mat-label>Select Model</mat-label>
                      <mat-select [(ngModel)]="selectedModel">
                        @for (m of availableModels; track m) {
                          <mat-option [value]="m">{{ m }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <button mat-raised-button color="primary"
                            [disabled]="!selectedModel || savingModel"
                            (click)="saveGeminiModel()">
                      @if (savingModel) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                      Save Model
                    </button>
                  </div>
                }
              </div>
            } @else {
              <mat-form-field appearance="outline" style="width:100%;max-width:420px">
                <mat-label>Gemini API Key</mat-label>
                <input matInput [(ngModel)]="geminiApiKey" type="password"
                       placeholder="AIza...">
                <mat-hint>Get your key from <strong>aistudio.google.com</strong></mat-hint>
              </mat-form-field>
            }
          </mat-card-content>
          <mat-card-actions>
            @if (!geminiStatus?.connected) {
              <button mat-raised-button color="primary" [disabled]="!geminiApiKey || savingKey"
                      (click)="saveGeminiKey()">
                @if (savingKey) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                Save Key
              </button>
            }
            @if (geminiStatus?.connected) {
              <button mat-stroked-button [disabled]="loadingModels"
                      (click)="loadGeminiModels()">
                @if (loadingModels) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                <mat-icon>search</mat-icon> Load Available Models
              </button>
            }
            <button mat-stroked-button [disabled]="testingGemini || !geminiStatus?.connected || !geminiStatus?.model"
                    (click)="testGemini()" style="margin-left:8px"
                    [matTooltip]="!geminiStatus?.model ? 'Load and save a model first' : ''">
              @if (testingGemini) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
              Test Connection
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- Gems Management Card (admin only) -->
        <mat-card class="settings-card">
          <mat-card-header>
            <div mat-card-avatar class="gems-avatar">
              <mat-icon>psychology</mat-icon>
            </div>
            <mat-card-title>Gems</mat-card-title>
            <mat-card-subtitle>
              Custom AI system instructions for contact research and email generation.
              Paste your Gem's instructions here — they will be sent to Gemini as the system prompt.
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (gems.length === 0) {
              <p style="color:#5f6368;font-size:14px">No Gems yet. Create one below to use in Campaign 2.0.</p>
            }
            @for (gem of gems; track gem.id) {
              <div class="gem-card">
                <div class="gem-info">
                  <span class="gem-name">{{ gem.name }}</span>
                  <span [class]="'gem-type-badge gem-type-' + gem.gemType.toLowerCase()">
                    {{ gem.gemType === 'CONTACT_RESEARCH' ? 'Contact Research' : 'Email Generation' }}
                  </span>
                  @if (gem.description) {
                    <span class="gem-desc">{{ gem.description }}</span>
                  }
                </div>
                <div class="gem-actions">
                  <button mat-icon-button matTooltip="Test Gem" (click)="toggleGemTest(gem)">
                    <mat-icon>science</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Edit Gem" (click)="editGem(gem)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" matTooltip="Delete Gem" (click)="deleteGem(gem)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Inline test panel -->
              @if (gemTestPanelId === gem.id) {
                <div class="gem-test-panel">
                  <div class="gem-test-header">
                    <mat-icon>science</mat-icon>
                    <strong>Test: {{ gem.name }}</strong>
                    @if (gem.gemType === 'EMAIL_GENERATION') {
                      <span class="gem-test-note">(runs against a sample contact — VP of Platform Engineering)</span>
                    }
                  </div>

                  <div class="gem-test-inputs">
                    <div class="gem-test-upload-zone" (click)="openGemTestFilePicker(gem.id!)">
                      <mat-icon style="font-size:20px;width:20px;height:20px;color:#5f6368">upload_file</mat-icon>
                      <span>Add briefing documents</span>
                      <span style="font-size:11px;color:#9aa0a6">(HTML, PDF, DOCX, TXT)</span>
                    </div>
                    <button mat-raised-button color="primary"
                            [disabled]="testingGemId === gem.id"
                            (click)="runGemTest(gem)">
                      @if (testingGemId === gem.id) {
                        <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner>
                      }
                      Run Test
                    </button>
                  </div>
                  @if ((gemTestFiles[gem.id!] || []).length > 0) {
                    <div class="gem-test-file-list">
                      @for (f of gemTestFiles[gem.id!]; track f.name) {
                        <div class="gem-test-file-item">
                          <mat-icon style="font-size:14px;width:14px;height:14px;color:#34a853">insert_drive_file</mat-icon>
                          <span>{{ f.name }}</span>
                          <button mat-icon-button style="width:20px;height:20px;line-height:20px"
                                  (click)="removeGemTestFile(gem.id!, f)">
                            <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                          </button>
                        </div>
                      }
                    </div>
                  }

                  @if (gemTestError[gem.id!]) {
                    <div class="gem-test-error">
                      <mat-icon>error</mat-icon>
                      {{ gemTestError[gem.id!] }}
                    </div>
                  }

                  @if (gemTestResult[gem.id!]) {
                    <div class="gem-test-results">
                      @if (gemTestResult[gem.id!].type === 'CONTACT_RESEARCH') {
                        <div class="gem-test-result-header">
                          {{ gemTestResult[gem.id!].contacts?.length ?? 0 }} contact(s) extracted
                        </div>
                        <div class="gem-contacts-scroll">
                          <table class="gem-result-table">
                            <thead>
                              <tr>
                                <th>Name</th><th>Title</th><th>Email</th>
                                <th>Role</th><th>Team</th><th>Relevance</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (c of gemTestResult[gem.id!].contacts; track c.name) {
                                <tr>
                                  <td>{{ c.name }}</td>
                                  <td>{{ c.title }}</td>
                                  <td>{{ c.email || '—' }}</td>
                                  <td>{{ c.roleType }}</td>
                                  <td>{{ c.teamDomain }}</td>
                                  <td [class]="'rel-' + (c.tanzuRelevance || '').toLowerCase()">{{ c.tanzuRelevance }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      } @else {
                        <div class="gem-test-result-header">
                          {{ gemTestResult[gem.id!].emails?.length ?? 0 }} email(s) generated for test contact
                        </div>
                        @for (email of gemTestResult[gem.id!].emails; track email.stepNumber) {
                          <div class="gem-email-preview">
                            <div class="gem-email-step">Email {{ email.stepNumber }}</div>
                            <div class="gem-email-subject">{{ email.subject }}</div>
                            <pre class="gem-email-body">{{ email.body }}</pre>
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
              }
            }

            <!-- Add / Edit Gem Form -->
            @if (showGemForm) {
              <div class="gem-form">
                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Gem Name *</mat-label>
                  <input matInput [(ngModel)]="gemForm.name" placeholder="e.g. Citadel Contact Research">
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Type *</mat-label>
                  <mat-select [(ngModel)]="gemForm.gemType">
                    <mat-option value="CONTACT_RESEARCH">Contact Research</mat-option>
                    <mat-option value="EMAIL_GENERATION">Email Generation</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Description (optional)</mat-label>
                  <input matInput [(ngModel)]="gemForm.description">
                </mat-form-field>
                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>System Instructions *</mat-label>
                  <textarea matInput [(ngModel)]="gemForm.systemInstructions"
                            rows="10" placeholder="Paste your Gem's system prompt here..."></textarea>
                  <mat-hint>These instructions are sent to Gemini as the system prompt when generating contacts or emails.</mat-hint>
                </mat-form-field>
                <div style="display:flex;gap:8px;margin-top:8px">
                  <button mat-raised-button color="primary"
                          [disabled]="!gemForm.name || !gemForm.systemInstructions || savingGem"
                          (click)="saveGem()">
                    @if (savingGem) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                    {{ editingGemId ? 'Update Gem' : 'Save Gem' }}
                  </button>
                  <button mat-stroked-button (click)="cancelGemForm()">Cancel</button>
                </div>
              </div>
            }
          </mat-card-content>
          @if (!showGemForm) {
            <mat-card-actions>
              <button mat-stroked-button (click)="addGem()">
                <mat-icon>add</mat-icon> Add Gem
              </button>
            </mat-card-actions>
          }
        </mat-card>
        } <!-- end @if (isAdmin) for AI cards -->

      </div>
    </app-nav>
  `,
  styles: [`
    .settings-card { max-width: 760px; margin-bottom: 24px; }
    .info-card     { max-width: 760px; }
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
    .status-text { color: #5f6368; }
    .no-sessions {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 0; color: #9aa0a6; font-size: 14px;
      mat-icon { color: #ea4335; }
    }
    .sessions-table { width: 100%; margin-bottom: 8px; }
    .session-email { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .email-icon { color: #34a853; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .email-addr { font-weight: 600; font-size: 14px; color: #202124; }
    .email-sub  { font-size: 12px; color: #5f6368; }
    .error-message {
      display: flex; align-items: center; gap: 4px;
      font-size: 13px; color: #c5221f;
    }
    mat-card-actions { padding: 8px 16px 12px; display: flex; align-items: center; }
    .steps-list { margin: 0; padding-left: 20px; line-height: 2; color: #3c4043; }
    .section-heading { font-weight: 600; font-size: 13px; color: #3c4043; margin: 0 0 4px; }
    code { background: #f1f3f4; border-radius: 3px; padding: 1px 5px; font-size: 12px; }
    .paste-avatar {
      background: #1a73e8; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; width: 40px; height: 40px;
    }
    .paste-avatar mat-icon { color: white; }
    .cookie-avatar {
      background: #f9ab00; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; width: 40px; height: 40px;
    }
    .cookie-avatar mat-icon { color: white; }
    .ext-link { color: #1a73e8; font-weight: 600; }
    .cloud-notice {
      display: flex; align-items: center; gap: 10px;
      background: #e8f0fe; border-radius: 6px;
      padding: 10px 16px; margin: 0 16px 8px; font-size: 13px; color: #3c4043;
    }
    .cloud-notice-icon { color: #1a73e8; font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .gemini-avatar {
      background: linear-gradient(135deg, #4285f4, #a142f4); display: flex; align-items: center; justify-content: center;
      border-radius: 50%; width: 40px; height: 40px;
    }
    .gemini-avatar mat-icon { color: white; }
    .gems-avatar {
      background: #34a853; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; width: 40px; height: 40px;
    }
    .gems-avatar mat-icon { color: white; }
    .connected-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .connected-icon { color: #34a853; }
    .connected-title { font-weight: 600; font-size: 14px; }
    .connected-sub { font-size: 12px; color: #5f6368; }
    .gem-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0; border-bottom: 1px solid #f1f3f4;
    }
    .gem-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .gem-name { font-weight: 600; font-size: 14px; }
    .gem-desc { font-size: 12px; color: #5f6368; }
    .gem-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .gem-type-badge {
      font-size: 11px; border-radius: 10px; padding: 2px 8px; font-weight: 600;
    }
    .gem-type-contact_research { background: #e8f0fe; color: #1a73e8; }
    .gem-type-email_generation  { background: #e6f4ea; color: #137333; }
    .gem-form {
      margin-top: 16px; display: flex; flex-direction: column; gap: 8px;
      background: #f8f9fa; border-radius: 8px; padding: 16px;
    }
    .gem-test-panel {
      background: #f0f4ff; border: 1px solid #c5d7f8; border-radius: 8px;
      padding: 16px; margin: 4px 0 12px; display: flex; flex-direction: column; gap: 12px;
    }
    .gem-test-header {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: #1a73e8;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .gem-test-note { font-size: 11px; color: #5f6368; font-weight: normal; }
    .gem-test-inputs { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .gem-test-upload-zone {
      display: flex; align-items: center; gap: 8px; padding: 8px 14px;
      border: 1.5px dashed #c5d7f8; border-radius: 6px; cursor: pointer;
      font-size: 13px; color: #3c4043; background: white;
      &:hover { border-color: #1a73e8; background: #f0f4ff; }
    }
    .gem-test-file-list {
      display: flex; flex-direction: column; gap: 4px;
    }
    .gem-test-file-item {
      display: flex; align-items: center; gap: 6px; font-size: 12px; color: #3c4043;
      span { flex: 1; }
    }
    .gem-test-error {
      display: flex; align-items: center; gap: 8px;
      background: #fce8e6; border-radius: 6px; padding: 10px 12px;
      font-size: 13px; color: #c5221f;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }
    .gem-test-results {
      background: white; border-radius: 6px; border: 1px solid #e0e0e0; overflow: hidden;
    }
    .gem-test-result-header {
      padding: 8px 12px; font-size: 12px; font-weight: 600; color: #3c4043;
      background: #f8f9fa; border-bottom: 1px solid #e0e0e0;
    }
    .gem-contacts-scroll { overflow-x: auto; max-height: 320px; overflow-y: auto; }
    .gem-result-table {
      width: 100%; border-collapse: collapse; font-size: 12px;
      th { padding: 8px 10px; text-align: left; background: #f1f3f4; border-bottom: 1px solid #e0e0e0; font-weight: 600; color: #5f6368; white-space: nowrap; }
      td { padding: 8px 10px; border-bottom: 1px solid #f1f3f4; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
    }
    .rel-high   { color: #137333; font-weight: 600; }
    .rel-medium { color: #e37400; }
    .rel-low    { color: #9aa0a6; }
    .gem-email-preview {
      padding: 12px 16px; border-bottom: 1px solid #f1f3f4;
      &:last-child { border-bottom: none; }
    }
    .gem-email-step    { font-size: 11px; font-weight: 600; color: #1a73e8; margin-bottom: 4px; }
    .gem-email-subject { font-size: 13px; font-weight: 600; color: #202124; margin-bottom: 6px; }
    .gem-email-body {
      font-size: 12px; color: #5f6368; white-space: pre-wrap; font-family: inherit;
      margin: 0; max-height: 200px; overflow-y: auto; background: #f8f9fa;
      border-radius: 4px; padding: 8px;
    }
  `]
})
export class SettingsComponent implements OnInit, OnDestroy {
  @ViewChild('refreshInput') refreshInputEl!: ElementRef<HTMLInputElement>;
  @ViewChild('gemTestInput') gemTestInputEl!: ElementRef<HTMLInputElement>;

  status: GmailSessionStatus | null = null;
  sessions: ConnectedSession[] = [];
  loading = true;
  uploading = false;
  pastedJson = '';
  cookieJson = '';
  refreshTargetEmail = '';
  private pollSub?: Subscription;

  // Gemini
  geminiStatus: { connected: boolean; maskedKey?: string; model?: string } | null = null;
  geminiApiKey = '';
  savingKey = false;
  testingGemini = false;
  availableModels: string[] = [];
  loadingModels = false;
  selectedModel = '';
  savingModel = false;

  // Gems
  gems: Gem[] = [];
  showGemForm = false;
  editingGemId: number | null = null;
  savingGem = false;
  gemForm: Gem = { name: '', systemInstructions: '', gemType: 'CONTACT_RESEARCH' };

  // Gem test
  testingGemId: number | null = null;
  gemTestPanelId: number | null = null;  // which gem has the panel open
  gemTestFiles: { [id: number]: File[] } = {};
  gemTestResult: { [id: number]: any } = {};
  gemTestError: { [id: number]: string } = {};
  private gemTestActiveId: number | null = null;

  isAdmin = false;

  constructor(
    private settingsService: SettingsService,
    private gemService: GemService,
    private authService: AuthService,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.isAdmin();
    this.loadStatus();
    if (this.isAdmin) {
      this.loadGeminiStatus();
      this.loadGems();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadStatus(): void {
    this.loading = true;
    this.settingsService.getStatus().subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  connect(): void {
    this.settingsService.connectGmail().subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        if (s.connecting) {
          this.snackBar.open(
            'Chrome window opened — log into Gmail, then wait for this page to update.',
            '', { duration: 15000, panelClass: 'snack-info' }
          );
          this.startPolling();
        }
      },
      error: (err) => {
        const msg: string = err?.error?.message ?? 'Could not start browser.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.snackBar.open('Uploading and verifying session — this may take 10–20 seconds…', '', { duration: 30000 });
    this.settingsService.uploadSession(file).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.uploading = false;
        this.snackBar.dismiss();
        this.snackBar.open(s.message || 'Session uploaded!', '', {
          duration: 5000, panelClass: 'snack-success'
        });
      },
      error: (err) => {
        this.uploading = false;
        this.snackBar.dismiss();
        const msg = err?.error?.message ?? 'Upload failed.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
    (event.target as HTMLInputElement).value = '';
  }

  savePastedJson(): void {
    const trimmed = this.pastedJson.trim();
    try {
      JSON.parse(trimmed);
    } catch {
      this.snackBar.open('Invalid JSON — please paste the full contents of gmail-session.json.', 'Close', {
        duration: 6000, panelClass: 'snack-error'
      });
      return;
    }
    const blob = new Blob([trimmed], { type: 'application/json' });
    const file = new File([blob], 'gmail-session.json', { type: 'application/json' });
    this.uploading = true;
    this.snackBar.open('Saving and verifying session — this may take 10–20 seconds…', '', { duration: 30000 });
    this.settingsService.uploadSession(file).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.uploading = false;
        this.pastedJson = '';
        this.snackBar.dismiss();
        this.snackBar.open(s.message || 'Session saved!', '', {
          duration: 5000, panelClass: 'snack-success'
        });
      },
      error: (err) => {
        this.uploading = false;
        this.snackBar.dismiss();
        const msg = err?.error?.message ?? 'Save failed.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
  }

  saveCookieJson(): void {
    const trimmed = this.cookieJson.trim();
    try {
      JSON.parse(trimmed);
    } catch {
      this.snackBar.open('Invalid JSON — paste the Cookie Editor export (an array starting with [).', 'Close', {
        duration: 6000, panelClass: 'snack-error'
      });
      return;
    }
    this.uploading = true;
    this.snackBar.open('Importing cookies and verifying session — this may take 10–20 seconds…', '', { duration: 30000 });
    this.settingsService.importCookies(trimmed).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.uploading = false;
        this.cookieJson = '';
        this.snackBar.dismiss();
        this.snackBar.open(s.message || 'Gmail cookies imported!', '', {
          duration: 5000, panelClass: 'snack-success'
        });
      },
      error: err => {
        this.uploading = false;
        this.snackBar.dismiss();
        const msg = err?.error?.message ?? 'Import failed.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
      }
    });
  }

  refreshSession(email: string): void {
    this.refreshTargetEmail = email;
    this.refreshInputEl.nativeElement.value = '';
    this.refreshInputEl.nativeElement.click();
  }

  onRefreshFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading = true;
    this.snackBar.open(
      `Refreshing session for ${this.refreshTargetEmail} — this may take 10–20 seconds…`,
      '', { duration: 30000 }
    );
    this.settingsService.uploadSession(file).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.uploading = false;
        this.snackBar.dismiss();
        this.snackBar.open(s.message || `Session refreshed for ${this.refreshTargetEmail}!`, '', {
          duration: 5000, panelClass: 'snack-success'
        });
        this.refreshTargetEmail = '';
      },
      error: (err) => {
        this.uploading = false;
        this.snackBar.dismiss();
        const msg = err?.error?.message ?? 'Refresh failed.';
        this.snackBar.open(msg, 'Close', { duration: 8000, panelClass: 'snack-error' });
        this.refreshTargetEmail = '';
      }
    });
    (event.target as HTMLInputElement).value = '';
  }

  disconnectOne(email: string, campaignCount: number): void {
    const warning = campaignCount > 0
      ? `\n\nWarning: ${campaignCount} campaign(s) use this account. Their scheduled emails will fail until you reconnect.\n\nTip: Use "Refresh" to replace the session without any downtime.`
      : '';
    if (!confirm(`Disconnect Gmail session for ${email}?${warning}`)) return;
    this.settingsService.disconnectSession(email).subscribe({
      next: s => {
        this.status = s;
        this.sessions = s.sessions ?? [];
        this.snackBar.open(`${email} disconnected.`, '', { duration: 3000 });
      },
      error: () => this.snackBar.open('Disconnect failed', 'Close', { duration: 4000 })
    });
  }

  // ─── Gemini Key ──────────────────────────────────────────────────────────

  loadGeminiStatus(): void {
    this.http.get<any>('/api/settings/gemini').subscribe({
      next: s => {
        this.geminiStatus = s;
        if (s.model) this.selectedModel = s.model;
      },
      error: () => {}
    });
  }

  saveGeminiKey(): void {
    if (!this.geminiApiKey) return;
    this.savingKey = true;
    this.http.post<any>('/api/settings/gemini/api-key', { apiKey: this.geminiApiKey }).subscribe({
      next: s => {
        this.geminiStatus = s;
        this.geminiApiKey = '';
        this.savingKey = false;
        this.snackBar.open('Gemini API key saved!', '', { duration: 3000, panelClass: 'snack-success' });
      },
      error: () => {
        this.savingKey = false;
        this.snackBar.open('Failed to save key', 'Close', { duration: 4000 });
      }
    });
  }

  deleteGeminiKey(): void {
    if (!confirm('Remove Gemini API key? Campaign 2.0 features will stop working.')) return;
    this.http.delete('/api/settings/gemini/api-key').subscribe({
      next: () => {
        this.geminiStatus = { connected: false };
        this.snackBar.open('API key removed', '', { duration: 3000 });
      }
    });
  }

  testGemini(): void {
    this.testingGemini = true;
    this.http.post<any>('/api/settings/gemini/test', {}).subscribe({
      next: r => {
        this.testingGemini = false;
        if (r.ok) {
          this.snackBar.open('Gemini connection successful!', '', { duration: 4000, panelClass: 'snack-success' });
        } else {
          this.snackBar.open('Test failed: ' + (r.error ?? 'Unknown error'), 'Close', { duration: 6000 });
        }
      },
      error: () => {
        this.testingGemini = false;
        this.snackBar.open('Test failed', 'Close', { duration: 4000 });
      }
    });
  }

  loadGeminiModels(): void {
    this.loadingModels = true;
    this.http.get<string[]>('/api/settings/gemini/models').subscribe({
      next: models => {
        this.availableModels = models;
        this.loadingModels = false;
        if (!this.selectedModel && models.length > 0) {
          this.selectedModel = this.geminiStatus?.model ?? models[0];
        }
        if (models.length === 0) {
          this.snackBar.open('No models returned. Check your API key.', 'Close', { duration: 5000 });
        }
      },
      error: () => {
        this.loadingModels = false;
        this.snackBar.open('Failed to load models', 'Close', { duration: 4000 });
      }
    });
  }

  saveGeminiModel(): void {
    this.savingModel = true;
    this.http.post<any>('/api/settings/gemini/model', { model: this.selectedModel }).subscribe({
      next: s => {
        this.geminiStatus = s;
        this.savingModel = false;
        this.snackBar.open('Model saved: ' + this.selectedModel, '', { duration: 3000, panelClass: 'snack-success' });
      },
      error: () => {
        this.savingModel = false;
        this.snackBar.open('Failed to save model', 'Close', { duration: 4000 });
      }
    });
  }

  // ─── Gems ─────────────────────────────────────────────────────────────────

  loadGems(): void {
    this.gemService.getAll().subscribe(g => this.gems = g);
  }

  addGem(): void {
    this.editingGemId = null;
    this.gemForm = { name: '', systemInstructions: '', gemType: 'CONTACT_RESEARCH' };
    this.showGemForm = true;
  }

  editGem(gem: Gem): void {
    this.editingGemId = gem.id ?? null;
    this.gemForm = { ...gem };
    this.showGemForm = true;
  }

  saveGem(): void {
    this.savingGem = true;
    const save$ = this.editingGemId
        ? this.gemService.update(this.editingGemId, this.gemForm)
        : this.gemService.create(this.gemForm);
    save$.subscribe({
      next: () => {
        this.loadGems();
        this.cancelGemForm();
        this.savingGem = false;
        this.snackBar.open('Gem saved!', '', { duration: 3000, panelClass: 'snack-success' });
      },
      error: () => {
        this.savingGem = false;
        this.snackBar.open('Failed to save Gem', 'Close', { duration: 4000 });
      }
    });
  }

  cancelGemForm(): void {
    this.showGemForm = false;
    this.editingGemId = null;
    this.gemForm = { name: '', systemInstructions: '', gemType: 'CONTACT_RESEARCH' };
  }

  toggleGemTest(gem: Gem): void {
    if (this.gemTestPanelId === gem.id) {
      this.gemTestPanelId = null;
    } else {
      this.gemTestPanelId = gem.id ?? null;
      delete this.gemTestResult[gem.id!];
      delete this.gemTestError[gem.id!];
    }
  }

  openGemTestFilePicker(gemId: number): void {
    this.gemTestActiveId = gemId;
    this.gemTestInputEl.nativeElement.value = '';
    this.gemTestInputEl.nativeElement.click();
  }

  onGemTestFilesSelected(event: Event): void {
    const id = this.gemTestActiveId;
    if (id == null) return;
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    if (!this.gemTestFiles[id]) this.gemTestFiles[id] = [];
    for (let i = 0; i < files.length; i++) {
      this.gemTestFiles[id].push(files[i]);
    }
  }

  removeGemTestFile(gemId: number, file: File): void {
    if (!this.gemTestFiles[gemId]) return;
    this.gemTestFiles[gemId] = this.gemTestFiles[gemId].filter(f => f !== file);
  }

  runGemTest(gem: Gem): void {
    if (!gem.id) return;
    this.testingGemId = gem.id;
    delete this.gemTestResult[gem.id];
    delete this.gemTestError[gem.id];

    const formData = new FormData();
    (this.gemTestFiles[gem.id] ?? []).forEach(f => formData.append('files', f));

    this.http.post<any>(`/api/gems/${gem.id}/test`, formData).subscribe({
      next: result => {
        this.gemTestResult[gem.id!] = result;
        this.testingGemId = null;
      },
      error: err => {
        this.gemTestError[gem.id!] = err?.error?.message ?? 'Test failed. Check your API key, model, and Gem instructions.';
        this.testingGemId = null;
      }
    });
  }

  deleteGem(gem: Gem): void {
    if (!confirm('Delete Gem "' + gem.name + '"? This cannot be undone.')) return;
    this.gemService.delete(gem.id!).subscribe({
      next: () => { this.loadGems(); this.snackBar.open('Gem deleted', '', { duration: 3000 }); },
      error: () => this.snackBar.open('Delete failed', 'Close', { duration: 4000 })
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollSub = interval(3000).pipe(
      switchMap(() => this.settingsService.getStatus()),
      takeWhile(s => s.connecting, true)
    ).subscribe(s => {
      this.status = s;
      this.sessions = s.sessions ?? [];
      if (!s.connecting) {
        this.stopPolling();
        this.snackBar.dismiss();
        if (s.connected) {
          this.snackBar.open('Gmail account connected!', '', {
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
