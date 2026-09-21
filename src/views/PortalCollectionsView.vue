<script setup lang="ts">
import { ArrowUpRight, ClipboardList } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { portalApi, type PortalCollectionSummary } from '@/api/portal'
import { readApiError } from '@/api/client'
import ErrorNotice from '@/components/ErrorNotice.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const { t, locale } = useI18n()
const items = ref<PortalCollectionSummary[]>([])
const loading = ref(true)
const error = ref<ReturnType<typeof readApiError> | null>(null)

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))
}

function progress(item: PortalCollectionSummary) {
  return item.requiredCount ? Math.round(item.readyCount / item.requiredCount * 100) : 100
}

async function load() {
  loading.value = true
  error.value = null
  try { items.value = (await portalApi.list()).items }
  catch (caught) { error.value = readApiError(caught) }
  finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <section class="space-y-7">
    <header>
      <h1 class="text-[32px] leading-tight font-semibold tracking-[-0.025em]">{{ t('portal.title') }}</h1>
      <p class="mt-2 text-sm text-muted-foreground">{{ t('portal.description') }}</p>
    </header>

    <div v-if="error" class="space-y-3"><ErrorNotice v-bind="error" /><Button variant="outline" @click="load">{{ t('portal.retry') }}</Button></div>
    <p v-else-if="loading" role="status" class="text-sm text-muted-foreground">{{ t('portal.loading') }}</p>
    <section v-else-if="items.length" class="app-panel overflow-hidden">
      <RouterLink
        v-for="item in items"
        :key="item.id"
        :to="{ name: 'portal-collection-detail', params: { id: item.id } }"
        class="group grid gap-4 border-b px-5 py-5 transition-colors last:border-b-0 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-center sm:px-7"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2.5">
            <h2 class="text-base font-semibold">{{ formatPeriod(item.period) }}</h2>
            <StatusBadge :status="item.status" translation-prefix="collections.status" />
          </div>
          <p class="mt-1.5 text-sm text-muted-foreground">{{ item.clientName }} · {{ t('portal.due', { date: formatDate(item.dueAt) }) }}</p>
        </div>
        <div>
          <div class="mb-2 flex justify-between text-xs"><span class="text-muted-foreground">{{ t('portal.progress') }}</span><span class="font-medium">{{ item.readyCount }}/{{ item.requiredCount }}</span></div>
          <Progress :model-value="progress(item)" class="h-1.5" />
        </div>
        <ArrowUpRight class="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:block" />
      </RouterLink>
    </section>
    <section v-else class="app-panel grid min-h-72 place-items-center px-6 text-center">
      <div><ClipboardList class="mx-auto size-8 text-muted-foreground" /><h2 class="mt-4 font-medium">{{ t('portal.empty') }}</h2><p class="mt-2 text-sm text-muted-foreground">{{ t('portal.emptyHint') }}</p></div>
    </section>
  </section>
</template>
