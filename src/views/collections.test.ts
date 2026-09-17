import { createPinia } from 'pinia'
import { createRenderer, ssrContextKey } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, expect, it, vi } from 'vitest'
import { accountsApi } from '@/api/accounts'
import { collectionsApi } from '@/api/collections'
import { useAuthStore } from '@/stores/auth'
import CollectionsView from './CollectionsView.vue'

const renderer = createRenderer({
  insert: () => {}, remove: () => {}, patchProp: () => {}, createElement: () => ({}),
  createText: () => ({}), createComment: () => ({}), setText: () => {},
  setElementText: () => {}, parentNode: () => null, nextSibling: () => null,
})

afterEach(() => vi.restoreAllMocks())

it('keeps the selected due-date range in the URL and API filter', async () => {
  vi.spyOn(accountsApi, 'listClients').mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 })
  const list = vi.spyOn(collectionsApi, 'list').mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
  const pinia = createPinia()
  useAuthStore(pinia).user = {
    id: 'accountant', email: 'acc@test.com', name: 'Accountant', firmRole: 'ACCOUNTANT',
    firm: { id: 'firm', name: 'Firm', timezone: 'UTC' }, clientMemberships: [],
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/staff/collections', name: 'collections', component: { render: () => null } },
  ] })
  await router.push('/staff/collections')
  const app = renderer.createApp({ ...CollectionsView, render: () => null })
    .use(pinia).use(router).use(createI18n({ legacy: false, locale: 'en', messages: { en: {} } }))
  app.provide(ssrContextKey, {})
  app.mount({})
  try {
    const state = (app._instance as unknown as { setupState: {
      filters: { dueFrom: string; dueTo: string }; navigate: () => Promise<unknown>
    } }).setupState
    state.filters.dueFrom = '2026-09-20'
    state.filters.dueTo = '2026-10-10'
    await state.navigate()
    expect(router.currentRoute.value.query).toEqual({ dueFrom: '2026-09-20', dueTo: '2026-10-10' })
    await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({
      dueFrom: new Date('2026-09-20T00:00:00').toISOString(),
      dueTo: new Date('2026-10-10T23:59:59').toISOString(),
    })))
  } finally { app.unmount() }
})
