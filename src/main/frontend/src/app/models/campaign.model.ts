export interface Campaign {
  id?: number;
  name: string;
  description?: string;
  gmailEmail: string;
  tanzuContact?: string;
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
  /** ISO datetime string: when this email step should be sent */
  scheduledAt?: string;
}
