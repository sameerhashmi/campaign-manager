import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GmailSessionStatus {
  connected: boolean;
  connecting: boolean;
  connectError: string | null;
  sessionCreatedAt: string | null;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private base = '/api/settings';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<GmailSessionStatus> {
    return this.http.get<GmailSessionStatus>(`${this.base}/gmail/status`);
  }

  /** Triggers async browser open — returns immediately (202). Frontend polls status. */
  connectGmail(): Observable<GmailSessionStatus> {
    return this.http.post<GmailSessionStatus>(`${this.base}/gmail/connect`, null);
  }

  disconnectGmail(): Observable<GmailSessionStatus> {
    return this.http.delete<GmailSessionStatus>(`${this.base}/gmail/disconnect`);
  }
}
