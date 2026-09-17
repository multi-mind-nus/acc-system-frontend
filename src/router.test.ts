import { createPinia, setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import type { Principal } from '@/types'
import { useAuthStore } from '@/stores/auth'

vi.mock('vue-router', async (importOriginal) => {
  const original = await importOriginal<typeof import('vue-router')>()
  return { ...original, createWebHistory: original.createMemoryHistory }
})
vi.mock('@/components/AppShell.vue', () => ({ default: {} }))
vi.mock('@/views/HomeView.vue', () => ({ default: {} }))
vi.mock('@/views/LoginView.vue', () => ({ default: {} }))
vi.mock('@/views/NotFoundView.vue', () => ({ default: {} }))
vi.mock('@/views/ProfileView.vue', () => ({ default: {} }))

import { router } from './router'

it('enforces staff/client boundaries and preserves guest return paths with the real guard', async () => {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.initialized = true
  const user: Principal = {
    id: 'user-1', name: 'Accountant', email: 'accountant@example.com',
    firm: { id: 'firm-1', name: 'Firm', timezone: 'UTC' },
    firmRole: 'ACCOUNTANT', clientMemberships: [],
  }

  await router.push('/staff/profile?tab=security#password')
  expect(router.currentRoute.value.name).toBe('login')
  expect(router.currentRoute.value.query.redirect).toBe('/staff/profile?tab=security#password')

  auth.user = user
  await router.push('/client/profile')
  expect(router.currentRoute.value.path).toBe('/staff')
  await router.push('/login')
  expect(router.currentRoute.value.path).toBe('/staff')

  auth.user = {
    ...user, firmRole: null,
    clientMemberships: [{ clientId: 'client-1', clientName: 'Client', role: 'CLIENT_SUBMITTER' }],
  }
  await router.push('/staff/profile')
  expect(router.currentRoute.value.path).toBe('/client')
  await router.push('/login')
  expect(router.currentRoute.value.path).toBe('/client')

  auth.clearSession()
  await router.push('/client/missing')
  expect(router.currentRoute.value.name).toBe('login')
  expect(router.currentRoute.value.query.redirect).toBe('/client/missing')
})
