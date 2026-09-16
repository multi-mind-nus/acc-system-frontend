<script setup lang="ts">
const version = import.meta.env.VITE_APP_VERSION ?? 'dev'
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-background p-6 text-foreground">
    <section class="w-full max-w-lg space-y-4 rounded-xl border bg-card p-8 shadow-sm">
      <p class="text-sm font-medium text-muted-foreground">Deployment baseline</p>
      <h1 class="text-3xl font-semibold tracking-tight">会计资料收集系统</h1>
      <p class="text-muted-foreground">
        前端服务已启动。账户与业务功能将在后续阶段接入。
      </p>
      <p class="font-mono text-xs text-muted-foreground">版本：{{ version }}</p>
    </section>
  </main>
</template>
