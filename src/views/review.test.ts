import { createPinia } from 'pinia'
import { createRenderer, nextTick, ssrContextKey } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { expect, it, vi } from 'vitest'
import { reviewApi, type ReviewCollection } from '@/api/review'
import { useAuthStore } from '@/stores/auth'
import CollectionReviewView from './CollectionReviewView.vue'

const renderer = createRenderer({
  insert: () => {}, remove: () => {}, patchProp: () => {}, createElement: () => ({}),
  createText: () => ({}), createComment: () => ({}), setText: () => {},
  setElementText: () => {}, parentNode: () => null, nextSibling: () => null,
})

it('defaults to the latest submission and filters every requirement to the selected round', async () => {
  const detail: ReviewCollection = {
    id: 'request', clientId: 'client', clientName: 'Client', period: '2026-09-01',
    dueAt: '2026-09-30T00:00:00Z', status: 'IN_REVIEW', version: 1,
    assigneeName: 'Accountant', otherDocuments: [
      { id: 'other-old', linkId: 'other-old-link', submissionId: 'round-1', roundNo: 1, name: 'notes-old.pdf', contentType: 'application/pdf', sizeBytes: 10, status: 'AVAILABLE', documentType: 'OTHER', relation: 'REFERENCE', createdAt: '2026-09-10T00:00:00Z' },
      { id: 'other-new', linkId: 'other-new-link', submissionId: 'round-2', roundNo: 2, name: 'notes-new.pdf', contentType: 'application/pdf', sizeBytes: 10, status: 'AVAILABLE', documentType: 'OTHER', relation: 'REFERENCE', createdAt: '2026-09-20T00:00:00Z' },
    ], events: [],
    submissions: [
      { id: 'round-1', roundNo: 1, note: null, submittedAt: '2026-09-10T00:00:00Z' },
      { id: 'round-2', roundNo: 2, note: null, submittedAt: '2026-09-20T00:00:00Z' },
    ],
    requirements: [{
      id: 'requirement', type: 'BANK_STATEMENT', title: 'Bank statement', required: true,
      status: 'RECEIVED', version: 1, issueCode: null, clientMessage: null, internalNote: null, decisions: [],
      documents: [
        { id: 'old', linkId: 'old-link', submissionId: 'round-1', roundNo: 1, name: 'old.pdf', contentType: 'application/pdf', sizeBytes: 10, status: 'AVAILABLE', documentType: 'BANK_STATEMENT', relation: 'SUPPORTS', createdAt: '2026-09-10T00:00:00Z' },
        { id: 'new', linkId: 'new-link', submissionId: 'round-2', roundNo: 2, name: 'new.pdf', contentType: 'application/pdf', sizeBytes: 10, status: 'AVAILABLE', documentType: 'BANK_STATEMENT', relation: 'SUPPORTS', createdAt: '2026-09-20T00:00:00Z' },
      ],
    }],
  }
  vi.spyOn(reviewApi, 'get').mockResolvedValue(detail)
  const pinia = createPinia()
  useAuthStore(pinia).user = { id: 'accountant', email: 'a@test.com', name: 'Accountant', firmRole: 'ACCOUNTANT', firm: { id: 'firm', name: 'Firm', timezone: 'UTC' }, clientMemberships: [] }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/staff/collections/:id/review', component: { render: () => null } }] })
  await router.push('/staff/collections/request/review')
  const app = renderer.createApp({ ...CollectionReviewView, render: () => null })
    .use(pinia).use(router).use(createI18n({ legacy: false, locale: 'en', messages: { en: {} } }))
  app.provide(ssrContextKey, {})
  app.mount({})
  try {
    const state = (app._instance as unknown as { setupState: { detail: ReviewCollection; selectedId: string; selectedSubmissionId: string; isLatestRound: boolean; decisionFinal: boolean; visibleDocuments: Array<{ id: string }> } }).setupState
    await vi.waitFor(() => expect(state.selectedSubmissionId).toBe('round-2'))
    expect(state.isLatestRound).toBe(true)
    expect(state.visibleDocuments.map(document => document.id)).toEqual(['new'])
    state.detail.requirements[0]!.status = 'SATISFIED'
    await nextTick()
    expect(state.decisionFinal).toBe(true)
    state.selectedSubmissionId = 'round-1'
    await nextTick()
    expect(state.isLatestRound).toBe(false)
    expect(state.visibleDocuments.map(document => document.id)).toEqual(['old'])
    state.selectedId = '__other_documents__'
    await nextTick()
    expect(state.visibleDocuments.map(document => document.id)).toEqual(['other-old'])
  } finally {
    app.unmount()
    vi.restoreAllMocks()
  }
})
