<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ status: string }>()
const { t } = useI18n()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium" :class="['ACTIVE', 'ACCEPTED'].includes(status) ? 'border-primary/15 bg-accent text-accent-foreground' : 'bg-muted/60 text-muted-foreground'">
    <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />{{ t(`accounts.status.${status}`) }}
  </span>
</template>
