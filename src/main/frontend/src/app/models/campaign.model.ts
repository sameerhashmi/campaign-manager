export interface Campaign {
  id?: number;
  name: string;
  description?: string;
  gmailEmail: string;
  gmailPassword?: string;
  intervalDays: string;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  createdAt?: string;
  launchedAt?: string;
  templates?: EmailTemplate[];
  contactCount?: number;
}

export interface EmailTemplate {
  id?: number;
  campaignId?: number;
  stepNumber: number;
  subject: string;
  bodyTemplate: string;
}
