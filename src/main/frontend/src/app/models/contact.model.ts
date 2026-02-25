export interface Contact {
  id?: number;
  name: string;
  email: string;
  role?: string;
  company?: string;
  category?: string;
  phone?: string;
  play?: string;
  subPlay?: string;
  aeRole?: string;
  emailLink?: string;
  createdAt?: string;
  enrolledInCampaign?: boolean;
}

export interface CsvImportResult {
  imported: number;
  updated: number;
  failed: number;
  errors: string[];
}
