import type { AxiosProgressEvent } from 'axios'
import { api } from './client'
import type { CollectionStatus, RequirementStatus } from './collections'

export type DocumentStatus = 'QUARANTINED' | 'AVAILABLE' | 'FAILED' | 'EXCLUDED'

export interface PortalDocument {
  id: string
  linkId: string
  name: string
  contentType: string
  sizeBytes: number
  status: DocumentStatus
  failureCode: string | null
  duplicate: boolean
  createdAt: string
}

export interface PortalRequirement {
  id: string
  type: string
  title: string
  required: boolean
  criteria: Record<string, unknown>
  status: RequirementStatus
  clientMessage: string | null
  documents: PortalDocument[]
}

export interface PortalSubmission {
  id: string
  roundNo: number
  status: 'DRAFT' | 'SUBMITTED'
  submittedAt: string | null
  createdAt: string
}

export interface PortalCollectionSummary {
  id: string
  clientId: string
  clientName: string
  period: string
  dueAt: string
  status: CollectionStatus
  assigneeName: string
  requiredCount: number
  readyCount: number
}

export interface PortalCollectionDetail extends PortalCollectionSummary {
  scopeNote: string | null
  requirements: PortalRequirement[]
  submission: PortalSubmission | null
}

export interface PortalUploadResult {
  submissionId: string
  document: PortalDocument
}

export interface ClassificationResult {
  provider: 'FAKE'
  items: Array<{ index: number; category: 'REQUIREMENT' | 'OTHER' | 'INVALID'; requirementId: string | null; confidence: number }>
}

export const portalApi = {
  list: () => api.get<{ items: PortalCollectionSummary[]; total: number }>('/portal/collection-requests').then(({ data }) => data),
  get: (id: string) => api.get<PortalCollectionDetail>(`/portal/collection-requests/${id}`).then(({ data }) => data),
  classify: (id: string, files: File[]) => api.post<ClassificationResult>(`/portal/collection-requests/${id}/classify`, {
    files: files.map(file => ({ name: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size })),
  }).then(({ data }) => data),
  upload: (id: string, requirementId: string | null, file: File, onProgress: (event: AxiosProgressEvent) => void) => {
    const body = new FormData()
    body.append('file', file)
    if (requirementId) body.append('requirement_id', requirementId)
    return api.post<PortalUploadResult>(`/portal/collection-requests/${id}/documents`, body, { onUploadProgress: onProgress }).then(({ data }) => data)
  },
  document: (linkId: string) => api.get<PortalDocument>(`/portal/document-links/${linkId}`).then(({ data }) => data),
  exclude: (linkId: string) => api.delete<PortalDocument>(`/portal/document-links/${linkId}`).then(({ data }) => data),
  submit: (id: string) => api.post<PortalCollectionDetail>(`/portal/collection-requests/${id}/submit`).then(({ data }) => data),
  download: (linkId: string) => api.get<Blob>(`/portal/document-links/${linkId}/download`, { responseType: 'blob' }).then(({ data }) => data),
}
