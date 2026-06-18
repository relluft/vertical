import { ArrowRight, CheckCircle2, FileStack, Loader2, Paperclip, Ruler, ScrollText, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { Button, Eyebrow, Panel, StatusPill, fieldStyles } from '../components/ui'
import { getDemoSourceOptions } from '../data/demoData'
import { useDemo } from '../context/DemoContext'
import { caseStagePath, draftPath, runPath } from '../lib/routes'
import { getBranchLabel, getWorkflowStage, getWorkflowStages } from '../lib/workflow'
import type { DemoDocumentType, DemoPageKey } from '../types/demo'

const nextStageMap = {
  kp: {
    need: 'editor',
  },
  tz: {
    source: 'need',
    need: 'comments',
    comments: 'run',
  },
} as const

const supportedInputExtensions = ['doc', 'docx', 'pdf', 'xls', 'xlsx'] as const
const workingTableLoadingMs = 10_000

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`
}

function resolvePageKey(branch: DemoDocumentType, stageId: string): DemoPageKey {
  if (branch === 'kp') {
    if (stageId === 'need') return 'kp-need'
    if (stageId === 'materials') return 'kp-materials'
    return 'kp-comments'
  }

  if (stageId === 'source') return 'tz-source'
  if (stageId === 'need') return 'tz-need'
  return 'tz-comments'
}

function DemoVariantButton({
  onClick,
  className = '',
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${className}`}
      onClick={onClick}
    >
      Демо
    </Button>
  )
}

function StageActions({
  onDemo,
  onNext,
  onGenerate,
}: {
  onDemo: () => void
  onNext: () => void
  onGenerate: () => void
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <DemoVariantButton onClick={onDemo} />
      <Button variant="secondary" onClick={onNext}>
        Далее
        <ArrowRight size={16} />
      </Button>
      <Button onClick={onGenerate}>
        Запустить сборку
        <ArrowRight size={16} />
      </Button>
    </div>
  )
}

export function CasePage() {
  const navigate = useNavigate()
  const kpNeedTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const workingTableTimerRef = useRef<number | null>(null)
  const workingTableProgressTimerRef = useRef<number | null>(null)
  const workingTableStartedAtRef = useRef<number | null>(null)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isWorkingTableLoading, setIsWorkingTableLoading] = useState(false)
  const [workingTableProgress, setWorkingTableProgress] = useState(0)
  const { branch, caseId, stageId } = useParams()
  const {
    state: { cases, draft, selectedSourceKpId, demoAppliedByPage },
    applyDemoVariant,
    markStageComplete,
    selectSourceKp,
    updateField,
    updateMeasurement,
    updateRequestSummary,
    updateStageNotes,
  } = useDemo()

  const isValidBranch = branch === 'kp' || branch === 'tz'
  const activeBranch = (isValidBranch ? branch : 'kp') as DemoDocumentType
  const allowedStages = getWorkflowStages(activeBranch).map((stage) => stage.id)
  const isValidStage =
    !!stageId &&
    allowedStages.includes(stageId as never) &&
    stageId !== 'run' &&
    stageId !== 'editor' &&
    stageId !== 'export'
  const safeStageId = isValidStage ? stageId : activeBranch === 'kp' ? 'need' : 'source'
  const demoCase =
    cases.find((item) => item.id === caseId) ?? cases.find((item) => item.isAnchor) ?? cases[0]
  const pageKey = resolvePageKey(activeBranch, safeStageId)
  const hasDemoVariant = !!demoAppliedByPage[pageKey]
  const currentStage = getWorkflowStage(activeBranch, safeStageId as never)
  const nextStage =
    activeBranch === 'kp'
      ? nextStageMap.kp.need
      : nextStageMap.tz[safeStageId as keyof typeof nextStageMap.tz]
  const sourceOptions = hasDemoVariant ? getDemoSourceOptions() : []
  const selectedSource = sourceOptions.find((item) => item.id === selectedSourceKpId) ?? null

  useEffect(() => {
    if (
      !isValidBranch ||
      !isValidStage ||
      !kpNeedTextareaRef.current ||
      activeBranch !== 'kp' ||
      safeStageId !== 'need' ||
      !demoCase
    ) {
      return
    }

    const textarea = kpNeedTextareaRef.current
    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [activeBranch, demoCase, isValidBranch, isValidStage, safeStageId])

  useEffect(() => {
    return () => {
      if (workingTableTimerRef.current) {
        window.clearTimeout(workingTableTimerRef.current)
      }
      if (workingTableProgressTimerRef.current) {
        window.clearInterval(workingTableProgressTimerRef.current)
      }
    }
  }, [])

  if (!isValidBranch) {
    return <Navigate to="/workspace" replace />
  }

  if (!isValidStage) {
    return (
      <Navigate
        to={
          caseStagePath(
            activeBranch,
            caseId ?? '',
            safeStageId as Extract<ReturnType<typeof getWorkflowStages>[number]['id'], 'source' | 'need' | 'materials' | 'comments'>,
          )
        }
        replace
      />
    )
  }

  if (!demoCase) {
    return <Navigate to="/workspace" replace />
  }

  function completeCurrentStage() {
    flushSync(() => {
      markStageComplete(activeBranch, safeStageId as never)
    })
  }

  function clearWorkingTableTimers() {
    if (workingTableTimerRef.current) {
      window.clearTimeout(workingTableTimerRef.current)
      workingTableTimerRef.current = null
    }

    if (workingTableProgressTimerRef.current) {
      window.clearInterval(workingTableProgressTimerRef.current)
      workingTableProgressTimerRef.current = null
    }

    workingTableStartedAtRef.current = null
  }

  function moveToWorkingTable() {
    if (isWorkingTableLoading) {
      return
    }

    completeCurrentStage()
    applyDemoVariant('kp-draft')
    setIsWorkingTableLoading(true)
    setWorkingTableProgress(0.02)
    workingTableStartedAtRef.current = Date.now()

    workingTableProgressTimerRef.current = window.setInterval(() => {
      const startedAt = workingTableStartedAtRef.current ?? Date.now()
      const elapsed = Date.now() - startedAt
      setWorkingTableProgress(Math.min(elapsed / workingTableLoadingMs, 0.99))
    }, 120)

    workingTableTimerRef.current = window.setTimeout(() => {
      clearWorkingTableTimers()
      setWorkingTableProgress(1)
      navigate(draftPath('kp', demoCase.draftId))
    }, workingTableLoadingMs)
  }

  function openWorkingTableNow() {
    clearWorkingTableTimers()
    setWorkingTableProgress(1)
    setIsWorkingTableLoading(false)
    navigate(draftPath('kp', demoCase.draftId))
  }

  function cancelWorkingTableLoading() {
    clearWorkingTableTimers()
    setIsWorkingTableLoading(false)
    setWorkingTableProgress(0)
  }

  function moveToNext() {
    if (activeBranch === 'kp') {
      moveToWorkingTable()
      return
    }

    completeCurrentStage()

    if (nextStage === 'run') {
      navigate(runPath(activeBranch, demoCase.runId))
      return
    }

    navigate(caseStagePath(activeBranch, demoCase.id, nextStage as 'source' | 'need' | 'materials' | 'comments'))
  }

  function moveToGeneration() {
    completeCurrentStage()
    navigate(runPath(activeBranch, demoCase.runId))
  }

  function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0] ?? null

    if (!file) {
      return
    }

    const extension = getFileExtension(file.name)

    if (!supportedInputExtensions.includes(extension as (typeof supportedInputExtensions)[number])) {
      setAttachedFile(null)
      setFileError('Формат не поддерживается. Прикрепите Word, PDF или Excel')
      return
    }

    setAttachedFile(file)
    setFileError(null)
  }

  function clearAttachedFile() {
    setAttachedFile(null)
    setFileError(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <PageTransition className="space-y-6">
      {activeBranch === 'kp' && safeStageId === 'need' ? (
        <section>
          <Panel tone="highlight" className="rounded-[34px] p-6 md:p-8">
            <Eyebrow>
              {getBranchLabel(activeBranch)} / {currentStage.label}
            </Eyebrow>
            <div className="mt-5">
              <div className="display-section-title text-3xl text-[var(--ink-950)] md:text-[2.2rem]">
                Потребность
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ink-800)]">
                Опишите, что нужно закупить, или прикрепите файл. Текст и файл можно использовать
                вместе как входные данные для рабочей таблицы КП.
              </p>
            </div>
            <label className="mt-5 block">
              <textarea
                ref={kpNeedTextareaRef}
                value={demoCase.kpRequestSummary}
                onChange={(event) => updateRequestSummary('kp', event.target.value)}
                rows={9}
                placeholder="Опишите, что нужно закупить, или прикрепите файл"
                className={`w-full resize-none overflow-hidden rounded-[28px] px-5 py-5 text-base leading-8 ${fieldStyles}`}
              />
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".doc,.docx,.pdf,.xls,.xlsx"
              className="hidden"
              onChange={(event) => handleFileChange(event.target.files)}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={16} />
                Прикрепить файл
              </Button>
              <div className="text-sm text-[var(--ink-700)]">Поддерживаются Word, PDF и Excel</div>
            </div>

            {attachedFile ? (
              <div className="surface-note mt-4 flex flex-col gap-3 rounded-[24px] p-4 text-sm leading-7 text-[var(--ink-800)] md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <FileStack size={18} className="mt-1 text-[var(--brand-700)]" />
                  <div>
                    <div className="font-semibold text-[var(--ink-950)]">
                      {attachedFile.name} — загружен
                    </div>
                    <div>
                      {getFileExtension(attachedFile.name).toUpperCase()} · {formatFileSize(attachedFile.size)}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" onClick={clearAttachedFile}>
                  <X size={15} />
                  Удалить файл
                </Button>
              </div>
            ) : null}

            {fileError ? (
              <div className="mt-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {fileError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <DemoVariantButton onClick={() => applyDemoVariant(pageKey)} />
              <Button onClick={moveToWorkingTable} disabled={isWorkingTableLoading}>
                Сформировать рабочую таблицу
                <ArrowRight size={16} />
              </Button>
            </div>
          </Panel>
        </section>
      ) : null}

      {isWorkingTableLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="modal-backdrop absolute inset-0" />
          <div className="frosted panel-outline relative w-full max-w-[520px] rounded-[28px] p-5 text-[var(--ink-800)] shadow-[0_24px_80px_rgba(0,0,0,0.16)] md:p-6">
            <button
              type="button"
              onClick={cancelWorkingTableLoading}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-soft)] bg-white text-[var(--ink-700)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink-950)]"
              aria-label="Отменить загрузку"
            >
              <X size={16} />
            </button>

            <div className="flex items-start gap-4 pr-10">
              <div className="accent-icon-block flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                <Loader2 size={22} className="animate-spin" />
              </div>
              <div>
                <Eyebrow>Фоновая обработка</Eyebrow>
                <h2 className="display-section-title mt-4 text-2xl text-[var(--ink-950)]">
                  Формируем рабочую таблицу
                </h2>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-800)]">
                  Распознаем потребность, подбираем позиции и готовим строки для проверки менеджером.
                </p>
              </div>
            </div>

            <div className="mt-6 h-2 overflow-hidden rounded-full border border-[var(--border-soft)] bg-white">
              <div
                className="h-full rounded-full bg-[var(--ink-950)] transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(2, Math.round(workingTableProgress * 100))}%` }}
              />
            </div>
            <div className="mt-2 text-right text-xs font-semibold text-[var(--ink-700)]">
              {Math.round(workingTableProgress * 100)}%
            </div>

            <div className="mt-5 grid gap-2 text-sm text-[var(--ink-800)]">
              {['Разбираем входные данные', 'Сверяем товары и цены', 'Собираем рабочую таблицу'].map(
                (item, index) => {
                  const stepStart = index / 3
                  const stepEnd = (index + 1) / 3
                  const isComplete = workingTableProgress >= stepEnd
                  const isActive = !isComplete && workingTableProgress >= stepStart

                  return (
                    <div
                      key={item}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                        isActive || isComplete
                          ? 'border-[var(--border-strong)] bg-white text-[var(--ink-950)]'
                          : 'border-[var(--border-soft)] bg-white text-[var(--ink-700)]'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 size={15} className="text-[var(--ink-950)]" />
                      ) : isActive ? (
                        <Loader2 size={15} className="animate-spin text-[var(--ink-950)]" />
                      ) : (
                        <span className="h-[15px] w-[15px] rounded-full border border-[var(--border-strong)]" />
                      )}
                      <span>{item}</span>
                    </div>
                  )
                },
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={cancelWorkingTableLoading}>
                Отменить
              </Button>
              <Button onClick={openWorkingTableNow}>
                Открыть сейчас
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {activeBranch === 'tz' && safeStageId === 'source' ? (
        <section>
          <Panel className="rounded-[34px] p-6">
            <Eyebrow>
              {getBranchLabel(activeBranch)} / {currentStage.label}
            </Eyebrow>
            <div className="mt-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="display-section-title text-3xl text-[var(--ink-950)]">
                  Основа из КП
                </h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-800)]">
                  Выберите исходную основу для технической ветки в более премиальной панели
                  отбора.
                </p>
              </div>
              <DemoVariantButton onClick={() => applyDemoVariant(pageKey)} />
            </div>

            {sourceOptions.length ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {sourceOptions.map((item) => {
                  const isSelected = selectedSourceKpId === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => selectSourceKp(item.id)}
                      className={`rounded-[28px] p-5 text-left ${isSelected ? 'executive-card executive-highlight' : 'executive-card'}`}
                    >
                      <div className="relative flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-[var(--ink-950)]">
                            {item.title}
                          </div>
                          <div className="mt-2 text-sm leading-7 text-[var(--ink-700)]">
                            {item.summary}
                          </div>
                        </div>
                        <StatusPill tone={item.badgeTone}>{item.statusLabel}</StatusPill>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="surface-dashed mt-6 rounded-[28px] p-8 text-center">
                <div className="accent-icon-block mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                  <ScrollText size={24} />
                </div>
                <div className="mt-4 text-lg font-semibold text-[var(--ink-950)]">
                  Основа пока не выбрана
                </div>
              </div>
            )}

            <div className="surface-note mt-6 rounded-[24px] p-4 text-sm leading-7 text-[var(--ink-800)]">
              {selectedSource ? `${selectedSource.title}` : 'Можно продолжить и без выбранной основы.'}
            </div>
            <Button className="mt-5" variant="ghost" onClick={() => selectSourceKp(null)}>
              Продолжить без основы
            </Button>
            <StageActions
              onDemo={() => applyDemoVariant(pageKey)}
              onNext={moveToNext}
              onGenerate={moveToGeneration}
            />
          </Panel>
        </section>
      ) : null}

      {activeBranch === 'tz' && safeStageId === 'need' ? (
        <section>
          <Panel className="rounded-[34px] p-6">
            <Eyebrow>
              {getBranchLabel(activeBranch)} / {currentStage.label}
            </Eyebrow>
            <label className="mt-5 block">
              <textarea
                value={demoCase.tzRequestSummary}
                onChange={(event) => updateRequestSummary('tz', event.target.value)}
                rows={8}
                placeholder="Опишите техническую цель и ожидаемый результат..."
                className={`w-full rounded-[24px] ${fieldStyles}`}
              />
            </label>

            <div className="mt-4 space-y-4">
              {draft.fields.map((field) => (
                <label key={field.id} className="block">
                  <div className="text-sm font-semibold text-[var(--ink-950)]">{field.label}</div>
                  <div className="mt-1 text-xs text-[var(--ink-500)]">{field.hint}</div>
                  {field.id === 'specialTerms' ? (
                    <textarea
                      value={field.value}
                      onChange={(event) => updateField(field.id, event.target.value)}
                      rows={3}
                      className={`mt-3 w-full rounded-[20px] ${fieldStyles}`}
                    />
                  ) : (
                    <input
                      value={field.value}
                      onChange={(event) => updateField(field.id, event.target.value)}
                      className={`mt-3 w-full rounded-[20px] ${fieldStyles}`}
                    />
                  )}
                </label>
              ))}
            </div>

            <StageActions
              onDemo={() => applyDemoVariant(pageKey)}
              onNext={moveToNext}
              onGenerate={moveToGeneration}
            />
          </Panel>
        </section>
      ) : null}

      {activeBranch === 'tz' && safeStageId === 'comments' ? (
        <section>
          <Panel className="rounded-[34px] p-6">
            {demoCase.tzMeasurements.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {demoCase.tzMeasurements.map((measurement) => (
                  <label key={measurement.id} className="executive-card rounded-[24px] p-4">
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <Ruler size={16} className="text-[var(--brand-700)]" />
                        <div className="text-sm font-semibold text-[var(--ink-950)]">
                          {measurement.label}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-[var(--ink-500)]">{measurement.note}</div>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          value={measurement.value}
                          onChange={(event) =>
                            updateMeasurement(measurement.id, event.target.value)
                          }
                          className={`w-full rounded-[18px] ${fieldStyles}`}
                        />
                        <div className="text-sm text-[var(--ink-700)]">{measurement.unit}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="surface-dashed rounded-[26px] p-6 text-sm leading-7 text-[var(--ink-700)]">
                Замеры пока не добавлены.
              </div>
            )}

            <label className="mt-6 block">
              <textarea
                value={demoCase.tzTechnicalNotes}
                onChange={(event) => updateStageNotes('tz', event.target.value)}
                rows={6}
                placeholder="Технические комментарии..."
                className={`w-full rounded-[24px] ${fieldStyles}`}
              />
            </label>

            <StageActions
              onDemo={() => applyDemoVariant(pageKey)}
              onNext={moveToNext}
              onGenerate={moveToGeneration}
            />
          </Panel>
        </section>
      ) : null}
    </PageTransition>
  )
}
