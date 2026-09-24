<script setup lang="ts">
import { ArrowLeft, Plus, Trash2 } from '@lucide/vue'
import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { accountsApi, type ClientAccount, type UserAccount } from '@/api/accounts'
import { readApiError } from '@/api/client'
import { collectionsApi, type AIMode, type CollectionDetail, type CollectionSummary, type RequirementInput } from '@/api/collections'
import DatePicker from '@/components/DatePicker.vue'
import ErrorNotice from '@/components/ErrorNotice.vue'
import MonthPicker from '@/components/MonthPicker.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Stepper, StepperDescription, StepperIndicator, StepperItem, StepperSeparator, StepperTitle, StepperTrigger } from '@/components/ui/stepper'
import { useAuthStore } from '@/stores/auth'
import { aiThresholdLevel, aiThresholdPresets } from '@/lib/ai-policy'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t, locale } = useI18n()
const id = computed(() => typeof route.params.id === 'string' ? route.params.id : '')
const isEdit = computed(() => route.name === 'collection-edit')
const thresholdFields = [
  { key: 'aiSatisfyThreshold', label: 'aiSatisfyThreshold' },
  { key: 'aiRequestActionThreshold', label: 'aiReturnThreshold' },
] as const
const clients = ref<ClientAccount[]>([])
const assignees = ref<UserAccount[]>([])
const source = ref<CollectionDetail | null>(null)
const saving = ref(false)
const loading = ref(true)
const error = ref<ReturnType<typeof readApiError> | null>(null)
const saveError = ref<ReturnType<typeof readApiError> | null>(null)
const createKey = ref('')
const step = ref(1)
const maxStep = ref(1)
const stepError = ref('')
const checkingPeriod = ref(false)
const periodConflict = ref<CollectionSummary | null>(null)
let periodCheckGeneration = 0
const invalidField = computed(() => {
  if (!Array.isArray(saveError.value?.details)) return ''
  const location = saveError.value.details[0]?.loc
  return Array.isArray(location) ? location.slice(1).join('.') : ''
})
const types = ['BANK_STATEMENT', 'SALES_INVOICE', 'PURCHASE_INVOICE', 'RECEIPT', 'PAYMENT_PLATFORM_REPORT', 'LOAN_STATEMENT', 'OTHER']
const steps = [
  { step: 1, title: 'collections.stepDetails', description: 'collections.stepDetailsHint' },
  { step: 2, title: 'collections.stepRequirements', description: 'collections.stepRequirementsHint' },
  { step: 3, title: 'collections.stepReview', description: 'collections.stepReviewHint' },
]

function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function defaultDue(period: string) { return `${period}-25` }
function blankRequirement(): RequirementInput { return { type: 'BANK_STATEMENT', title: '', required: true, criteria: {} } }
const form = reactive({ clientId: '', period: currentMonth(), dueDate: defaultDue(currentMonth()), scopeNote: '', assigneeId: '', version: 1, aiMode: 'AUTO_REVIEW' as AIMode, aiSatisfyThreshold: '0.980', aiRequestActionThreshold: '0.980', requirements: [blankRequirement()] })
const policyValid = computed(() => [form.aiSatisfyThreshold, form.aiRequestActionThreshold].every(value => /^\d(?:\.\d{1,3})?$/.test(String(value)) && Number(value) >= 0.5 && Number(value) <= 1))
const requirementsValid = computed(() => form.requirements.every(requirement => requirement.title.trim()))
const selectedClient = computed(() => clients.value.find(client => client.id === form.clientId)?.legalName ?? '—')
const selectedAssignee = computed(() => assignees.value.find(user => user.id === form.assigneeId)?.name ?? '—')

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function nextPeriod(value: string) {
  const date = new Date(`${value}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 7)
}

function dueForCopy(sourceValue: CollectionDetail, period: string) {
  const day = String(new Date(sourceValue.dueAt).getDate()).padStart(2, '0')
  return `${period}-${day}`
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [clientPage, userPage] = await Promise.all([
      accountsApi.listClients({ page: 1, pageSize: 100, status: 'ACTIVE' }),
      auth.user?.firmRole === 'FIRM_ADMIN'
        ? accountsApi.listUsers({ page: 1, pageSize: 100, status: 'ACTIVE', staffOnly: true })
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 }),
    ])
    clients.value = clientPage.items
    assignees.value = auth.user?.firmRole === 'FIRM_ADMIN' ? userPage.items.filter(user => user.firmRole) : []
    if (!assignees.value.some(user => user.id === auth.user?.id) && auth.user) {
      assignees.value.unshift({ id: auth.user.id, name: auth.user.name, email: auth.user.email, status: 'ACTIVE', firmRole: auth.user.firmRole, clientRoles: [], lastLoginAt: null })
    }
    const copyFrom = typeof route.query.copyFrom === 'string' ? route.query.copyFrom : ''
    if (isEdit.value || copyFrom) {
      source.value = await collectionsApi.get(isEdit.value ? id.value : copyFrom)
      Object.assign(form, { aiMode: source.value.aiMode ?? 'SUGGEST', aiSatisfyThreshold: source.value.aiSatisfyThreshold ?? '0.980', aiRequestActionThreshold: source.value.aiRequestActionThreshold ?? '0.980' })
      if (isEdit.value) {
        Object.assign(form, { clientId: source.value.clientId, period: source.value.period.slice(0, 7), dueDate: source.value.dueAt.slice(0, 10), scopeNote: source.value.scopeNote ?? '', assigneeId: source.value.assigneeId, version: source.value.version, requirements: source.value.requirements.map(({ type, title, required, criteria }) => ({ type, title, required, criteria: structuredClone(toRaw(criteria)) })) })
      } else {
        const period = nextPeriod(source.value.period.slice(0, 7))
        Object.assign(form, { clientId: source.value.clientId, period, dueDate: dueForCopy(source.value, period), scopeNote: source.value.scopeNote ?? '', assigneeId: source.value.assigneeId, requirements: source.value.requirements.filter(item => item.origin === 'INITIAL').map(({ type, title, required, criteria }) => ({ type, title, required, criteria: Object.fromEntries(Object.entries(structuredClone(toRaw(criteria))).filter(([key]) => key !== 'targetTransaction')) })) })
      }
    } else {
      form.clientId = clients.value[0]?.id ?? ''
      form.assigneeId = auth.user?.id ?? ''
    }
  } catch (caught) { error.value = readApiError(caught) }
  finally { loading.value = false }
}

function addRequirement() { form.requirements.push(blankRequirement()) }
function removeRequirement(index: number) { if (form.requirements.length > 1) form.requirements.splice(index, 1) }

async function checkPeriod() {
  const generation = ++periodCheckGeneration
  periodConflict.value = null
  if (isEdit.value || !form.clientId || !form.period) { checkingPeriod.value = false; return false }
  checkingPeriod.value = true
  try {
    const page = await collectionsApi.list({ page: 1, pageSize: 100, clientId: form.clientId, period: `${form.period}-01` })
    if (generation !== periodCheckGeneration) return false
    periodConflict.value = page.items.find(item => item.status !== 'CANCELLED') ?? null
    return Boolean(periodConflict.value)
  } catch { return false }
  finally { if (generation === periodCheckGeneration) checkingPeriod.value = false }
}

async function advance() {
  stepError.value = ''
  if (step.value === 1 && (!form.clientId || !form.period || !form.dueDate || !form.assigneeId || !policyValid.value)) {
    stepError.value = t('collections.completeStep')
    return
  }
  if (step.value === 1 && await checkPeriod()) {
    stepError.value = t('error.codes.COLLECTION_EXISTS')
    return
  }
  if (step.value === 2 && (!form.requirements.length || !requirementsValid.value)) {
    stepError.value = t('collections.completeRequirements')
    return
  }
  maxStep.value = Math.max(maxStep.value, step.value + 1)
  step.value = Math.min(3, step.value + 1)
}

function goBack() {
  stepError.value = ''
  step.value = Math.max(1, step.value - 1)
}

async function save() {
  if (saving.value) return
  if (!form.clientId || !form.period || !form.dueDate || !form.assigneeId || !requirementsValid.value || !policyValid.value) {
    stepError.value = t('collections.completeStep')
    return
  }
  saving.value = true
  saveError.value = null
  try {
    const dueAt = new Date(`${form.dueDate}T23:59:00`).toISOString()
    const policy = { aiMode: form.aiMode, aiSatisfyThreshold: String(form.aiSatisfyThreshold), aiRequestActionThreshold: String(form.aiRequestActionThreshold) }
    let value: CollectionDetail
    if (isEdit.value) {
      value = await collectionsApi.update(id.value, { version: form.version, dueAt, scopeNote: form.scopeNote.trim() || null, assigneeId: form.assigneeId, ...policy })
    } else {
      createKey.value ||= crypto.randomUUID()
      value = await collectionsApi.create({ clientId: form.clientId, period: `${form.period}-01`, dueAt, scopeNote: form.scopeNote.trim() || null, assigneeId: form.assigneeId, ...policy, requirements: form.requirements.map(item => ({ ...item, title: item.title.trim() })) }, createKey.value)
      createKey.value = ''
    }
    await router.replace({ name: 'collection-detail', params: { id: value.id } })
  } catch (caught) { saveError.value = readApiError(caught) }
  finally { saving.value = false }
}

onMounted(load)
watch(step, () => { stepError.value = '' })
watch([() => form.clientId, () => form.period], () => {
  stepError.value = ''
  if (!isEdit.value) { step.value = 1; maxStep.value = 1 }
  checkPeriod()
})
</script>

<template>
  <section class="space-y-7">
    <RouterLink :to="isEdit ? { name: 'collection-detail', params: { id } } : { name: 'collections' }" class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft class="size-4" />{{ t('collections.back') }}</RouterLink>
    <header><h1 class="text-[32px] leading-tight font-semibold tracking-[-0.025em]">{{ t(isEdit ? 'collections.edit' : 'collections.new') }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ t('collections.description') }}</p></header>
    <div v-if="error" class="space-y-3"><ErrorNotice v-bind="error" /><Button variant="outline" @click="load">{{ t('collections.retry') }}</Button></div>
    <p v-else-if="loading" role="status" class="py-10 text-sm text-muted-foreground">{{ t('collections.loading') }}</p>
    <form v-else class="space-y-6" @submit.prevent="save">
      <Stepper v-model="step" linear class="app-panel flex w-full items-start overflow-hidden px-3 py-5 sm:px-6">
        <StepperItem v-for="item in steps" :key="item.step" :step="item.step" :disabled="item.step > maxStep" class="relative flex-1 flex-col gap-2">
          <StepperTrigger class="relative z-10 w-full">
            <StepperIndicator>{{ item.step }}</StepperIndicator>
            <StepperTitle class="text-xs font-medium sm:text-sm">{{ t(item.title) }}</StepperTitle>
            <StepperDescription class="hidden text-xs text-muted-foreground md:block">{{ t(item.description) }}</StepperDescription>
          </StepperTrigger>
          <StepperSeparator v-if="item.step < steps.length" class="absolute top-5 left-[calc(50%+1.5rem)] h-px w-[calc(100%-3rem)]" />
        </StepperItem>
      </Stepper>

      <section v-if="step === 1" class="app-panel overflow-hidden">
        <header class="border-b px-6 py-5"><h2 class="text-base font-semibold">{{ t('collections.requestDetails') }}</h2><p class="mt-1.5 text-sm text-muted-foreground">{{ t('collections.stepDetailsHint') }}</p></header>
        <div class="grid gap-5 p-6 sm:grid-cols-2 xl:grid-cols-4">
          <div class="space-y-2"><Label>{{ t('collections.client') }}</Label><Select v-model="form.clientId" :disabled="isEdit" required><SelectTrigger size="lg" class="w-full bg-card" :aria-label="t('collections.client')"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem v-for="client in clients" :key="client.id" :value="client.id">{{ client.legalName }}</SelectItem></SelectContent></Select></div>
          <div class="space-y-2"><Label>{{ t('collections.period') }}</Label><MonthPicker v-model="form.period" :label="t('collections.period')" :placeholder="t('collections.choosePeriod')" :disabled="isEdit" /></div>
          <div class="space-y-2"><Label>{{ t('collections.dueDate') }}</Label><DatePicker v-model="form.dueDate" :label="t('collections.dueDate')" :placeholder="t('collections.chooseDate')" /></div>
          <div class="space-y-2"><Label>{{ t('collections.assignee') }}</Label><Select v-model="form.assigneeId" required><SelectTrigger size="lg" class="w-full bg-card" :aria-label="t('collections.assignee')"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem v-for="user in assignees" :key="user.id" :value="user.id">{{ user.name }}</SelectItem></SelectContent></Select></div>
          <div v-if="periodConflict" role="alert" class="flex flex-wrap items-center gap-3 rounded-xl border border-amber-600/25 bg-amber-500/[0.08] px-4 py-3 text-sm sm:col-span-2 xl:col-span-4">
            <span class="min-w-0 flex-1">{{ t('error.codes.COLLECTION_EXISTS') }}</span>
            <Button as-child variant="outline" size="sm"><RouterLink :to="{ name: 'collection-detail', params: { id: periodConflict.id } }">{{ t('collections.openExisting') }}</RouterLink></Button>
          </div>
          <div class="space-y-2 sm:col-span-2 xl:col-span-4"><Label for="scope-note">{{ t('collections.scopeNote') }}</Label><textarea id="scope-note" v-model="form.scopeNote" maxlength="4000" :placeholder="t('collections.scopePlaceholder')" class="min-h-24 w-full resize-y rounded-xl border bg-card px-3 py-2 text-sm focus-visible:outline-ring" /></div>
        </div>
      </section>

      <section v-if="step === 1" class="app-panel overflow-hidden">
        <header class="border-b px-6 py-5"><h2 class="text-base font-semibold">{{ t('collections.aiPolicy') }}</h2><p class="mt-1.5 text-sm text-muted-foreground">{{ t('collections.aiPolicyHint') }}</p></header>
        <div class="grid gap-5 p-6 xl:grid-cols-3">
          <div class="space-y-2"><Label>{{ t('collections.aiMode') }}</Label><Select v-model="form.aiMode"><SelectTrigger size="lg" class="w-full" :aria-label="t('collections.aiMode')"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem v-for="mode in ['OFF', 'SUGGEST', 'AUTO_REVIEW']" :key="mode" :value="mode">{{ t(`collections.aiModes.${mode}`) }}</SelectItem></SelectContent></Select></div>
          <div v-for="field in thresholdFields" :key="field.key" class="space-y-2">
            <Label :for="field.key">{{ t(`collections.${field.label}`) }}</Label>
            <Select :model-value="Number(form[field.key]).toFixed(3)" :disabled="form.aiMode !== 'AUTO_REVIEW'" @update:model-value="form[field.key] = String($event)">
              <SelectTrigger :id="field.key" size="lg" class="w-full" :aria-describedby="`${field.key}-hint`"><SelectValue>{{ t(`collections.aiLevels.${aiThresholdLevel(form[field.key])}`) }}</SelectValue></SelectTrigger>
              <SelectContent position="popper">
                <SelectItem v-for="preset in aiThresholdPresets" :key="preset.value" :value="preset.value">{{ t(`collections.aiLevels.${preset.level}`) }}</SelectItem>
                <SelectItem v-if="source?.[field.key] && aiThresholdLevel(source[field.key]) === 'existing'" :value="Number(source[field.key]).toFixed(3)">{{ t('collections.aiLevels.existing') }}</SelectItem>
              </SelectContent>
            </Select>
            <p :id="`${field.key}-hint`" class="text-xs leading-5 text-muted-foreground">{{ t(`collections.aiLevelHints.${aiThresholdLevel(form[field.key])}`) }}</p>
          </div>
          <p v-if="!policyValid" role="alert" class="text-sm text-destructive xl:col-span-3">{{ t('collections.aiThresholdError') }}</p>
        </div>
      </section>

      <section v-else-if="step === 2" class="app-panel overflow-hidden">
        <header class="flex items-center justify-between gap-4 border-b px-6 py-5"><div><h2 class="text-base font-semibold">{{ t('collections.requirements') }}</h2><p class="mt-1.5 text-sm text-muted-foreground">{{ t('collections.stepRequirementsHint') }}</p></div><Button v-if="!isEdit" type="button" variant="outline" size="sm" @click="addRequirement"><Plus class="size-4" />{{ t('collections.addRequirement') }}</Button></header>
        <div class="divide-y">
          <fieldset v-for="(requirement, index) in form.requirements" :key="index" :disabled="isEdit" class="grid items-end gap-4 px-6 py-5 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
            <div class="space-y-2"><Label>{{ t('collections.typeLabel') }}</Label><Select v-model="requirement.type" :disabled="isEdit"><SelectTrigger size="lg" class="w-full bg-card" :aria-label="`${t('collections.typeLabel')} ${index + 1}`"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem v-for="type in types" :key="type" :value="type">{{ t(`collections.types.${type}`) }}</SelectItem></SelectContent></Select></div>
            <div class="space-y-2"><Label :for="`requirement-${index}`">{{ t('collections.titleLabel') }}</Label><Input :id="`requirement-${index}`" v-model="requirement.title" maxlength="200" class="h-10 bg-card" /></div>
            <div class="flex h-10 items-center gap-3"><label class="flex items-center gap-2 whitespace-nowrap text-sm"><input v-model="requirement.required" type="checkbox" class="size-4 accent-primary" />{{ t('collections.required') }}</label><Button v-if="!isEdit && form.requirements.length > 1" type="button" size="icon-sm" variant="ghost" :aria-label="t('collections.removeRequirement')" @click="removeRequirement(index)"><Trash2 class="size-4" /></Button></div>
          </fieldset>
        </div>
      </section>

      <section v-else class="app-panel overflow-hidden">
        <header class="border-b px-6 py-5"><h2 class="text-base font-semibold">{{ t('collections.stepReview') }}</h2><p class="mt-1.5 text-sm text-muted-foreground">{{ t('collections.stepReviewHint') }}</p></header>
        <dl class="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 xl:divide-y-0">
          <div class="px-6 py-5"><dt class="text-xs text-muted-foreground">{{ t('collections.client') }}</dt><dd class="mt-1.5 text-sm font-medium">{{ selectedClient }}</dd></div>
          <div class="px-6 py-5"><dt class="text-xs text-muted-foreground">{{ t('collections.period') }}</dt><dd class="mt-1.5 text-sm font-medium">{{ formatPeriod(form.period) }}</dd></div>
          <div class="px-6 py-5"><dt class="text-xs text-muted-foreground">{{ t('collections.dueDate') }}</dt><dd class="mt-1.5 text-sm font-medium">{{ formatDate(form.dueDate) }}</dd></div>
          <div class="px-6 py-5"><dt class="text-xs text-muted-foreground">{{ t('collections.assignee') }}</dt><dd class="mt-1.5 text-sm font-medium">{{ selectedAssignee }}</dd></div>
        </dl>
        <div class="border-t px-6 py-5"><p class="text-xs text-muted-foreground">{{ t('collections.aiPolicy') }}</p><p class="mt-2 text-sm font-medium">{{ t(`collections.aiModes.${form.aiMode}`) }}</p><p v-if="form.aiMode === 'AUTO_REVIEW'" class="mt-1 text-sm text-muted-foreground">{{ t('collections.aiSatisfyThreshold') }}: {{ t(`collections.aiLevels.${aiThresholdLevel(form.aiSatisfyThreshold)}`) }} · {{ t('collections.aiReturnThreshold') }}: {{ t(`collections.aiLevels.${aiThresholdLevel(form.aiRequestActionThreshold)}`) }}</p><p class="mt-2 text-xs text-muted-foreground">{{ t('collections.aiPolicyHint') }}</p></div>
        <div v-if="form.scopeNote" class="border-t px-6 py-5"><p class="text-xs text-muted-foreground">{{ t('collections.scopeNote') }}</p><p class="mt-2 whitespace-pre-wrap text-sm leading-6">{{ form.scopeNote }}</p></div>
        <div class="border-t"><div v-for="(requirement, index) in form.requirements" :key="index" class="flex items-center gap-4 border-b px-6 py-4 last:border-b-0"><span class="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{{ index + 1 }}</span><div class="min-w-0 flex-1"><p class="text-sm font-medium">{{ requirement.title }}</p><p class="mt-1 text-xs text-muted-foreground">{{ t(`collections.types.${requirement.type}`) }} · {{ t(requirement.required ? 'collections.required' : 'collections.optional') }}</p></div></div></div>
      </section>

      <p v-if="stepError" role="alert" class="text-sm text-destructive">{{ stepError }}</p>
      <div v-if="saveError" class="space-y-2"><ErrorNotice v-bind="saveError" /><p v-if="invalidField" class="text-sm text-destructive">{{ t('collections.invalidField', { field: invalidField }) }}</p></div>
      <div class="flex flex-wrap gap-3">
        <Button v-if="step > 1" type="button" variant="outline" @click="goBack">{{ t('collections.previousStep') }}</Button>
        <Button v-if="step < 3" type="button" :disabled="checkingPeriod" @click="advance">{{ t(checkingPeriod ? 'collections.checkingPeriod' : 'collections.nextStep') }}</Button>
        <Button v-else type="submit" :disabled="saving">{{ t(saving ? 'collections.saving' : isEdit ? 'collections.save' : 'collections.create') }}</Button>
        <Button as-child variant="ghost"><RouterLink :to="{ name: 'collections' }">{{ t('accounts.cancel') }}</RouterLink></Button>
      </div>
    </form>
  </section>
</template>
