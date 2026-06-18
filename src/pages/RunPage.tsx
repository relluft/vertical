import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Square } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { resolveRunStages } from '../data/demoData'
import { Button, Eyebrow, Panel, ProgressBar, StatusPill, buttonStyles } from '../components/ui'
import { useDemo } from '../context/DemoContext'
import { caseStagePath, draftPath } from '../lib/routes'
import { getWorkflowStages } from '../lib/workflow'
import type { DemoDocumentType, DemoPageKey, DemoStage } from '../types/demo'

function resolveRunPageKey(branch: DemoDocumentType): DemoPageKey {
  return branch === 'kp' ? 'kp-run' : 'tz-run'
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

const stageDisplayByBranch: Record<
  DemoDocumentType,
  Array<{ title: string; summary: string; details: string }>
> = {
  kp: [
    {
      title: 'Распознаем позиции',
      summary: 'Разбираем потребность или введенный текст.',
      details:
        'Система выделяет товарные позиции, количество, единицы измерения и важные характеристики.',
    },
    {
      title: 'Ищем товары на Вертикаль',
      summary: 'Подбираем подходящие товары и фиксируем сомнительные совпадения.',
      details:
        'Подбор идет внутри обработки и не требует отдельного пользовательского шага.',
    },
    {
      title: 'Подтягиваем цены',
      summary: 'Берем представительские цены через личный кабинет Вертикаль.',
      details:
        'Если цена недоступна, строка попадет в таблицу со статусом проверки.',
    },
    {
      title: 'Формируем рабочую таблицу',
      summary: 'Создаем строки КП со статусами проверки, ценами и маржей.',
      details:
        'Следующий полноценный экран для менеджера - рабочая таблица КП.',
    },
  ],
  tz: [
    {
      title: 'Запуск и очередь',
      summary: 'Создаём запуск и передаём задачу оркестратору.',
      details:
        'Система фиксирует запуск, проверяет комплект входных данных и готовит пайплайн к выполнению.',
    },
    {
      title: 'Анализ фото и замеров',
      summary: 'Собираем измеримые признаки объекта.',
      details:
        'Визуальная часть и технические вводные извлекают из материалов всё, что влияет на черновик ТЗ.',
    },
    {
      title: 'Нормализация контекста',
      summary: 'Собираем основу, адаптацию и параметры в единый контекст.',
      details:
        'Входные данные становятся структурированной базой для следующих шагов и итогового документа.',
    },
    {
      title: 'Поиск нормативов',
      summary: 'Система подбирает применимые нормы и опорные фрагменты.',
      details:
        'Нормативный слой ищет опору для технических требований и будущих формулировок.',
    },
    {
      title: 'Генерация черновика',
      summary: 'Собираем рабочий черновик ТЗ по секциям.',
      details:
        'Формируется рабочая версия технического задания для проверки и дальнейшей доработки.',
    },
    {
      title: 'Проверка и контроль',
      summary: 'Проверяем пробелы, конфликты и сомнительные места.',
      details:
        'Перед показом пользователю отмечаются зоны, где нужен ручной просмотр и подтверждение.',
    },
  ],
}

function mapStagesForDisplay(branch: DemoDocumentType, stages: DemoStage[]) {
  const displayStages = stageDisplayByBranch[branch]

  return stages.map((stage, index) => ({
    ...stage,
    title: displayStages[index]?.title ?? stage.title,
    summary: displayStages[index]?.summary ?? stage.summary,
    details: displayStages[index]?.details ?? stage.details,
  }))
}

function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(count, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [count, value])

  return <motion.span>{rounded}</motion.span>
}

export function RunPage() {
  const { branch, runId } = useParams()
  const [now, setNow] = useState(() => Date.now())
  const [launchWarning, setLaunchWarning] = useState<string | null>(null)
  const {
    state: { cases, run, selectedSourceKpId, demoAppliedByPage },
    applyDemoVariant,
    startRun,
    abortRun,
    completeRun,
  } = useDemo()

  const isValidBranch = branch === 'kp' || branch === 'tz'
  const activeBranch = (isValidBranch ? branch : 'kp') as DemoDocumentType
  const demoCase = cases.find((item) => item.id === run.caseId) ?? cases[0]
  const pageKey = resolveRunPageKey(activeBranch)
  const hasDemoVariant = !!demoAppliedByPage[pageKey]
  const resolved = useMemo(() => resolveRunStages(run, activeBranch, now), [activeBranch, now, run])
  const displayStages = useMemo(
    () => mapStagesForDisplay(activeBranch, resolved.stages),
    [activeBranch, resolved.stages],
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isValidBranch || !hasDemoVariant) {
      return
    }

    if (run.status === 'running' && resolved.isComplete) {
      completeRun(activeBranch)
    }
  }, [activeBranch, completeRun, hasDemoVariant, isValidBranch, resolved.isComplete, run.status])

  if (!isValidBranch) {
    return <Navigate to="/workspace" replace />
  }

  if (!demoCase || runId !== run.id) {
    return null
  }

  const preRunStages = getWorkflowStages(activeBranch).filter(
    (stage) => stage.id !== 'run' && stage.id !== 'editor' && stage.id !== 'export',
  )
  const stageCompletion = preRunStages.map((stage) => {
    let isFilled = false

    if (activeBranch === 'kp') {
      if (stage.id === 'need') isFilled = hasText(demoCase.kpRequestSummary)
      if (stage.id === 'materials') isFilled = demoCase.kpMaterials.length > 0
      if (stage.id === 'comments') isFilled = hasText(demoCase.kpContextNotes)
    } else {
      if (stage.id === 'source') isFilled = Boolean(selectedSourceKpId)
      if (stage.id === 'need') isFilled = hasText(demoCase.tzRequestSummary)
      if (stage.id === 'comments') {
        isFilled =
          hasText(demoCase.tzTechnicalNotes) ||
          demoCase.tzMeasurements.some((measurement) => hasText(measurement.value))
      }
    }

    return {
      ...stage,
      isFilled,
    }
  })

  const completedInputCount = stageCompletion.filter((stage) => stage.isFilled).length
  const needStage = stageCompletion.find((stage) => stage.id === 'need')
  const activeStage = displayStages.find((stage) => stage.status === 'in_progress') ?? null
  const isRunning = run.status === 'running'
  const isAborted = run.status === 'aborted'
  const totalPercent = Math.round(resolved.totalProgress * 100)

  const stagePercents = displayStages.map((stage) => ({
    ...stage,
    percent:
      stage.status === 'completed'
        ? 100
        : stage.status === 'in_progress'
          ? Math.round((stage.progress ?? 0) * 100)
          : 0,
  }))

  function handleRunConfirmation() {
    if (!needStage?.isFilled) {
      setLaunchWarning('Добавьте потребность или текст, чтобы запустить формирование таблицы.')
      return
    }

    setLaunchWarning(null)

    if (!hasDemoVariant) {
      applyDemoVariant(pageKey)
    }

    startRun(run.id, activeBranch)
  }

  const statusTitle = resolved.isComplete
    ? 'Черновик собран'
    : isAborted
      ? 'Сборка остановлена'
      : activeStage?.title ?? 'Готово к запуску'

  return (
    <PageTransition className="space-y-5">
      <Panel tone="highlight" className="rounded-[34px] p-5 md:p-6">
        <div className="space-y-5">
          <div className="max-w-3xl">
            <Eyebrow>Фоновая обработка</Eyebrow>
            <h1 className="display-title mt-5 text-5xl text-[var(--ink-950)] md:text-6xl">
              Формирование рабочей таблицы
            </h1>
            <p className="mt-4 text-sm leading-8 text-[var(--ink-800)] md:text-base">
              Распознавание, подбор на Вертикаль и подтягивание цен идут как внутренняя обработка
              между потребностью и рабочей таблицей.
            </p>
          </div>

          <div className="executive-card rounded-[24px] p-4">
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--ink-950)]">
                  Входные данные
                </div>
                <StatusPill tone={completedInputCount > 0 ? 'ready' : 'low'}>
                  {completedInputCount} из {stageCompletion.length}
                </StatusPill>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {stageCompletion.map((stage) => (
                  <Link
                    key={stage.id}
                    to={caseStagePath(
                      activeBranch,
                      demoCase.id,
                      stage.id as 'source' | 'need' | 'materials' | 'comments',
                    )}
                    className={
                      stage.isFilled
                        ? 'inline-flex items-center gap-2 rounded-full border border-[var(--ink-950)] bg-[var(--ink-950)] px-3 py-1.5 text-sm text-white transition hover:-translate-y-0.5'
                        : 'inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-3 py-1.5 text-sm text-[var(--ink-950)] transition hover:-translate-y-0.5'
                    }
                  >
                    {stage.isFilled ? (
                      <CheckCircle2 size={14} className="text-white" />
                    ) : (
                      <AlertTriangle size={14} className="text-[var(--ink-950)]" />
                    )}
                    <span className={stage.isFilled ? 'text-white' : 'text-[var(--ink-950)]'}>
                      {stage.label}
                    </span>
                  </Link>
                ))}
              </div>

              {launchWarning ? (
                <div className="mt-3 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {launchWarning}
                </div>
              ) : null}
            </div>
          </div>

          <div className="executive-card executive-highlight rounded-[28px] p-4 md:p-5">
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[var(--ink-700)]">Текущий статус</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--ink-950)] md:text-2xl">
                    {statusTitle}
                  </div>
                </div>
                <StatusPill
                  tone={resolved.isComplete ? 'ready' : isAborted ? 'attention' : 'progress'}
                >
                  {resolved.isComplete ? 'Готово' : isAborted ? 'Прервано' : 'Идёт сборка'}
                </StatusPill>
              </div>

              <div className="mt-4">
                <ProgressBar value={resolved.totalProgress} />
              </div>

              <div className="mt-4 grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                {stagePercents.map((stage) => (
                  <div key={stage.id} className="executive-card rounded-[20px] px-3 py-3">
                    <div className="relative">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-[var(--ink-950)]">
                          {stage.title}
                        </div>
                        <div className="text-sm font-semibold text-[var(--brand-700)]">
                          <AnimatedNumber value={stage.percent} />%
                        </div>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={stage.percent / 100} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="metal-pill rounded-full px-4 py-2 text-sm text-[var(--ink-700)]">
                  Общий прогресс: <AnimatedNumber value={totalPercent} />%
                </div>

                {isRunning ? (
                  <>
                    <Button variant="secondary" onClick={() => abortRun(activeBranch)}>
                      <Square size={14} />
                      Прервать
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3 py-2 text-xs"
                      onClick={() => completeRun(activeBranch)}
                    >
                      Пропустить загрузку
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleRunConfirmation}>
                    <CheckCircle2 size={16} />
                    {isAborted ? 'Запустить снова' : hasDemoVariant ? 'Запустить' : 'Подтвердить'}
                  </Button>
                )}

                {resolved.isComplete ? (
                  <Link to={draftPath(activeBranch, demoCase.draftId)} className="contents">
                    <span className={`${buttonStyles('primary')} px-4 py-2.5 text-sm`}>
                      Открыть рабочую таблицу
                      <ArrowRight size={15} />
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </PageTransition>
  )
}
