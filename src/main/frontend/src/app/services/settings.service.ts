import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ConnectedSession {
  email: string;
  connectedAt: string | null;
  campaignCount: number;
}

export interface GmailSessionStatus {
  connected: boolean;
  connecting: boolean;
  connectError: string | null;
  sessionCreatedAt: string | null;
  message: string;
  connectedEmail?: string;
  cloudEnvironment?: boolean;
  sessions?: ConnectedSession[];
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private base = '/api/settings';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<GmailSessionStatus> {
    return this.http.get<GmailSessionStatus>(`${this.base}/gmail/status`);
  }

  getSessions(): Observable<ConnectedSession[]> {
    return this.http.get<ConnectedSession[]>(`${this.base}/gmail/sessions`);
  }

  /** Returns only the sessions owned by the currently logged-in user. */
  getMySessions(): Observable<ConnectedSession[]> {
    return this.http.get<ConnectedSession[]>(`${this.base}/gmail/my-sessions`);
  }

  /** Triggers async browser open — returns immediately (202). Frontend polls status. */
  connectGmail(): Observable<GmailSessionStatus> {
    return this.http.post<GmailSessionStatus>(`${this.base}/gmail/connect`, null);
  }

  /** Uploads a gmail-session.json file; backend detects email and saves per-account. */
  uploadSession(file: File): Observable<GmailSessionStatus> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<GmailSessionStatus>(`${this.base}/gmail/upload-session`, fd);
  }

  /** Converts Cookie Editor JSON array to Playwright session format and saves it. */
  importCookies(json: string): Observable<GmailSessionStatus> {
    return this.http.post<GmailSessionStatus>(`${this.base}/gmail/import-cookies`, { cookieJson: json });
  }

  /** Disconnects a specific Gmail account by email. */
  disconnectSession(email: string): Observable<GmailSessionStatus> {
    return this.http.delete<GmailSessionStatus>(
      `${this.base}/gmail/sessions/${encodeURIComponent(email)}`);
  }

  /** Disconnects all sessions (legacy endpoint). */
  disconnectGmail(): Observable<GmailSessionStatus> {
    return this.http.delete<GmailSessionStatus>(`${this.base}/gmail/disconnect`);
  }
}
