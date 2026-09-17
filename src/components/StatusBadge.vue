<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ status: string }>()
const { t } = useI18n()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium"
    :class="['ACTIVE', 'ACCEPTED'].includes(status) ? 'border-primary/25 bg-accent text-accent-foreground' : status === 'PENDING' ? 'border-amber-700/25 bg-amber-500/10 text-amber-700 dark:text-amber-300' : status === 'EXPIRED' ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-border bg-muted/70 text-muted-foreground'"
  >
    <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />{{ t(`accounts.status.${status}`) }}
  </span>
</template>
