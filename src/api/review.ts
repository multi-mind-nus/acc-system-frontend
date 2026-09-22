import { api } from './client'
import type { CollectionStatus, WorkflowEvent } from './collections'

export type EvidenceRelation = 'SUPPORTS' | 'CONTRADICTS' | 'REFERENCE'
export type ReviewAction = 'SATISFY' | 'REQUEST_ACTION' | 'WAIVE'
export type IssueCode = 'MISSING' | 'WRONG_PERIOD' | 'ENTITY_MISMATCH' | 'UNREADABLE' | 'INCOMPLETE' | 'OTHER'

export interface ReviewDocument {
  id: string
  linkId: string
  submissionId: string
  roundNo: number
  name: string
  contentType: string
  sizeBytes: number
  status: string
  documentType: string
  relation: EvidenceRelation
  createdAt: string
}

export interface ReviewDecision {
  id: string
  submissionId: string
  decision: ReviewAction
  issueCode: IssueCode | null
  clientMessage: string | null
  internalNote: string | null
  createdBy: string
  createdByName: string
  createdAt: string
  evidence: Array<{ documentId: string; relation: EvidenceRelation }>
}

export interface ReviewRequirement {
  id: string
  type: string
  title: string
  required: boolean
  status: string
  version: number
  issueCode: IssueCode | null
  clientMessage: string | null
  internalNote: string | null
  documents: ReviewDocument[]
  decisions: ReviewDecision[]
}

export interface ReviewCollection {
  id: string
  clientId: string
  clientName: string
  period: string
  dueAt: string
  status: CollectionStatus
  version: number
  assigneeName: string
  requirements: ReviewRequirement[]
  otherDocuments: ReviewDocument[]
  submissions: Array<{ id: string; roundNo: number; note: string | null; submittedAt: string | null }>
  events: WorkflowEvent[]
}

const idempotency = (key: string) => ({ headers: { 'Idempotency-Key': key } })

export const reviewApi = {
  get: (id: string) => api.get<ReviewCollection>(`/collection-requests/${id}/review`).then(({ data }) => data),
  review: (id: string, body: {
    version: number
    submissionId: string
    decision: ReviewAction
    issueCode?: IssueCode
    clientMessage?: string
    internalNote?: string
  }) => api.post<ReviewCollection>(`/requirements/${id}/review`, body).then(({ data }) => data),
  requestChanges: (id: string, version: number, reason: string, key: string) => api.post<ReviewCollection>(`/collection-requests/${id}/request-changes`, { version, reason }, idempotency(key)).then(({ data }) => data),
  approve: (id: string, version: number, key: string) => api.post<ReviewCollection>(`/collection-requests/${id}/approve`, { version }, idempotency(key)).then(({ data }) => data),
  reopen: (id: string, version: number, reason: string, key: string) => api.post<ReviewCollection>(`/collection-requests/${id}/reopen`, { version, reason }, idempotency(key)).then(({ data }) => data),
  download: (id: string) => api.get<Blob>(`/documents/${id}/download`, { responseType: 'blob' }).then(({ data }) => data),
}
