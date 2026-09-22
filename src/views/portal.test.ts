import { createRenderer, ssrContextKey } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import { portalApi, type PortalCollectionDetail } from '@/api/portal'
import { portalMessages } from '@/i18n/portal'
import { useAuthStore } from '@/stores/auth'
import PortalCollectionDetailView from './PortalCollectionDetailView.vue'
import PortalCollectionsView from './PortalCollectionsView.vue'

const renderer = createRenderer({
  insert: () => {}, remove: () => {}, patchProp: () => {}, createElement: () => ({}),
  createText: () => ({}), createComment: () => ({}), setText: () => {},
  setElementText: () => {}, parentNode: () => null, nextSibling: () => null,
})

afterEach(() => vi.restoreAllMocks())

it('applies client collection filters and sorting from the URL', async () => {
  const list = vi.spyOn(portalApi, 'list').mockResolvedValue({ items: [], total: 0 })
  const pinia = createPinia()
  useAuthStore(pinia).user = {
    id: 'user', email: 'client@test.com', name: 'Client', firmRole: null,
    firm: { id: 'firm', name: 'Firm', timezone: 'UTC' },
    clientMemberships: [{ clientId: 'client', clientName: 'Client Ltd', role: 'CLIENT_SUBMITTER' }],
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/client/collections', component: { render: () => null } },
  ] })
  await router.push('/client/collections?client=client&period=2026-09&status=OPEN&sort=due_at%3Aasc')
  const app = renderer.createApp({ ...PortalCollectionsView, render: () => null })
    .use(pinia).use(router).use(createI18n({ legacy: false, locale: 'en', messages: portalMessages }))
  app.provide(ssrContextKey, {})
  app.mount({})
  try {
    const state = (app._instance as unknown as { setupState: {
      loading: boolean
      filters: { client: string; period: string; status: string; sort: string }
    } }).setupState
    await vi.waitFor(() => expect(state.loading).toBe(false))
    expect(list).toHaveBeenLastCalledWith({
      clientId: 'client', period: '2026-09-01', status: 'OPEN', sort: 'due_at', order: 'asc',
    })
    state.filters.period = '2026-10'
    await vi.waitFor(() => expect(router.currentRoute.value.query.period).toBe('2026-10'))
    await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ period: '2026-10-01' })))
  } finally { app.unmount() }
})

it('reviews AI classifications before upload and leaves the checklist unchanged when cancelled', async () => {
  const detail: PortalCollectionDetail = {
    id: 'request', clientId: 'client', clientName: 'Client', period: '2026-09-01',
    dueAt: '2026-09-25T00:00:00Z', status: 'OPEN', assigneeName: 'Accountant',
    requiredCount: 1, readyCount: 0, updatedAt: '2026-09-01T00:00:00Z', scopeNote: null, submission: null,
    requirements: [
      { id: 'bank', type: 'BANK_STATEMENT', title: 'Bank statement', required: true, criteria: {}, status: 'PENDING', clientMessage: null, documents: [] },
      { id: 'other', type: 'OTHER', title: 'Other supporting documents', required: false, criteria: {}, status: 'PENDING', clientMessage: null, documents: [] },
    ],
  }
  vi.spyOn(portalApi, 'get').mockResolvedValue(detail)
  let finishAnalysis!: (result: Awaited<ReturnType<typeof portalApi.classify>>) => void
  const classify = vi.spyOn(portalApi, 'classify').mockReturnValue(new Promise(resolve => { finishAnalysis = resolve }))
  const upload = vi.spyOn(portalApi, 'upload')
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/client/collections/:id', component: { render: () => null } },
  ] })
  await router.push('/client/collections/request')
  const app = renderer.createApp({ ...PortalCollectionDetailView, render: () => null })
    .use(router).use(createI18n({ legacy: false, locale: 'en', messages: portalMessages }))
  app.provide(ssrContextKey, {})
  app.mount({})
  try {
    const state = (app._instance as unknown as { setupState: {
      loading: boolean
      smartDialogOpen: boolean
      smartPhase: string
      smartCancelConfirm: boolean
      smartCandidates: Array<{ id: string; target: string }>
      detail: PortalCollectionDetail
      smartCategories: Array<{ target: string }>
      requirementEditable: (requirement: PortalCollectionDetail['requirements'][number]) => boolean
      requirementHasIssue: (requirement: PortalCollectionDetail['requirements'][number]) => boolean
      prepareSmartUpload: (files: File[]) => void
      startSmartAnalysis: () => Promise<void>
      moveSmartCandidate: (candidateId: string, target: string) => void
      requestSmartClose: (open: boolean) => void
      discardSmartUpload: () => void
    } }).setupState
    await vi.waitFor(() => expect(state.loading).toBe(false))
    state.prepareSmartUpload([
      new File(['statement'], 'bank-statement.pdf', { type: 'application/pdf' }),
      new File(['notes'], 'notes.txt', { type: 'text/plain' }),
    ])

    expect(state.smartDialogOpen).toBe(true)
    expect(state.smartPhase).toBe('confirm')
    expect(classify).not.toHaveBeenCalled()

    const analysis = state.startSmartAnalysis()
    expect(state.smartPhase).toBe('analyzing')
    finishAnalysis({ provider: 'FAKE', items: [
      { index: 0, category: 'REQUIREMENT', requirementId: 'bank', confidence: 0.9 },
      { index: 1, category: 'INVALID', requirementId: null, confidence: 0.99 },
    ] })
    await analysis
    expect(state.smartPhase).toBe('results')
    expect(state.smartCandidates.map(candidate => candidate.target)).toEqual(['bank', '__invalid__'])

    state.moveSmartCandidate(state.smartCandidates[1]!.id, 'other')
    expect(state.smartCandidates[1]?.target).toBe('other')
    expect(upload).not.toHaveBeenCalled()

    state.requestSmartClose(false)
    expect(state.smartCancelConfirm).toBe(true)
    expect(state.smartDialogOpen).toBe(true)
    state.discardSmartUpload()
    expect(state.smartDialogOpen).toBe(false)
    expect(detail.requirements.flatMap(item => item.documents)).toEqual([])

    state.detail.status = 'CHANGES_REQUESTED'
    state.detail.requirements[0]!.status = 'SATISFIED'
    expect(state.requirementEditable(state.detail.requirements[0]!)).toBe(false)
    state.detail.requirements[0]!.status = 'RECEIVED'
    state.detail.requirements[0]!.clientMessage = 'Wrong period'
    expect(state.requirementHasIssue(state.detail.requirements[0]!)).toBe(true)
    expect(state.requirementEditable(state.detail.requirements[1]!)).toBe(false)
    state.detail.requirements[0]!.status = 'NEEDS_ACTION'
    expect(state.requirementEditable(state.detail.requirements[0]!)).toBe(true)
    expect(state.smartCategories.map(category => category.target)).toEqual(['bank', '__invalid__'])
  } finally { app.unmount() }
})
