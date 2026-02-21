import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Contact, CsvImportResult } from '../models/contact.model';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private base = '/api/contacts';

  constructor(private http: HttpClient) {}

  getAll(search?: string): Observable<Contact[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get<Contact[]>(`${this.base}${params}`);
  }

  getById(id: number): Observable<Contact> {
    return this.http.get<Contact>(`${this.base}/${id}`);
  }

  create(contact: Contact): Observable<Contact> {
    return this.http.post<Contact>(this.base, contact);
  }

  update(id: number, contact: Contact): Observable<Contact> {
    return this.http.put<Contact>(`${this.base}/${id}`, contact);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  importCsv(file: File): Observable<CsvImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<CsvImportResult>(`${this.base}/import`, formData);
  }
}
