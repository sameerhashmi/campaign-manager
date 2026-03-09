import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientBriefing } from '../models/client-briefing.model';

@Injectable({ providedIn: 'root' })
export class ClientBriefingService {
  private base = '/api/client-briefings';

  constructor(private http: HttpClient) {}

  getAll(): Observable<ClientBriefing[]> {
    return this.http.get<ClientBriefing[]>(this.base);
  }

  create(clientName: string, documentLink: string | null, file: File | null): Observable<ClientBriefing> {
    const formData = new FormData();
    formData.append('clientName', clientName);
    if (documentLink && documentLink.trim()) {
      formData.append('documentLink', documentLink.trim());
    }
    if (file) {
      formData.append('file', file);
    }
    return this.http.post<ClientBriefing>(this.base, formData);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
