import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Campaign, EmailTemplate } from '../models/campaign.model';
import { Contact } from '../models/contact.model';
import { EmailJob } from '../models/email-job.model';

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private base = '/api/campaigns';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(this.base);
  }

  getById(id: number): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.base}/${id}`);
  }

  create(campaign: Campaign): Observable<Campaign> {
    return this.http.post<Campaign>(this.base, campaign);
  }

  update(id: number, campaign: Campaign): Observable<Campaign> {
    return this.http.put<Campaign>(`${this.base}/${id}`, campaign);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  launch(id: number): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.base}/${id}/launch`, {});
  }

  pause(id: number): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.base}/${id}/pause`, {});
  }

  resume(id: number): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.base}/${id}/resume`, {});
  }

  // Templates
  getTemplates(campaignId: number): Observable<EmailTemplate[]> {
    return this.http.get<EmailTemplate[]>(`${this.base}/${campaignId}/templates`);
  }

  addTemplate(campaignId: number, template: EmailTemplate): Observable<EmailTemplate> {
    return this.http.post<EmailTemplate>(`${this.base}/${campaignId}/templates`, template);
  }

  updateTemplate(campaignId: number, templateId: number, template: EmailTemplate): Observable<EmailTemplate> {
    return this.http.put<EmailTemplate>(`${this.base}/${campaignId}/templates/${templateId}`, template);
  }

  deleteTemplate(campaignId: number, templateId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${campaignId}/templates/${templateId}`);
  }

  // Contacts
  getContacts(campaignId: number): Observable<Contact[]> {
    return this.http.get<Contact[]>(`${this.base}/${campaignId}/contacts`);
  }

  assignContacts(campaignId: number, contactIds: number[]): Observable<{ added: number }> {
    return this.http.post<{ added: number }>(`${this.base}/${campaignId}/contacts`, { contactIds });
  }

  removeContact(campaignId: number, contactId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${campaignId}/contacts/${contactId}`);
  }

  // Jobs
  getJobs(campaignId: number, status?: string): Observable<EmailJob[]> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<EmailJob[]>(`${this.base}/${campaignId}/jobs${params}`);
  }

  // Excel import — replace=true clears existing contacts before importing
  importExcel(campaignId: number, file: File, replace = false): Observable<ExcelImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ExcelImportResult>(
      `${this.base}/${campaignId}/import-excel?replace=${replace}`, formData);
  }
}

export interface ExcelImportResult {
  contactsImported: number;
  templatesImported: number;
  errors: string[];
  message: string;
}
