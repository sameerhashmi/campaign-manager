import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GmailSessionStatus {
  connected: boolean;
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

  /** Long-running request (up to 90s) — opens a browser for the user to log in. */
  connectGmail(): Observable<GmailSessionStatus> {
    return this.http.post<GmailSessionStatus>(`${this.base}/gmail/connect`, null, {
      // Angular's HttpClient default timeout is no timeout; backend waits up to 90s
    });
  }

  disconnectGmail(): Observable<GmailSessionStatus> {
    return this.http.delete<GmailSessionStatus>(`${this.base}/gmail/disconnect`);
  }
}
