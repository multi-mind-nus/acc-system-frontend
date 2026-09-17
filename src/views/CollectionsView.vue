<script setup lang="ts">
import { ArrowUpRight, ClipboardList, Plus } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { accountsApi, type ClientAccount, type Page, type UserAccount } from '@/api/accounts'
import { readApiError } from '@/api/client'
import { collectionsApi, type CollectionStatus, type CollectionSummary } from '@/api/collections'
import CollectionDetailPanel from '@/components/CollectionDetailPanel.vue'
import DatePicker from '@/components/DatePicker.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import ErrorNotice from '@/components/ErrorNotice.vue'
import ListPagination from '@/components/ListPagination.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t, locale } = useI18n()
const page = computed(() => Math.max(1, Number.parseInt(String(route.query.page), 10) || 1))
const selected = computed(() => typeof route.query.selected === 'string' ? route.query.selected : '')
const result = ref<Page<CollectionSummary>>({ items: [], total: 0, page: 1, pageSize: 20 })
const clients = ref<ClientAccount[]>([])
const assignees = ref<UserAccount[]>([])
const loading = ref(false)
const error = ref<ReturnType<typeof readApiError> | null>(null)
const filters = ref({ client: 'all', period: '', status: 'all', assignee: 'all', dueFrom: '', dueTo: '', sort: 'due_at:asc' })
const statuses: CollectionStatus[] = ['DRAFT', 'OPEN', 'IN_REVIEW', 'CHANGES_REQUESTED', 'READY_FOR_BOOKKEEPING', 'CLOSED', 'CANCELLED']
let generation = 0

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat(locale.value, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))
}

function syncFilters() {
  filters.value = {
    client: typeof route.query.client === 'string' ? route.query.client : 'all',
    period: typeof route.query.period === 'string' ? route.query.period : '',
    status: statuses.includes(route.query.status as CollectionStatus) ? String(route.query.status) : 'all',
    assignee: typeof route.query.assignee === 'string' ? route.query.assignee : 'all',
    dueFrom: typeof route.query.dueFrom === 'string' ? route.query.dueFrom : '',
    dueTo: typeof route.query.dueTo === 'string' ? route.query.dueTo : '',
    sort: typeof route.query.sort === 'string' && ['due_at:asc', 'due_at:desc', 'period:desc', 'created_at:desc'].includes(route.query.sort) ? route.query.sort : 'due_at:asc',
  }
}

async function loadOptions() {
  try {
    const [clientPage, userPage] = await Promise.all([
      accountsApi.listClients({ page: 1, pageSize: 100 }),
      auth.user?.firmRole === 'FIRM_ADMIN' ? accountsApi.listUsers({ page: 1, pageSize: 100, status: 'ACTIVE', staffOnly: true }) : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
    ])
    clients.value = clientPage.items
    assignees.value = userPage.items
    if (auth.user && !assignees.value.some(item => item.id === auth.user?.id)) assignees.value.unshift({ id: auth.user.id, name: auth.user.name, email: auth.user.email, status: 'ACTIVE', firmRole: auth.user.firmRole, clientRoles: [], lastLoginAt: null })
  } catch { /* The list remains usable if optional filter choices fail. */ }
}

async function load() {
  const current = ++generation
  syncFilters()
  loading.value = true
  error.value = null
  const [sort, order] = filters.value.sort.split(':') as ['due_at' | 'period' | 'created_at', 'asc' | 'desc']
  try {
    const data = await collectionsApi.list({
      page: page.value, pageSize: 20,
      clientId: filters.value.client === 'all' ? undefined : filters.value.client,
      period: filters.value.period ? `${filters.value.period}-01` : undefined,
      status: filters.value.status === 'all' ? undefined : filters.value.status as CollectionStatus,
      assigneeId: filters.value.assignee === 'all' ? undefined : filters.value.assignee,
      dueFrom: filters.value.dueFrom ? new Date(`${filters.value.dueFrom}T00:00:00`).toISOString() : undefined,
      dueTo: filters.value.dueTo ? new Date(`${filters.value.dueTo}T23:59:59`).toISOString() : undefined,
      sort, order,
    })
    if (current === generation) result.value = data
  } catch (caught) { if (current === generation) error.value = readApiError(caught) }
  finally { if (current === generation) loading.value = false }
}

function navigate(nextPage = 1) {
  return router.push({ query: {
    client: filters.value.client === 'all' ? undefined : filters.value.client,
    period: filters.value.period || undefined,
    status: filters.value.status === 'all' ? undefined : filters.value.status,
    assignee: filters.value.assignee === 'all' ? undefined : filters.value.assignee,
    dueFrom: filters.value.dueFrom || undefined,
    dueTo: filters.value.dueTo || undefined,
    sort: filters.value.sort === 'due_at:asc' ? undefined : filters.value.sort,
    page: nextPage > 1 ? nextPage : undefined,
  } })
}

function clearFilters() {
  filters.value = { client: 'all', period: '', status: 'all', assignee: 'all', dueFrom: '', dueTo: '', sort: 'due_at:asc' }
  return navigate()
}

watch(() => [route.query.page, route.query.client, route.query.period, route.query.status, route.query.assignee, route.query.dueFrom, route.query.dueTo, route.query.sort], load, { immediate: true })
loadOptions()
</script>

<template>
  <section class="space-y-7 xl:flex xl:h-[calc(100vh-6rem)] xl:flex-col xl:gap-7 xl:space-y-0">
    <header class="flex flex-wrap items-start justify-between gap-4"><div><h1 class="text-[32px] leading-tight font-semibold tracking-[-0.025em]">{{ t('collections.title') }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ t('collections.description') }}</p></div><Button as-child class="h-10"><RouterLink :to="{ name: 'collection-new' }"><Plus class="size-4" />{{ t('collections.new') }}</RouterLink></Button></header>

    <div class="grid items-start gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(620px,1.35fr)_minmax(360px,0.8fr)]">
      <section class="app-panel min-w-0 overflow-hidden" :aria-busy="loading">
        <form class="grid gap-3 border-b p-5 sm:grid-cols-2 lg:grid-cols-3" @submit.prevent="navigate()">
          <Select v-model="filters.client"><SelectTrigger size="lg" class="w-full bg-card" :aria-label="t('collections.client')"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="all">{{ t('collections.allClients') }}</SelectItem><SelectItem v-for="client in clients" :key="client.id" :value="client.id">{{ client.legalName }}</SelectItem></SelectContent></Select>
          <DatePicker v-model="filters.period" mode="month" :label="t('collections.period')" :placeholder="t('collections.allPeriods')" />
          <Select v-model="filters.status"><SelectTrigger size="lg" class="w-full bg-card" :aria-label="t('collections.statusLabel')"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="all">{{ t('collections.allStatuses') }}</SelectItem><SelectItem v-for="status in statuses" :key="status" :value="status">{{ t(`collections.status.${status}`) }}</SelectItem></SelectContent></Select>
          <Select v-model="filters.assignee"><SelectTrigger size="lg" class="w-full bg-card" :aria-label="t('collections.assignee')"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="all">{{ t('collections.allAssignees') }}</SelectItem><SelectItem v-for="user in assignees" :key="user.id" :value="user.id">{{ user.name }}</SelectItem></SelectContent></Select>
          <DateRangePicker v-model:start="filters.dueFrom" v-model:end="filters.dueTo" :label="t('collections.dueRange')" :placeholder="t('collections.dueRange')" />
          <Select v-model="filters.sort"><SelectTrigger size="lg" class="w-full bg-card" :aria-label="t('collections.sort')"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="due_at:asc">{{ t('collections.sortDueSoonest') }}</SelectItem><SelectItem value="due_at:desc">{{ t('collections.sortDueLatest') }}</SelectItem><SelectItem value="period:desc">{{ t('collections.sortPeriod') }}</SelectItem><SelectItem value="created_at:desc">{{ t('collections.sortNewest') }}</SelectItem></SelectContent></Select>
          <div class="flex gap-2 sm:col-span-2 lg:col-span-3"><Button type="submit" variant="outline">{{ t('collections.apply') }}</Button><Button type="button" variant="ghost" @click="clearFilters">{{ t('collections.clear') }}</Button><p class="ml-auto self-center text-xs text-muted-foreground">{{ t('collections.recordCount', { count: result.total }) }}</p></div>
        </form>

        <div v-if="error" class="space-y-3 p-5"><ErrorNotice v-bind="error" /><Button variant="outline" @click="load">{{ t('collections.retry') }}</Button></div>
        <p v-else-if="loading" role="status" class="p-8 text-sm text-muted-foreground">{{ t('collections.loading') }}</p>
        <template v-else>
          <div v-if="result.items.length" class="divide-y md:hidden">
            <RouterLink v-for="item in result.items" :key="item.id" :to="{ name: 'collection-detail', params: { id: item.id }, query: route.query }" class="block px-5 py-4 active:bg-muted/50"><span class="flex items-start justify-between gap-3"><span class="min-w-0 font-medium">{{ item.clientName }}</span><StatusBadge :status="item.status" translation-prefix="collections.status" /></span><span class="mt-2 block text-xs text-muted-foreground">{{ formatPeriod(item.period) }} · {{ formatDate(item.dueAt) }} · {{ item.assigneeName }}</span></RouterLink>
          </div>
          <div v-if="result.items.length" class="hidden overflow-x-auto md:block">
            <table class="w-full min-w-[720px] text-left text-sm"><thead class="border-b bg-muted/35 text-xs text-muted-foreground"><tr><th class="px-5 py-3.5 font-medium">{{ t('collections.client') }}</th><th class="px-5 py-3.5 font-medium">{{ t('collections.period') }}</th><th class="px-5 py-3.5 font-medium">{{ t('collections.dueDate') }}</th><th class="px-5 py-3.5 font-medium">{{ t('collections.assignee') }}</th><th class="px-5 py-3.5 font-medium">{{ t('collections.statusLabel') }}</th></tr></thead><tbody class="divide-y"><tr v-for="item in result.items" :key="item.id" class="group hover:bg-muted/25" :class="selected === item.id ? 'bg-muted/40' : ''"><td class="px-5 py-4"><RouterLink class="inline-flex items-center gap-2 font-medium xl:hidden" :to="{ name: 'collection-detail', params: { id: item.id }, query: route.query }">{{ item.clientName }}<ArrowUpRight class="size-3.5" /></RouterLink><RouterLink class="hidden font-medium xl:inline" :to="{ query: { ...route.query, selected: item.id } }">{{ item.clientName }}</RouterLink></td><td class="whitespace-nowrap px-5 py-4">{{ formatPeriod(item.period) }}</td><td class="whitespace-nowrap px-5 py-4 text-muted-foreground">{{ formatDate(item.dueAt) }}</td><td class="whitespace-nowrap px-5 py-4 text-muted-foreground">{{ item.assigneeName }}</td><td class="px-5 py-4"><StatusBadge :status="item.status" translation-prefix="collections.status" /></td></tr></tbody></table>
          </div>
          <div v-else class="px-6 py-16 text-center"><ClipboardList class="mx-auto mb-4 size-7 text-muted-foreground" /><h2 class="text-base font-medium">{{ t(Object.values(filters).some(value => value && value !== 'all' && value !== 'due_at:asc') ? 'collections.noResults' : 'collections.noRequests') }}</h2><p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{{ t(Object.values(filters).some(value => value && value !== 'all' && value !== 'due_at:asc') ? 'collections.noResultsHint' : 'collections.noRequestsHint') }}</p></div>
        </template>
        <ListPagination :page="page" :page-size="20" :total="result.total" :disabled="loading || !!error" @page="navigate" />
      </section>

      <aside class="app-panel sticky top-8 hidden overflow-hidden xl:block" :class="selected ? 'h-full' : ''">
        <CollectionDetailPanel v-if="selected" :request-id="selected" embedded @updated="load" />
        <div v-else class="grid min-h-72 place-items-center p-8 text-center"><div><ClipboardList class="mx-auto size-8 text-muted-foreground" /><p class="mt-3 text-sm text-muted-foreground">{{ t('collections.selectRequest') }}</p></div></div>
      </aside>
    </div>
  </section>
</template>
