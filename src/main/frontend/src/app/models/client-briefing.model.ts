export interface ClientBriefing {
  id?: number;
  clientName: string;
  documentLink?: string;
  uploadedFileName?: string;
  originalFileName?: string;
  /** Set by the backend when a file is uploaded. Points to /api/client-briefings/{id}/document */
  documentUrl?: string;
  createdAt?: string;
}
