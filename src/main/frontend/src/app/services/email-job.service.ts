import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EmailJob } from '../models/email-job.model';

@Injectable({ providedIn: 'root' })
export class EmailJobService {
  private base = '/api/email-jobs';

  constructor(private http: HttpClient) {}

  getAll(): Observable<EmailJob[]> {
    return this.http.get<EmailJob[]>(this.base);
  }

  retry(id: number): Observable<EmailJob> {
    return this.http.post<EmailJob>(`${this.base}/${id}/retry`, {});
  }
}
