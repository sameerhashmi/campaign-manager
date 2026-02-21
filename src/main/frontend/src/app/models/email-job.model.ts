export interface EmailJob {
  id: number;
  campaignContactId: number;
  campaignId: number;
  campaignName: string;
  contactId: number;
  contactName: string;
  contactEmail: string;
  stepNumber: number;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string;
  status: 'SCHEDULED' | 'SENT' | 'FAILED' | 'SKIPPED';
  errorMessage?: string;
}

export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  draftCampaigns: number;
  totalContacts: number;
  emailsSentToday: number;
  emailsScheduled: number;
  emailsFailed: number;
  totalEmailsSent: number;
}
