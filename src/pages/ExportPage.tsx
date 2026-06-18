import { useEffect } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Button, Eyebrow, Panel, ProgressBar, StatusPill, fieldStyles } from '../components/ui'
import { useDemo } from '../context/DemoContext'
import { draftPath } from '../lib/routes'
import { PageTransition } from '../components/PageTransition'
import { getBranchLabel } from '../lib/workflow'
import type { DemoDocumentType, DemoPageKey, ExportFormat } from '../types/demo'

function resolveExportPageKey(branch: DemoDocumentType): DemoPageKey {
  return branch === 'kp' ? 'kp-export' : 'tz-export'
}

const exportCards: Array<{
  format: ExportFormat
  title: string
  caption: string
  icon: typeof FileText
}> = [
  {
    format: 'DOCX',
    title: 'Word',
    caption: 'Редактируемое КП для финальной полировки и печати.',
    icon: FileText,
  },
  {
    format: 'PDF',
    title: 'PDF',
    caption: 'Готовое КП для отправки, согласования и показа.',
    icon: FileType2,
  },
  {
    format: 'XLSX',
    title: 'Excel',
    caption: 'Табличное приложение с товарными строками и итогами.',
    icon: FileSpreadsheet,
  },
]

function getFormatLabel(format: ExportFormat | null) {
  if (format === 'DOCX') return 'Word'
  if (format === 'PDF') return 'PDF'
  if (format === 'XLSX') return 'Excel'
  return 'документ'
}

export function ExportPage() {
  const { branch, exportId } = useParams()
  const {
    state: { cases, exportForm, exportGeneration },
    applyDemoVariant,
    updateExportField,
    startExportGeneration,
    setExportProgress,
    completeExportGeneration,
    showDownloadMessage,
    setBranchStage,
    markStageComplete,
  } = useDemo()

  const isValidBranch = branch === 'kp' || branch === 'tz'
  const activeBranch = (isValidBranch ? branch : 'kp') as DemoDocumentType
  const demoCase = isValidBranch
    ? cases.find((demoCase) => demoCase.exportId === exportId) ?? cases[0]
    : null
  const pageKey = resolveExportPageKey(activeBranch)
  useEffect(() => {
    if (!isValidBranch) {
      return
    }

    setBranchStage(activeBranch, 'export')
    markStageComplete(activeBranch, 'editor')
  }, [activeBranch, isValidBranch, markStageComplete, setBranchStage])

  useEffect(() => {
    if (!isValidBranch || exportGeneration.status !== 'ready') {
      return
    }

    markStageComplete(activeBranch, 'export')
  }, [activeBranch, exportGeneration.status, isValidBranch, markStageComplete])

  useEffect(() => {
    if (
      !isValidBranch ||
      exportGeneration.status !== 'generating' ||
      !exportGeneration.selectedFormat
    ) {
      return
    }

    const startedAt = Date.now()
    const durationMs = 3500

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const nextPercent = Math.min((elapsed / durationMs) * 100, 100)

      setExportProgress(nextPercent)

      if (nextPercent >= 100) {
        window.clearInterval(timer)
        completeExportGeneration(activeBranch)
      }
    }, 220)

    return () => window.clearInterval(timer)
  }, [
    activeBranch,
    completeExportGeneration,
    exportGeneration.selectedFormat,
    exportGeneration.status,
    isValidBranch,
    setExportProgress,
  ])

  if (!isValidBranch) {
    return <Navigate to="/workspace" replace />
  }

  if (!demoCase || exportId !== demoCase.exportId) {
    return null
  }

  return (
    <PageTransition className="space-y-5">
      <Panel tone="gold" className="rounded-[26px] p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),300px]">
          <div className="space-y-3">
            <Eyebrow>{getBranchLabel(activeBranch)} / Финальное КП</Eyebrow>
            <div className="max-w-3xl">
              <h1 className="display-title text-4xl text-[var(--ink-950)] md:text-[3rem]">
                Финальное КП
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-800)]">
                Проверьте, какие строки готовы к выпуску, заполните реквизиты и сформируйте
                чистый документ без внутренних статусов и рабочих комментариев.
              </p>
            </div>

            <div className="grid max-w-xl gap-3">
              <div className="executive-card rounded-[18px] p-3">
                <div className="relative">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    Дата документа
                  </div>
                  <div className="mt-1.5 text-base font-semibold text-[var(--ink-950)]">
                    {exportForm.documentDate || 'Заполните вручную'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="executive-card gold-highlight rounded-[22px] p-3.5">
            <div className="relative">
              <div className="flex items-center gap-2.5">
                <div className="accent-icon-block rounded-xl p-2.5 text-[var(--accent-amber-strong)]">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--ink-950)]">Подготовка КП</div>
                  <div className="text-xs leading-5 text-[var(--ink-700)]">
                    Заполняет реквизиты и подготавливает итоговый документ к выпуску.
                  </div>
                </div>
              </div>

              <Button
                className="mt-3 px-3 py-1.5 text-xs"
                variant="ghost"
                onClick={() => applyDemoVariant(pageKey)}
              >
                Демо
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr),0.95fr]">
        <Panel className="rounded-[32px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xl font-semibold text-[var(--ink-950)]">Ручные реквизиты</div>
              <div className="mt-1 text-sm text-[var(--ink-700)]">
                Эти поля остаются под контролем человека перед формированием финального КП.
              </div>
            </div>
            <StatusPill tone="attention">Ручной ввод</StatusPill>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-sm font-semibold text-[var(--ink-950)]">Контрагент</div>
              <input
                value={exportForm.counterpartyName}
                onChange={(event) => updateExportField('counterpartyName', event.target.value)}
                placeholder="ООО Пример"
                className={`mt-3 w-full rounded-[22px] ${fieldStyles}`}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-[var(--ink-950)]">Дата документа</div>
              <input
                type="date"
                value={exportForm.documentDate}
                onChange={(event) => updateExportField('documentDate', event.target.value)}
                className={`mt-3 w-full rounded-[22px] ${fieldStyles}`}
              />
            </label>

            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-[var(--ink-950)]">Адрес контрагента</div>
              <input
                value={exportForm.counterpartyAddress}
                onChange={(event) => updateExportField('counterpartyAddress', event.target.value)}
                placeholder="Юридический или почтовый адрес"
                className={`mt-3 w-full rounded-[22px] ${fieldStyles}`}
              />
            </label>

            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-[var(--ink-950)]">Адрес объекта</div>
              <input
                value={exportForm.objectAddress}
                onChange={(event) => updateExportField('objectAddress', event.target.value)}
                placeholder="Где выполняются работы"
                className={`mt-3 w-full rounded-[22px] ${fieldStyles}`}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-[var(--ink-950)]">Подписант</div>
              <input
                value={exportForm.signatoryName}
                onChange={(event) => updateExportField('signatoryName', event.target.value)}
                placeholder="ФИО"
                className={`mt-3 w-full rounded-[22px] ${fieldStyles}`}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-[var(--ink-950)]">Служебная пометка</div>
              <input
                value={exportForm.manualNotes}
                onChange={(event) => updateExportField('manualNotes', event.target.value)}
                placeholder="Короткая служебная пометка"
                className={`mt-3 w-full rounded-[22px] ${fieldStyles}`}
              />
            </label>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="rounded-[32px] p-6">
            <div className="text-xl font-semibold text-[var(--ink-950)]">Сформировать КП</div>
            <div className="mt-2 text-sm leading-7 text-[var(--ink-700)]">
              Выберите формат, и система подготовит чистый документ для клиента.
            </div>

            <div className="mt-6 space-y-3">
              {exportCards.map((card) => {
                const Icon = card.icon
                const isActive = exportGeneration.selectedFormat === card.format

                return (
                  <button
                    key={card.format}
                    onClick={() => startExportGeneration(card.format)}
                    className={`w-full rounded-[26px] px-4 py-4 text-left ${
                      isActive ? 'executive-card executive-highlight' : 'executive-card'
                    }`}
                  >
                    <div className="relative flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="accent-icon-block-soft rounded-2xl p-3">
                          <Icon size={20} />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-[var(--ink-950)]">
                            {card.title}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-[var(--ink-700)]">
                            {card.caption}
                          </div>
                        </div>
                      </div>
                      <StatusPill tone={isActive ? 'progress' : 'ready'}>{card.format}</StatusPill>
                    </div>
                  </button>
                )
              })}
            </div>
          </Panel>

          <Panel tone="gold" className="rounded-[32px] p-6">
            <div className="flex items-center gap-3">
              <div className="accent-icon-block rounded-2xl p-3 text-[var(--accent-amber-strong)]">
                {exportGeneration.status === 'generating' ? (
                  <LoaderCircle size={20} className="animate-spin" />
                ) : (
                  <Download size={20} />
                )}
              </div>
              <div>
                <div className="text-xl font-semibold text-[var(--ink-950)]">Статус генерации</div>
                <div className="text-sm text-[var(--ink-700)]">
                  {exportGeneration.selectedFormat
                    ? `Формат: ${getFormatLabel(exportGeneration.selectedFormat)}`
                    : 'Сначала выберите формат КП.'}
                </div>
              </div>
            </div>

            {exportGeneration.status === 'idle' ? (
              <div className="surface-dashed mt-6 rounded-[24px] p-5 text-sm leading-7 text-[var(--ink-700)]">
                Формирование ещё не запускалось. После выбора формата здесь появится прогресс и
                выдача результата.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[var(--ink-950)]">
                    {exportGeneration.status === 'generating'
                      ? 'Система заполняет шаблон КП и готовит финальный файл.'
                      : 'Файл готов к загрузке.'}
                  </div>
                  <div className="text-sm font-semibold text-[var(--brand-700)]">
                    {exportGeneration.progressPercent}%
                  </div>
                </div>

                <div className="relative">
                  <ProgressBar value={exportGeneration.progressPercent / 100} />
                  {exportGeneration.status === 'generating' ? (
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-full"
                      style={{ width: `${exportGeneration.progressPercent}%` }}
                    >
                      <div
                        className="h-full animate-[slow-pulse_1.6s_ease-in-out_infinite] opacity-80"
                        style={{
                          backgroundImage:
                            'linear-gradient(135deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.28) 25%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 75%, rgba(255,255,255,0.28) 75%, rgba(255,255,255,0.28) 100%)',
                          backgroundSize: '20px 20px',
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                {exportGeneration.status === 'ready' &&
                exportGeneration.generatedArtifact ? (
                  <div className="space-y-4 rounded-[26px] border border-blue-500/25 bg-[linear-gradient(180deg,rgba(37,99,235,0.14),rgba(15,23,42,0.06))] p-5">
                    <div>
                      <div className="text-base font-semibold text-[var(--ink-950)]">
                        Документ {getFormatLabel(exportGeneration.generatedArtifact.format)} готов
                      </div>
                      <div className="mt-1 text-sm leading-6 text-[var(--ink-700)]">
                        Файл сформирован и готов к скачиванию в интерфейсе.
                      </div>
                      <div className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">
                        {exportGeneration.generatedArtifact.fileName}
                      </div>
                    </div>

                    <Button
                      className="w-full justify-center py-3 text-base"
                      onClick={showDownloadMessage}
                    >
                      <Download size={18} />
                      Скачать документ
                    </Button>

                    {exportGeneration.downloadMessage ? (
                      <div className="surface-note rounded-[20px] px-4 py-3 text-sm text-[var(--ink-950)]">
                        {exportGeneration.downloadMessage}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </Panel>

          <Link
            to={draftPath(activeBranch, demoCase.draftId)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-[rgba(255,248,234,0.02)] px-4 py-3 text-sm font-semibold text-[var(--ink-950)] transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
          >
            Назад в рабочую таблицу
          </Link>
        </div>
      </section>
    </PageTransition>
  )
}
