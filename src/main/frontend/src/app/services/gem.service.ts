import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Gem {
  id?: number;
  name: string;
  description?: string;
  systemInstructions: string;
  gemType: 'CONTACT_RESEARCH' | 'EMAIL_GENERATION';
}

@Injectable({ providedIn: 'root' })
export class GemService {
  private base = '/api/gems';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Gem[]> {
    return this.http.get<Gem[]>(this.base);
  }

  getByType(type: string): Observable<Gem[]> {
    return this.http.get<Gem[]>(this.base, { params: { type } });
  }

  create(gem: Gem): Observable<Gem> {
    return this.http.post<Gem>(this.base, gem);
  }

  update(id: number, gem: Gem): Observable<Gem> {
    return this.http.put<Gem>(`${this.base}/${id}`, gem);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
