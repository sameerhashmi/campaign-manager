import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CampaignPlan {
  id?: number;
  name: string;
  customer?: string;
  tanzuContact?: string;
  driveFolderUrl?: string;
  contactGemId?: number;
  contactGemName?: string;
  emailGemId?: number;
  emailGemName?: string;
  status?: string;
  resultCampaignId?: number;
  createdAt?: string;
}

export interface ProspectContact {
  id?: number;
  campaignPlanId?: number;
  name: string;
  title?: string;
  email?: string;
  roleType?: string;
  teamDomain?: string;
  technicalStrengths?: string;
  senioritySignal?: string;
  influenceIndicators?: string;
  source?: string;
  tanzuRelevance?: string;
  tanzuTeam?: string;
  selected?: boolean;
  generatedEmailCount?: number;
}

export interface GeneratedEmail {
  id?: number;
  prospectContactId?: number;
  stepNumber: number;
  subject: string;
  body: string;
  scheduledAt?: string;
}

export interface CampaignPlanDocument {
  id: number;
  originalFileName: string;
  mimeType: string;
  createdAt: string;
}

export interface CampaignPlanSummary {
  campaignName: string;
  customer: string;
  tanzuContact: string;
  contactGemName: string;
  emailGemName: string;
  contactCount: number;
  emailCount: number;
  scheduleStart: string;
  scheduleEnd: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignPlanService {
  private base = '/api/campaign-plans';

  constructor(private http: HttpClient) {}

  getAll(): Observable<CampaignPlan[]> {
    return this.http.get<CampaignPlan[]>(this.base);
  }

  getById(id: number): Observable<CampaignPlan> {
    return this.http.get<CampaignPlan>(`${this.base}/${id}`);
  }

  create(plan: CampaignPlan): Observable<CampaignPlan> {
    return this.http.post<CampaignPlan>(this.base, plan);
  }

  update(id: number, plan: CampaignPlan): Observable<CampaignPlan> {
    return this.http.put<CampaignPlan>(`${this.base}/${id}`, plan);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  generateContacts(planId: number): Observable<ProspectContact[]> {
    return this.http.post<ProspectContact[]>(`${this.base}/${planId}/generate-contacts`, {});
  }

  getContacts(planId: number): Observable<ProspectContact[]> {
    return this.http.get<ProspectContact[]>(`${this.base}/${planId}/contacts`);
  }

  updateContact(planId: number, contactId: number, contact: ProspectContact): Observable<ProspectContact> {
    return this.http.put<ProspectContact>(`${this.base}/${planId}/contacts/${contactId}`, contact);
  }

  generateEmails(planId: number, selectedContactIds: number[]): Observable<{ [key: number]: GeneratedEmail[] }> {
    return this.http.post<{ [key: number]: GeneratedEmail[] }>(
      `${this.base}/${planId}/generate-emails`,
      { selectedContactIds }
    );
  }

  getEmailsForContact(planId: number, contactId: number): Observable<GeneratedEmail[]> {
    return this.http.get<GeneratedEmail[]>(`${this.base}/${planId}/contacts/${contactId}/emails`);
  }

  updateEmail(planId: number, emailId: number, email: GeneratedEmail): Observable<GeneratedEmail> {
    return this.http.put<GeneratedEmail>(`${this.base}/${planId}/emails/${emailId}`, email);
  }

  getSummary(planId: number): Observable<CampaignPlanSummary> {
    return this.http.get<CampaignPlanSummary>(`${this.base}/${planId}/summary`);
  }

  convert(planId: number): Observable<{ id: number; name: string; status: string }> {
    return this.http.post<{ id: number; name: string; status: string }>(
      `${this.base}/${planId}/convert`, {}
    );
  }

  getDocuments(planId: number): Observable<CampaignPlanDocument[]> {
    return this.http.get<CampaignPlanDocument[]>(`${this.base}/${planId}/documents`);
  }

  uploadDocuments(planId: number, files: File[]): Observable<CampaignPlanDocument[]> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f, f.name));
    return this.http.post<CampaignPlanDocument[]>(`${this.base}/${planId}/documents`, formData);
  }

  deleteDocument(planId: number, docId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${planId}/documents/${docId}`);
  }

  importDocumentsFromDrive(planId: number, folderUrl: string): Observable<CampaignPlanDocument[]> {
    return this.http.post<CampaignPlanDocument[]>(
      `${this.base}/${planId}/documents/from-drive`,
      { folderUrl }
    );
  }
}
