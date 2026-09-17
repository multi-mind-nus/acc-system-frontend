<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'

const props = defineProps<{ page: number; pageSize: number; total: number; disabled?: boolean }>()
defineEmits<{ page: [value: number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const { t } = useI18n()
</script>

<template>
  <nav class="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-sm" :aria-label="t('accounts.pagination')">
    <p class="text-xs text-muted-foreground">{{ t('accounts.pageSummary', { page, pages, total }) }}</p>
    <div class="flex gap-2">
      <Button variant="outline" size="sm" :disabled="disabled || page <= 1" @click="$emit('page', page - 1)">{{ t('accounts.previous') }}</Button>
      <Button variant="outline" size="sm" :disabled="disabled || page >= pages" @click="$emit('page', page + 1)">{{ t('accounts.next') }}</Button>
    </div>
  </nav>
</template>
