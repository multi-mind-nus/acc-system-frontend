<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, GripVertical, RotateCw, Sparkles, Trash2, Upload, X } from '@lucide/vue'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { readApiError } from '@/api/client'
import { portalApi, type PortalCollectionDetail, type PortalDocument, type PortalRequirement } from '@/api/portal'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorNotice from '@/components/ErrorNotice.vue'
import FileTypeIcon from '@/components/FileTypeIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface UploadState { progress: number; busy: boolean; file?: File; error?: ReturnType<typeof readApiError> }
interface SmartCandidate {
  id: string
  file: File
  target: string
  suggestedTarget: string
  confidence: number
}

const INVALID_TARGET = '__invalid__'

const route = useRoute()
const { t, te, locale } = useI18n()
const detail = ref<PortalCollectionDetail | null>(null)
const expanded = ref<string[]>([])
const loading = ref(true)
const busy = ref(false)
const error = ref<ReturnType<typeof readApiError> | null>(null)
const actionError = ref<ReturnType<typeof readApiError> | null>(null)
const validationMessage = ref('')
const confirmSubmit = ref(false)
const uploads = reactive<Record<string, UploadState>>({})
const dragging = ref<string | null>(null)
const smartDragging = ref(false)
const smartUpload = reactive({ busy: false, completed: 0, total: 0, failed: 0 })
const smartDialogOpen = ref(false)
const smartPhase = ref<'confirm' | 'analyzing' | 'results' | 'uploading'>('confirm')
const smartCandidates = ref<SmartCandidate[]>([])
const smartClassificationError = ref<ReturnType<typeof readApiError> | null>(null)
const smartCancelConfirm = ref(false)
const smartDragTarget = ref<string | null>(null)
const draggedCandidateId = ref<string | null>(null)
const timers = new Set<ReturnType<typeof setTimeout>>()
let smartGeneration = 0

const editable = computed(() => detail.value && ['OPEN', 'CHANGES_REQUESTED'].includes(detail.value.status) && detail.value.submission?.status !== 'SUBMITTED')
const required = computed(() => detail.value?.requirements.filter(item => item.required) ?? [])
const readyRequired = computed(() => required.value.filter(item => item.documents.some(document => document.status === 'AVAILABLE')).length)
const progress = computed(() => required.value.length ? Math.round(readyRequired.value / required.value.length * 100) : 100)
const processing = computed(() => detail.value?.requirements.some(item => item.documents.some(document => document.status === 'QUARANTINED')) ?? false)
const missing = computed(() => required.value.filter(item => !item.documents.some(document => document.status === 'AVAILABLE')))
const smartCategories = computed(() => [
  ...(detail.value?.requirements.map(requirement => ({
    target: requirement.id,
    label: requirement.type === 'OTHER' ? t('collections.types.OTHER') : requirement.title,
  })) ?? []),
  { target: INVALID_TARGET, label: t('portal.invalidClassification') },
])
const smartGroups = computed(() => smartCategories.value.map(category => ({
  ...category,
  candidates: smartCandidates.value.filter(candidate => candidate.target === category.target),
})))

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value))
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function criteriaText(requirement: PortalRequirement) {
  return Object.values(requirement.criteria).filter(value => typeof value === 'string').join(' · ')
}

function translatedError(error?: ReturnType<typeof readApiError>) {
  return error?.code && te(`error.codes.${error.code}`) ? t(`error.codes.${error.code}`) : error?.message
}

function failureText(code: string | null) {
  return code && te(`portal.failure.${code}`) ? t(`portal.failure.${code}`) : t('portal.failure.UNKNOWN')
}

function replaceDocument(document: PortalDocument) {
  for (const requirement of detail.value?.requirements ?? []) {
    const index = requirement.documents.findIndex(item => item.linkId === document.linkId)
    if (index >= 0) requirement.documents[index] = document
  }
}

function poll(document: PortalDocument, attempts = 0) {
  if (document.status !== 'QUARANTINED' || attempts >= 40) return
  const timer = setTimeout(async () => {
    timers.delete(timer)
    try {
      const current = await portalApi.document(document.linkId)
      replaceDocument(current)
      poll(current, attempts + 1)
    } catch (caught) { actionError.value = readApiError(caught) }
  }, 1500)
  timers.add(timer)
}

async function load() {
  loading.value = true
  error.value = null
  try {
    detail.value = await portalApi.get(String(route.params.id))
    expanded.value = detail.value.requirements[0] ? [detail.value.requirements[0].id] : []
    detail.value.requirements.flatMap(item => item.documents).forEach(document => poll(document))
  } catch (caught) { error.value = readApiError(caught) }
  finally { loading.value = false }
}

async function upload(requirement: PortalRequirement, file: File) {
  const state: UploadState = uploads[requirement.id] = { progress: 0, busy: true, file }
  actionError.value = null
  validationMessage.value = ''
  try {
    const result = await portalApi.upload(
      String(route.params.id), requirement.type === 'OTHER' ? null : requirement.id, file,
      event => { state.progress = event.total ? Math.round(event.loaded / event.total * 100) : 0 },
    )
    const existing = requirement.documents.findIndex(item => item.linkId === result.document.linkId)
    if (existing >= 0) requirement.documents[existing] = result.document
    else requirement.documents.push(result.document)
    poll(result.document)
    return true
  } catch (caught) { state.error = readApiError(caught) }
  finally { state.busy = false }
  return false
}

async function uploadFiles(requirement: PortalRequirement, files: File[]) {
  for (const file of files) await upload(requirement, file)
}

function chooseFiles(requirement: PortalRequirement, event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (files.length) uploadFiles(requirement, files)
}

function dropFiles(requirement: PortalRequirement, event: DragEvent) {
  dragging.value = null
  const files = [...(event.dataTransfer?.files ?? [])]
  if (files.length) uploadFiles(requirement, files)
}

function leaveDropZone(id: string, event: DragEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null) && dragging.value === id) dragging.value = null
}

function leaveSmartDropZone(event: DragEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) smartDragging.value = false
}

function prepareSmartUpload(files: File[]) {
  if (!detail.value || !files.length || smartUpload.busy) return
  smartGeneration += 1
  smartCandidates.value = files.map((file, index) => ({
    id: `${index}-${file.name}-${file.size}-${file.lastModified}`,
    file,
    target: '',
    suggestedTarget: '',
    confidence: 0,
  }))
  smartDialogOpen.value = true
  smartPhase.value = 'confirm'
  smartClassificationError.value = null
  smartUpload.completed = 0
  smartUpload.total = 0
  smartUpload.failed = 0
  actionError.value = null
}

async function startSmartAnalysis() {
  if (!detail.value || smartPhase.value !== 'confirm') return
  const generation = smartGeneration
  smartPhase.value = 'analyzing'
  smartClassificationError.value = null
  try {
    const result = await portalApi.classify(String(route.params.id), smartCandidates.value.map(candidate => candidate.file))
    if (generation !== smartGeneration) return
    const fallback = detail.value.requirements.find(item => item.type === 'OTHER')
    for (const candidate of smartCandidates.value) {
      candidate.target = INVALID_TARGET
      candidate.suggestedTarget = INVALID_TARGET
      candidate.confidence = 0
    }
    for (const item of result.items) {
      const candidate = smartCandidates.value[item.index]
      const requirement = detail.value.requirements.find(value => value.id === item.requirementId)
      if (!candidate) continue
      candidate.confidence = item.confidence
      candidate.target = item.category === 'REQUIREMENT' && requirement
        ? requirement.id
        : item.category === 'OTHER' && fallback ? fallback.id : INVALID_TARGET
      candidate.suggestedTarget = candidate.target
    }
    smartPhase.value = 'results'
  } catch (caught) {
    if (generation === smartGeneration) {
      smartClassificationError.value = readApiError(caught)
      smartPhase.value = 'confirm'
    }
  }
}

function requestSmartClose(open: boolean) {
  if (open || smartPhase.value === 'uploading') return
  smartCancelConfirm.value = true
}

function discardSmartUpload() {
  smartGeneration += 1
  smartDialogOpen.value = false
  smartCancelConfirm.value = false
  smartPhase.value = 'confirm'
  smartCandidates.value = []
  smartClassificationError.value = null
  smartDragTarget.value = null
  draggedCandidateId.value = null
}

function removeSmartCandidate(candidateId: string) {
  smartCandidates.value = smartCandidates.value.filter(candidate => candidate.id !== candidateId)
}

function startSmartDrag(candidate: SmartCandidate, event: DragEvent) {
  draggedCandidateId.value = candidate.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', candidate.id)
  }
}

function moveSmartCandidate(candidateId: string, target: string) {
  const candidate = smartCandidates.value.find(item => item.id === candidateId)
  if (candidate) candidate.target = target
}

function dropSmartCandidate(target: string, event: DragEvent) {
  const candidateId = event.dataTransfer?.getData('text/plain') || draggedCandidateId.value
  if (candidateId) moveSmartCandidate(candidateId, target)
  smartDragTarget.value = null
  draggedCandidateId.value = null
}

async function confirmSmartUpload() {
  if (!detail.value || smartPhase.value !== 'results') return
  const selected = smartCandidates.value.filter(candidate => candidate.target !== INVALID_TARGET)
  smartPhase.value = 'uploading'
  smartUpload.busy = true
  smartUpload.completed = 0
  smartUpload.total = selected.length
  smartUpload.failed = 0
  try {
    for (const candidate of selected) {
      const requirement = detail.value.requirements.find(item => item.id === candidate.target)
      if (!requirement || !await upload(requirement, candidate.file)) smartUpload.failed += 1
      else if (!expanded.value.includes(requirement.id)) expanded.value.push(requirement.id)
      smartUpload.completed += 1
    }
  } finally {
    smartUpload.busy = false
    smartDialogOpen.value = false
    smartPhase.value = 'confirm'
    smartCandidates.value = []
  }
}

function chooseSmartFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  prepareSmartUpload(files)
}

function dropSmartFiles(event: DragEvent) {
  smartDragging.value = false
  prepareSmartUpload([...(event.dataTransfer?.files ?? [])])
}

async function exclude(document: PortalDocument) {
  actionError.value = null
  try { replaceDocument(await portalApi.exclude(document.linkId)) }
  catch (caught) { actionError.value = readApiError(caught) }
}

async function download(document: PortalDocument) {
  actionError.value = null
  try {
    const url = URL.createObjectURL(await portalApi.download(document.linkId))
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = document.name
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (caught) { actionError.value = readApiError(caught) }
}

function askSubmit() {
  validationMessage.value = processing.value
    ? t('portal.processingHint')
    : missing.value.length ? t('portal.missingHint', { count: missing.value.length }) : ''
  if (!validationMessage.value) confirmSubmit.value = true
}

async function submit() {
  busy.value = true
  actionError.value = null
  try {
    detail.value = await portalApi.submit(String(route.params.id))
    confirmSubmit.value = false
  } catch (caught) { actionError.value = readApiError(caught) }
  finally { busy.value = false }
}

onMounted(load)
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <section class="space-y-7">
    <RouterLink :to="{ name: 'portal-collections' }" class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft class="size-4" />{{ t('portal.back') }}</RouterLink>

    <div v-if="error" class="space-y-3"><ErrorNotice v-bind="error" /><Button variant="outline" @click="load">{{ t('portal.retry') }}</Button></div>
    <p v-else-if="loading" role="status" class="text-sm text-muted-foreground">{{ t('portal.loading') }}</p>
    <template v-else-if="detail">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div><p class="text-sm text-muted-foreground">{{ detail.clientName }}</p><h1 class="mt-1 text-[32px] leading-tight font-semibold tracking-[-0.025em]">{{ formatPeriod(detail.period) }}</h1></div>
        <StatusBadge :status="detail.status" translation-prefix="collections.status" />
      </header>

      <section class="app-panel overflow-hidden">
        <div class="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div class="px-5 py-5 sm:px-6"><p class="text-xs text-muted-foreground">{{ t('portal.dueLabel') }}</p><p class="mt-1.5 text-sm font-medium">{{ formatDate(detail.dueAt) }}</p></div>
          <div class="px-5 py-5 sm:px-6"><p class="text-xs text-muted-foreground">{{ t('portal.contact') }}</p><p class="mt-1.5 text-sm font-medium">{{ detail.assigneeName }}</p></div>
          <div class="px-5 py-5 sm:px-6"><div class="flex justify-between text-xs"><span class="text-muted-foreground">{{ t('portal.progress') }}</span><span class="font-medium">{{ readyRequired }}/{{ required.length }}</span></div><Progress :model-value="progress" class="mt-3 h-1.5" /></div>
        </div>
        <div v-if="detail.scopeNote" class="border-t px-5 py-5 text-sm leading-6 text-muted-foreground sm:px-6"><p class="mb-1 text-xs font-medium text-foreground">{{ t('portal.instructions') }}</p>{{ detail.scopeNote }}</div>
      </section>

      <div v-if="actionError" class="space-y-3"><ErrorNotice v-bind="actionError" /><Button variant="ghost" size="sm" @click="actionError = null">{{ t('portal.dismiss') }}</Button></div>

      <section class="app-panel overflow-hidden" aria-labelledby="requirements-title">
        <header class="border-b px-5 py-5 sm:px-7"><h2 id="requirements-title" class="text-base font-semibold">{{ t('portal.requirements') }}</h2><p class="mt-1.5 text-sm text-muted-foreground">{{ t('portal.requirementsHint') }}</p></header>
        <div v-if="editable" class="border-b px-5 py-5 sm:px-7">
          <label
            class="flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border border-dashed px-5 py-4 transition-colors focus-within:ring-3 focus-within:ring-ring/50"
            :class="smartDragging ? 'border-primary bg-accent/60' : 'hover:bg-muted/40'"
            @dragenter.prevent="smartDragging = true"
            @dragover.prevent="smartDragging = true"
            @dragleave.prevent="leaveSmartDropZone"
            @drop.prevent="dropSmartFiles"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Sparkles class="size-4" /></span>
            <span class="min-w-0 flex-1"><span class="block text-sm font-semibold">{{ t('portal.smartUpload') }}</span><span class="mt-1 block text-xs leading-5 text-muted-foreground">{{ smartDragging ? t('portal.dropNow') : t('portal.smartUploadHint') }}</span></span>
            <span class="hidden text-xs font-medium text-primary sm:block">{{ t('portal.chooseFiles') }}</span>
            <input class="sr-only" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" :disabled="smartUpload.busy" @change="chooseSmartFiles">
          </label>
          <div v-if="smartUpload.total" class="mt-3" role="status">
            <div class="mb-2 flex justify-between text-xs text-muted-foreground"><span>{{ smartUpload.busy ? t('portal.smartUploading') : smartUpload.failed ? t('portal.smartUploadPartial', { count: smartUpload.failed }) : t('portal.smartUploadComplete') }}</span><span>{{ smartUpload.completed }}/{{ smartUpload.total }}</span></div>
            <Progress :model-value="smartUpload.completed / smartUpload.total * 100" class="h-1.5" />
          </div>
        </div>
        <Accordion v-model="expanded" type="multiple">
          <AccordionItem v-for="requirement in detail.requirements" :key="requirement.id" :value="requirement.id" class="px-5 sm:px-7">
            <AccordionTrigger class="py-5 hover:no-underline">
              <span class="flex min-w-0 items-start gap-3 pr-3">
                <span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full" :class="requirement.documents.some(document => document.status === 'AVAILABLE') ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'"><CheckCircle2 v-if="requirement.documents.some(document => document.status === 'AVAILABLE')" class="size-4" /><FileText v-else class="size-4" /></span>
                <span class="min-w-0"><span class="block font-medium">{{ requirement.title }}</span><span class="mt-1 block text-xs font-normal text-muted-foreground">{{ requirement.required ? t('portal.required') : t('portal.optional') }} · {{ t(`collections.types.${requirement.type}`) }}</span></span>
              </span>
            </AccordionTrigger>
            <AccordionContent class="pb-6 pl-11">
              <p v-if="criteriaText(requirement)" class="mb-4 text-sm leading-6 text-muted-foreground">{{ criteriaText(requirement) }}</p>
              <div v-if="requirement.clientMessage" class="mb-4 rounded-xl border border-amber-700/20 bg-amber-500/10 px-4 py-3 text-sm"><p class="font-medium">{{ t('portal.reviewNote') }}</p><p class="mt-1 text-muted-foreground">{{ requirement.clientMessage }}</p></div>

              <div v-if="requirement.documents.length" class="mb-4 space-y-2">
                <div v-for="document in requirement.documents" :key="document.linkId" class="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3 shadow-sm">
                  <FileTypeIcon :name="document.name" :content-type="document.contentType" />
                  <div class="min-w-32 flex-1"><p class="truncate text-sm font-medium" :title="document.name">{{ document.name }}</p><p class="mt-0.5 text-xs text-muted-foreground">{{ formatSize(document.sizeBytes) }}<span v-if="document.duplicate"> · {{ t('portal.reused') }}</span><span v-if="document.status === 'FAILED'"> · {{ failureText(document.failureCode) }}</span></p></div>
                  <StatusBadge :status="document.status" translation-prefix="portal.documentStatus" />
                  <Button v-if="document.status === 'AVAILABLE'" variant="ghost" size="icon-sm" :aria-label="t('portal.download')" @click="download(document)"><Download class="size-4" /></Button>
                  <Button v-if="editable && document.status !== 'EXCLUDED'" variant="ghost" size="icon-sm" :aria-label="t('portal.exclude')" @click="exclude(document)"><Trash2 class="size-4" /></Button>
                </div>
              </div>

              <div v-if="editable" class="space-y-3">
                <label
                  class="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center text-sm font-medium transition-colors focus-within:ring-3 focus-within:ring-ring/50"
                  :class="dragging === requirement.id ? 'border-primary bg-accent/60' : 'hover:bg-muted/40'"
                  @dragenter.prevent="dragging = requirement.id"
                  @dragover.prevent="dragging = requirement.id"
                  @dragleave.prevent="leaveDropZone(requirement.id, $event)"
                  @drop.prevent="dropFiles(requirement, $event)"
                >
                  <Upload class="size-4" />{{ dragging === requirement.id ? t('portal.dropNow') : t('portal.chooseOrDrop') }}
                  <input class="sr-only" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" :disabled="uploads[requirement.id]?.busy" @change="chooseFiles(requirement, $event)">
                </label>
                <div v-if="uploads[requirement.id]?.busy" role="status"><div class="mb-2 flex justify-between text-xs text-muted-foreground"><span>{{ t('portal.uploading') }}</span><span>{{ uploads[requirement.id]?.progress }}%</span></div><Progress :model-value="uploads[requirement.id]?.progress ?? 0" class="h-1.5" /></div>
                <div v-if="uploads[requirement.id]?.error" class="flex flex-wrap items-center gap-2 text-sm text-destructive"><AlertCircle class="size-4" /><span class="flex-1">{{ translatedError(uploads[requirement.id]?.error) }}</span><Button variant="outline" size="sm" @click="uploads[requirement.id]?.file && upload(requirement, uploads[requirement.id]!.file!)"><RotateCw class="size-4" />{{ t('portal.retry') }}</Button></div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section class="app-panel flex flex-wrap items-center gap-4 px-5 py-4">
        <div class="min-w-0 flex-1"><p class="text-sm font-medium">{{ editable ? t('portal.submitTitle') : t('portal.submittedTitle') }}</p><p class="mt-1 text-xs text-muted-foreground">{{ editable ? t('portal.submitHint') : t('portal.submittedHint') }}</p><p v-if="validationMessage" class="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{{ validationMessage }}</p></div>
        <Button v-if="editable" class="h-10" @click="askSubmit">{{ t('portal.submit') }}</Button>
        <span v-else class="inline-flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 class="size-4" />{{ t('portal.readOnly') }}</span>
      </section>

      <DialogRoot :open="smartDialogOpen" @update:open="requestSmartClose">
        <DialogPortal>
          <DialogOverlay class="fixed inset-0 z-50 bg-black/45" />
          <DialogContent class="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl" @escape-key-down="smartPhase === 'uploading' && $event.preventDefault()">
            <header class="relative border-b px-6 py-5 pr-14">
              <DialogTitle class="text-lg font-semibold">{{ t(`portal.smartPhase.${smartPhase}.title`) }}</DialogTitle>
              <DialogDescription class="mt-1.5 text-sm leading-6 text-muted-foreground">{{ t(`portal.smartPhase.${smartPhase}.hint`) }}</DialogDescription>
              <Button type="button" variant="ghost" size="icon-sm" class="absolute top-5 right-5" :disabled="smartPhase === 'uploading'" :aria-label="t('portal.cancelSmartUpload')" @click="requestSmartClose(false)"><X class="size-4" /></Button>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto p-6">
              <template v-if="smartPhase === 'confirm'">
                <ErrorNotice v-if="smartClassificationError" v-bind="smartClassificationError" class="mb-4" />
                <div class="divide-y rounded-xl border">
                  <div v-for="candidate in smartCandidates" :key="candidate.id" class="flex items-center gap-3 px-4 py-3">
                    <FileTypeIcon :name="candidate.file.name" :content-type="candidate.file.type" />
                    <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium" :title="candidate.file.name">{{ candidate.file.name }}</p><p class="mt-0.5 text-xs text-muted-foreground">{{ formatSize(candidate.file.size) }}</p></div>
                    <Button type="button" variant="ghost" size="icon-sm" :aria-label="t('portal.removeSelectedFile')" @click="removeSmartCandidate(candidate.id)"><Trash2 class="size-4" /></Button>
                  </div>
                </div>
              </template>

              <div v-else-if="smartPhase === 'analyzing'" role="status" class="grid min-h-80 place-items-center text-center">
                <div>
                  <span class="relative mx-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground"><span class="absolute inset-0 animate-ping rounded-full bg-primary/25" /><Sparkles class="relative size-6 animate-pulse" /></span>
                  <p class="mt-5 font-medium">{{ t('portal.analyzing') }}</p>
                  <p class="mt-1.5 text-sm text-muted-foreground">{{ t('portal.analyzingHint', { count: smartCandidates.length }) }}</p>
                </div>
              </div>

              <template v-else-if="smartPhase === 'results'">
                <p class="mb-4 text-sm text-muted-foreground">{{ t('portal.dragClassificationHint') }}</p>
                <div class="grid items-start gap-4 lg:grid-cols-2">
                  <section
                    v-for="group in smartGroups"
                    :key="group.target"
                    class="rounded-xl border transition-colors"
                    :class="[
                      group.target === INVALID_TARGET ? 'border-destructive/30' : '',
                      smartDragTarget === group.target ? 'border-primary bg-accent/40' : '',
                    ]"
                    @dragenter.prevent="smartDragTarget = group.target"
                    @dragover.prevent="smartDragTarget = group.target"
                    @dragleave.prevent="smartDragTarget === group.target && (smartDragTarget = null)"
                    @drop.prevent="dropSmartCandidate(group.target, $event)"
                  >
                    <header class="flex items-center justify-between border-b px-4 py-3"><h3 class="text-sm font-semibold">{{ group.label }}</h3><span class="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{{ group.candidates.length }}</span></header>
                    <div class="min-h-24 space-y-2 p-3">
                      <p v-if="!group.candidates.length" class="grid min-h-16 place-items-center text-xs text-muted-foreground">{{ t('portal.dropCategoryHere') }}</p>
                      <article
                        v-for="candidate in group.candidates"
                        :key="candidate.id"
                        :draggable="true"
                        class="cursor-grab rounded-xl border bg-background p-3 shadow-sm active:cursor-grabbing"
                        @dragstart="startSmartDrag(candidate, $event)"
                        @dragend="smartDragTarget = null; draggedCandidateId = null"
                      >
                        <div class="flex items-start gap-2">
                          <GripVertical class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <FileTypeIcon :name="candidate.file.name" :content-type="candidate.file.type" />
                          <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium" :title="candidate.file.name">{{ candidate.file.name }}</p><p class="mt-1 text-xs text-muted-foreground">{{ formatSize(candidate.file.size) }} · {{ candidate.target === candidate.suggestedTarget ? t('portal.aiConfidence', { confidence: Math.round(candidate.confidence * 100) }) : t('portal.manuallyAdjusted') }}</p></div>
                        </div>
                      </article>
                    </div>
                  </section>
                </div>
              </template>

              <div v-else role="status" class="grid min-h-64 place-items-center">
                <div class="w-full max-w-sm text-center"><p class="font-medium">{{ t('portal.smartUploading') }}</p><div class="mt-4 flex justify-between text-xs text-muted-foreground"><span>{{ t('portal.uploadProgress') }}</span><span>{{ smartUpload.completed }}/{{ smartUpload.total }}</span></div><Progress :model-value="smartUpload.total ? smartUpload.completed / smartUpload.total * 100 : 0" class="mt-2 h-1.5" /></div>
              </div>
            </div>

            <footer class="flex justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" :disabled="smartPhase === 'uploading'" @click="requestSmartClose(false)">{{ t('portal.cancelSmartUpload') }}</Button>
              <Button v-if="smartPhase === 'confirm'" type="button" :disabled="!smartCandidates.length" @click="startSmartAnalysis"><Sparkles class="size-4" />{{ t('portal.startAnalysis') }}</Button>
              <Button v-else-if="smartPhase === 'analyzing'" type="button" disabled>{{ t('portal.analyzing') }}</Button>
              <Button v-else-if="smartPhase === 'results'" type="button" @click="confirmSmartUpload">{{ t('portal.confirmSmartUpload') }}</Button>
              <Button v-else type="button" disabled>{{ t('portal.smartUploading') }}</Button>
            </footer>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>

      <ConfirmDialog
        :open="smartCancelConfirm"
        :title="t('portal.cancelConfirmTitle')"
        :description="t('portal.cancelConfirmHint')"
        :confirm-label="t('portal.confirmCancel')"
        :cancel-label="t('portal.keepProcessing')"
        @update:open="smartCancelConfirm = $event"
        @confirm="discardSmartUpload"
      />

      <ConfirmDialog v-model:open="confirmSubmit" :title="t('portal.confirmTitle')" :description="t('portal.confirmHint')" :busy="busy" @confirm="submit" />
    </template>
  </section>
</template>
