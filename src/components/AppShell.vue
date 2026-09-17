<script setup lang="ts">
import { computed, ref } from 'vue'
import { Building2, BriefcaseBusiness, ChevronRight, ContactRound, LogOut, UsersRound, UserRound } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { readApiError } from '@/api/client'
import BrandMark from '@/components/BrandMark.vue'
import ErrorNotice from '@/components/ErrorNotice.vue'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ area: 'staff' | 'client' }>()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const logoutError = ref<ReturnType<typeof readApiError> | null>(null)
const homePath = computed(() => `/${props.area}`)
const profilePath = computed(() => `/${props.area}/profile`)
const navigation = computed(() => [
  { path: homePath.value, title: 'nav.workspace', icon: Building2 },
  ...(auth.isStaff ? [{ path: '/staff/clients', title: 'accounts.clients', icon: BriefcaseBusiness }] : []),
  ...(auth.user?.firmRole === 'FIRM_ADMIN' ? [{ path: '/staff/admin/users', title: 'accounts.employees', icon: UsersRound }] : []),
  ...(!auth.isStaff && auth.user?.clientMemberships.some(member => member.role === 'CLIENT_ADMIN') ? [{ path: '/client/contacts', title: 'accounts.contacts', icon: ContactRound }] : []),
  { path: profilePath.value, title: 'nav.profile', icon: UserRound },
])
const active = (path: string) => path === homePath.value ? route.path === path : route.path === path || route.path.startsWith(`${path}/`)
const initials = computed(() => auth.user?.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() ?? '')
const pageTitle = computed(() => {
  if (typeof route.meta.title === 'string') return t(route.meta.title)
  if (route.name === 'staff-not-found' || route.name === 'client-not-found') return t('notFound.title')
  return route.path.endsWith('/profile') ? t('nav.profile') : t('nav.workspace')
})

async function signOut() {
  logoutError.value = null
  try {
    await auth.logout()
    await router.replace('/login')
  } catch (error) {
    logoutError.value = readApiError(error)
  }
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <RouterLink :to="homePath" class="flex h-[76px] items-center gap-3 px-6">
        <BrandMark inverted />
        <span class="text-lg font-semibold tracking-tight">{{ t('app.name') }}</span>
      </RouterLink>

      <div class="mx-4 mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
        <p class="mb-1 text-[11px] text-white/50">{{ t('home.firm') }}</p>
        <p class="truncate text-[13px] font-medium" :title="auth.user?.firm.name">{{ auth.user?.firm.name }}</p>
      </div>
      <nav class="mt-7 flex-1 space-y-1 px-4" :aria-label="t('nav.primary')">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          class="flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
          :class="active(item.path) ? '!bg-sidebar-accent !text-white' : ''"
          :aria-current="active(item.path) ? 'page' : undefined"
        >
          <component :is="item.icon" class="size-[18px]" />{{ t(item.title) }}
        </RouterLink>
      </nav>

      <div class="mx-4 mb-4 flex items-center gap-3 border-t border-white/10 pt-5">
        <span class="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-medium">{{ initials }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-medium">{{ auth.user?.name }}</p>
          <p class="mt-0.5 truncate text-[11px] text-white/50">{{ auth.user?.email }}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" class="text-white/60 hover:bg-white/10 hover:text-white" :aria-label="t('auth.signOut')" :title="t('auth.signOut')" @click="signOut">
          <LogOut class="size-4" />
        </Button>
      </div>
    </aside>

    <div class="lg:pl-60">
      <header class="border-b bg-card">
        <div class="flex h-[76px] items-center gap-3 px-5 sm:px-8">
          <RouterLink :to="homePath" class="flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span class="text-sm font-semibold sm:text-base">{{ t('app.name') }}</span>
          </RouterLink>
          <div class="hidden min-w-0 items-center gap-3 text-sm lg:flex">
            <span class="truncate text-muted-foreground">{{ auth.user?.firm.name }}</span>
            <ChevronRight class="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            <span class="shrink-0 font-medium">{{ pageTitle }}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" class="ml-auto lg:hidden" :aria-label="t('auth.signOut')" @click="signOut">
            <LogOut class="size-4" />
          </Button>
        </div>
        <nav class="flex gap-6 overflow-x-auto px-5 text-sm sm:px-8 lg:hidden" :aria-label="t('nav.primary')">
          <RouterLink v-for="item in navigation" :key="item.path" :to="item.path" class="shrink-0 border-b-2 border-transparent py-3 text-muted-foreground" :class="active(item.path) ? '!border-primary !text-primary' : ''" :aria-current="active(item.path) ? 'page' : undefined">
            {{ t(item.title) }}
          </RouterLink>
        </nav>
      </header>
      <main class="mx-auto max-w-[1360px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <ErrorNotice v-if="logoutError" v-bind="logoutError" class="mb-6" />
        <RouterView />
      </main>
    </div>
  </div>
</template>
