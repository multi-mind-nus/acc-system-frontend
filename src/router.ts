import { createRouter, createWebHistory } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import ProfileView from '@/views/ProfileView.vue'
import { useAuthStore } from '@/stores/auth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { guest: true } },
    {
      path: '/staff', component: AppShell, props: { area: 'staff' },
      meta: { requiresAuth: true, area: 'staff' },
      children: [
        { path: '', name: 'staff-home', component: HomeView },
        { path: 'profile', name: 'staff-profile', component: ProfileView },
        { path: ':pathMatch(.*)*', name: 'staff-not-found', component: NotFoundView },
      ],
    },
    {
      path: '/client', component: AppShell, props: { area: 'client' },
      meta: { requiresAuth: true, area: 'client' },
      children: [
        { path: '', name: 'client-home', component: HomeView },
        { path: 'profile', name: 'client-profile', component: ProfileView },
        { path: ':pathMatch(.*)*', name: 'client-not-found', component: NotFoundView },
      ],
    },
    { path: '/', redirect: '/staff' },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.bootstrap()
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guest && auth.isAuthenticated) return auth.homePath
  if (to.meta.area === 'staff' && !auth.isStaff) return '/client'
  if (to.meta.area === 'client' && auth.isStaff) return '/staff'
})
