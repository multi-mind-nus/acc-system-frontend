<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Building2, Plus, Search, ArrowUpRight } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { accountsApi, type ClientAccount, type Page } from '@/api/accounts'
import { readApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import ErrorNotice from '@/components/ErrorNotice.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ListPagination from '@/components/ListPagination.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const isAdmin = computed(() => auth.user?.firmRole === 'FIRM_ADMIN')
const page = computed(() => Math.min(100000, Math.max(1, Number.parseInt(String(route.query.page), 10) || 1)))
const search = ref('')
const status = ref('all')
const result = ref<Page<ClientAccount>>({ items: [], total: 0, page: 1, pageSize: 20 })
const loading = ref(false)
const error = ref<ReturnType<typeof readApiError> | null>(null)
let request = 0

async function load() {
  const current = ++request
  loading.value = true
  error.value = null
  search.value = typeof route.query.search === 'string' ? route.query.search.slice(0, 100) : ''
  status.value = ['ACTIVE', 'DISABLED'].includes(String(route.query.status)) ? String(route.query.status) : 'all'
  try {
    const data = await accountsApi.listClients({
      page: page.value, pageSize: 20, search: search.value || undefined,
      status: status.value === 'ACTIVE' || status.value === 'DISABLED' ? status.value : undefined,
    })
    if (current === request) result.value = data
  } catch (caught) {
    if (current === request) error.value = readApiError(caught)
  } finally {
    if (current === request) loading.value = false
  }
}

function navigate(nextPage = 1) {
  return router.push({ query: { search: search.value.trim() || undefined, status: status.value === 'all' ? undefined : status.value, page: nextPage > 1 ? nextPage : undefined } })
}
watch(() => [route.query.page, route.query.search, route.query.status], load, { immediate: true })
</script>

<template>
  <section class="space-y-7">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div><h1 class="text-[28px] font-semibold tracking-tight">{{ t('accounts.clients') }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ t('accounts.description') }}</p></div>
      <Button v-if="isAdmin" as-child class="h-10"><RouterLink :to="{ name: 'client-new', query: route.query }"><Plus class="size-4" />{{ t('accounts.newClient') }}</RouterLink></Button>
    </header>
    <section class="overflow-hidden rounded-xl border bg-card shadow-[0_2px_6px_#182d2308]" :aria-busy="loading">
      <form class="flex flex-wrap gap-3 border-b p-5" @submit.prevent="navigate()">
        <div class="relative min-w-48 flex-1 sm:max-w-sm">
          <Search class="absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <Input v-model="search" class="h-10 pl-9" :placeholder="t('accounts.searchHint')" :aria-label="t('accounts.searchHint')" maxlength="100" />
        </div>
        <Select v-model="status" @update:model-value="navigate()">
          <SelectTrigger size="lg" class="w-40" :aria-label="t('accounts.statusLabel')"><SelectValue /></SelectTrigger>
          <SelectContent position="popper"><SelectItem value="all">{{ t('accounts.allStatuses') }}</SelectItem><SelectItem value="ACTIVE">{{ t('accounts.status.ACTIVE') }}</SelectItem><SelectItem value="DISABLED">{{ t('accounts.status.DISABLED') }}</SelectItem></SelectContent>
        </Select>
        <Button type="submit" variant="outline" class="h-10">{{ t('accounts.search') }}</Button>
      </form>
      <div v-if="error" class="space-y-3 p-5"><ErrorNotice v-bind="error" /><Button variant="outline" @click="load">{{ t('accounts.retry') }}</Button></div>
      <p v-else-if="loading" role="status" class="p-8 text-sm text-muted-foreground">{{ t('accounts.loading') }}</p>
      <template v-else>
        <div v-if="result.items.length" class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th scope="col" class="px-6 py-3 font-medium">{{ t('accounts.clients') }}</th><th scope="col" class="px-6 py-3 font-medium">{{ t('accounts.code') }}</th><th scope="col" class="px-6 py-3 font-medium">{{ t('accounts.currency') }}</th><th scope="col" class="px-6 py-3 font-medium">{{ t('accounts.statusLabel') }}</th></tr></thead>
            <tbody class="divide-y">
              <tr v-for="client in result.items" :key="client.id" class="hover:bg-muted/30">
                <td class="min-w-60 px-6 py-5"><RouterLink class="group inline-flex items-center gap-3 font-medium underline-offset-4 hover:underline focus-visible:outline-ring" :to="{ name: 'client-detail', params: { id: client.id }, query: route.query }"><span class="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/50 text-muted-foreground"><Building2 class="size-4" /></span>{{ client.legalName }}<ArrowUpRight class="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" /></RouterLink></td>
                <td class="px-6 py-5 font-mono text-xs text-muted-foreground">{{ client.code }}</td><td class="px-6 py-5">{{ client.baseCurrency }}</td><td class="px-6 py-5"><StatusBadge :status="client.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-6 py-16 text-center"><Building2 class="mx-auto mb-4 size-7 text-muted-foreground" /><h2 class="text-base font-medium">{{ t(search || status !== 'all' || page > 1 ? 'accounts.noResults' : 'accounts.noClients') }}</h2><p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{{ t(search || status !== 'all' || page > 1 ? 'accounts.noResultsHint' : 'accounts.noClientsHint') }}</p></div>
      </template>
      <ListPagination :page="page" :page-size="20" :total="result.total" :disabled="loading || !!error" @page="navigate" />
    </section>
  </section>
</template>
