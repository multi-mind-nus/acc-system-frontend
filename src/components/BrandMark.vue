<script setup lang="ts">
defineProps<{ inverted?: boolean }>()
</script>

<template>
  <span
    class="grid size-8 shrink-0 place-items-center rounded-lg"
    :class="inverted ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-primary text-primary-foreground'"
    aria-hidden="true"
  >
    <svg viewBox="0 0 24 24" class="size-[19px]" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M6.5 3.5h8l3 3v14h-11z" />
      <path d="M14.5 3.5v4h4M9 11h6M9 15h2.5M13.5 15H15M9 18h6" />
    </svg>
  </span>
</template>
