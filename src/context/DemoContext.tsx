/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import {
  createEmptyOfferTable,
  createDemoExportForm,
  createEmptyExportForm,
  createEmptyExportGeneration,
  createExportArtifact,
  createInitialDemoState,
  getDefaultSectionId,
  getDemoDraftCellAnnotations,
  getDemoDraftFields,
  getDemoDraftIssues,
  getDemoDraftSections,
  getDemoOfferTable,
  getDemoDraftSources,
  getDemoMaterials,
  getDemoMeasurements,
  getDemoNeedText,
  getDemoNotes,
  getDemoSourceOptions,
  getRunStageBlueprints,
  recalculateOfferTable,
} from '../data/demoData'
import { attachVerticalProductData } from '../lib/verticalProducts'
import type {
  DemoDocumentType,
  DemoOfferTable,
  DemoPageKey,
  DemoState,
  DemoWorkflowStageId,
  ExportFormat,
  OfferItemEditableField,
  QAFlag,
  RecentOperation,
} from '../types/demo'

const storageKey = 'uchet-system-kp-editor-state-v2'
const removedFastenersPattern =
  /^.*(?:Креп[её]ж и доборные элементы для монтажа|состав уточнить|состав не указан).*$/gim
const removedFastenersId = 'offer-missing-fasteners'

interface DemoContextValue {
  state: DemoState
  startPipeline: (branch: DemoDocumentType, pipelineName: string) => void
  applyDemoVariant: (pageKey: DemoPageKey) => void
  applyKpOfferTable: (offerTable: DemoOfferTable) => void
  startRun: (runId: string, branch: DemoDocumentType) => void
  abortRun: (branch: DemoDocumentType) => void
  completeRun: (branch: DemoDocumentType) => void
  updateField: (fieldId: DemoState['draft']['fields'][number]['id'], value: string) => void
  updateOfferItem: (itemId: string, field: OfferItemEditableField, value: string) => void
  addOfferItem: () => void
  deleteOfferItem: (itemId: string) => void
  updateSectionStat: (sectionId: string, statIndex: number, value: string) => void
  selectDocumentType: (documentType: DemoDocumentType) => void
  selectSection: (sectionId: string) => void
  focusIssue: (issue: QAFlag) => void
  openSectionFromSource: (sectionId: string) => void
  updateExportField: (field: keyof DemoState['exportForm'], value: string) => void
  startExportGeneration: (format: ExportFormat) => void
  setExportProgress: (value: number) => void
  completeExportGeneration: (branch: DemoDocumentType) => void
  showDownloadMessage: () => void
  resetExportGeneration: () => void
  setBranchStage: (branch: DemoDocumentType, stageId: DemoWorkflowStageId) => void
  markStageComplete: (branch: DemoDocumentType, stageId: DemoWorkflowStageId) => void
  selectSourceKp: (caseId: string | null) => void
  updateRequestSummary: (branch: DemoDocumentType, value: string) => void
  updateStageNotes: (branch: DemoDocumentType, value: string) => void
  updateMeasurement: (measurementId: string, value: string) => void
  resetDemo: () => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

function loadState() {
  const initialState = createInitialDemoState()

  if (typeof window === 'undefined') {
    return normalizeDemoState(initialState)
  }

  const cached = window.localStorage.getItem(storageKey)
  if (!cached) {
    return normalizeDemoState(initialState)
  }

  try {
    const parsed = JSON.parse(cached) as Partial<DemoState>
    const parsedExportForm = (parsed.exportForm ?? {}) as Partial<DemoState['exportForm']>
    const mergedExportForm = {
      ...initialState.exportForm,
      ...parsedExportForm,
    }
    const hasStoredDocumentTitle = Object.prototype.hasOwnProperty.call(parsedExportForm, 'documentTitle')

    return normalizeDemoState({
      ...initialState,
      ...parsed,
      draft: {
        ...initialState.draft,
        ...parsed.draft,
        cellAnnotations: {
          ...(parsed.draft?.cellAnnotations ?? initialState.draft.cellAnnotations),
          ...getDemoDraftCellAnnotations(parsed.draft?.documentType ?? initialState.draft.documentType),
        },
      },
      exportForm: {
        ...mergedExportForm,
        documentTitle:
          hasStoredDocumentTitle && typeof parsedExportForm.documentTitle === 'string'
            ? parsedExportForm.documentTitle || mergedExportForm.documentNumber
            : mergedExportForm.documentNumber,
      },
      exportGeneration: {
        ...initialState.exportGeneration,
        ...parsed.exportGeneration,
      },
    })
  } catch {
    return normalizeDemoState(initialState)
  }
}

function removeFastenersLine(value: string) {
  return value
    .replace(removedFastenersPattern, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sanitizeDemoState(state: DemoState): DemoState {
  const offerTable = state.draft.offerTable

  return {
    ...state,
    cases: state.cases.map((demoCase) => ({
      ...demoCase,
      kpRequestSummary: removeFastenersLine(demoCase.kpRequestSummary),
      kpContextNotes: removeFastenersLine(demoCase.kpContextNotes),
    })),
    draft: {
      ...state.draft,
      offerTable: offerTable
        ? recalculateOfferTable({
            ...offerTable,
            items: offerTable.items
              .filter((item) => item.id !== removedFastenersId)
              .map((item) => attachVerticalProductData(item)),
          })
        : null,
      cellAnnotations: Object.fromEntries(
        Object.entries(state.draft.cellAnnotations).filter(
          ([cellId]) => !cellId.startsWith(`kp-item:${removedFastenersId}:`),
        ),
      ),
      issues: state.draft.issues.filter((issue) => !issue.id.includes(removedFastenersId)),
    },
  }
}

function addLatestCellAnnotations(state: DemoState): DemoState {
  const latestCellAnnotations = getDemoDraftCellAnnotations(state.draft.documentType)

  if (!Object.keys(latestCellAnnotations).length) {
    return state
  }

  const nextCellAnnotations = {
    ...state.draft.cellAnnotations,
    ...latestCellAnnotations,
  }

  return {
    ...state,
    draft: {
      ...state.draft,
      cellAnnotations: nextCellAnnotations,
    },
  }
}

function normalizeDemoState(state: DemoState): DemoState {
  return addLatestCellAnnotations(sanitizeDemoState(state))
}

function createOperation(branch: DemoDocumentType, title: string, description: string): RecentOperation {
  const timestamp = new Date().toISOString()

  return {
    id: `operation-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    branch,
    title,
    description,
    createdAt: timestamp,
  }
}

function appendOperation(state: DemoState, operation: RecentOperation) {
  return [operation, ...state.recentOperations].slice(0, 8)
}

function getPageBranch(pageKey: DemoPageKey): DemoDocumentType {
  return pageKey.startsWith('kp-') ? 'kp' : 'tz'
}

function stripBranchDemoFlags(state: DemoState, branch: DemoDocumentType) {
  const nextFlags = { ...state.demoAppliedByPage }

  Object.keys(nextFlags).forEach((key) => {
    if (key.startsWith(`${branch}-`)) {
      delete nextFlags[key as DemoPageKey]
    }
  })

  return nextFlags
}

function buildDraftDemo(branch: DemoDocumentType, pipelineName: string) {
  return {
    documentType: branch,
    fields: getDemoDraftFields(),
    sections: getDemoDraftSections(branch, pipelineName),
    offerTable: branch === 'kp' ? getDemoOfferTable() : null,
    cellAnnotations: getDemoDraftCellAnnotations(branch),
    issues: getDemoDraftIssues(branch),
    sources: getDemoDraftSources(branch),
  }
}

export function DemoProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<DemoState>(loadState)

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state])

  const startPipeline = useCallback((branch: DemoDocumentType, pipelineName: string) => {
    setState((current) => {
      const demoCase = current.cases[0]
      if (!demoCase) {
        return current
      }

      const trimmedName = pipelineName.trim()
      const nextPipelineNumber = current.nextPipelineNumber ?? 1
      const resolvedPipelineName = trimmedName || `Новое КП ${nextPipelineNumber}`

      const clearedDemoFlags = stripBranchDemoFlags(current, branch)
      const resetCase =
        branch === 'kp'
          ? {
              ...demoCase,
              kpRequestSummary: '',
              kpContextNotes: '',
              kpMaterials: [],
            }
          : {
              ...demoCase,
              tzRequestSummary: '',
              tzTechnicalNotes: '',
              tzMeasurements: [],
            }

      return {
        ...current,
        cases: [resetCase],
        nextPipelineNumber: trimmedName ? nextPipelineNumber : nextPipelineNumber + 1,
        selectedDocumentType: branch,
        selectedSectionId: getDefaultSectionId(branch),
        selectedSourceKpId: branch === 'tz' ? null : current.selectedSourceKpId,
        draft: {
          ...current.draft,
          documentType: branch,
          fields: current.draft.fields.map((field) => ({ ...field, value: '' })),
          sections: [],
          offerTable: branch === 'kp' ? createEmptyOfferTable() : null,
          cellAnnotations: {},
          issues: [],
          sources: [],
        },
        run: {
          ...current.run,
          status: 'idle',
          startedAt: null,
          completedAt: null,
          stages: getRunStageBlueprints(branch),
        },
        exportForm: createEmptyExportForm(),
        exportGeneration: createEmptyExportGeneration(),
        focusedIssueId: null,
        branchLaunch: {
          ...current.branchLaunch,
          [branch]: {
            started: true,
            pipelineName: resolvedPipelineName,
          },
        },
        demoAppliedByPage: clearedDemoFlags,
        currentBranchStage: {
          ...current.currentBranchStage,
          [branch]: branch === 'kp' ? 'need' : 'source',
        },
        branchProgress: {
          ...current.branchProgress,
          [branch]: {
            currentStageId: branch === 'kp' ? 'need' : 'source',
            completedStageIds: [],
          },
        },
        recentOperations: appendOperation(
          current,
          createOperation(
            branch,
            'КП создано',
            `Создан новый кейс товарного КП: «${resolvedPipelineName}».`,
          ),
        ),
      }
    })
  }, [])

  const applyDemoVariant = useCallback((pageKey: DemoPageKey) => {
    const branch = getPageBranch(pageKey)

    setState((current) => {
      const demoCase = current.cases[0]
      if (!demoCase) {
        return current
      }

      const pipelineName =
        current.branchLaunch[branch].pipelineName || (branch === 'kp' ? 'Товарное КП' : 'Технический пайплайн')

      let nextCase = demoCase
      let nextDraft = current.draft
      let nextRun = current.run
      let nextSelectedSourceKpId = current.selectedSourceKpId
      let nextExportForm = current.exportForm
      let nextExportGeneration = current.exportGeneration
      let title = 'Подключён рабочий пример'
      let description = 'Для текущего шага применены подготовленные данные.'

      switch (pageKey) {
        case 'kp-need':
          nextCase = {
            ...demoCase,
            kpRequestSummary: getDemoNeedText('kp', pipelineName),
          }
          title = 'Добавлена потребность'
          description = 'Заполнен пример потребности для товарного КП.'
          break
        case 'kp-materials':
          nextCase = {
            ...demoCase,
            kpMaterials: getDemoMaterials(),
          }
          title = 'Добавлены материалы'
          description = 'Добавлен обезличенный набор материалов для рабочего примера.'
          break
        case 'kp-comments':
          nextCase = {
            ...demoCase,
            kpContextNotes: getDemoNotes('kp'),
          }
          title = 'Заполнены вводные'
          description = 'Заполнен пример свободных вводных для генерации КП.'
          break
        case 'tz-source':
          nextSelectedSourceKpId = getDemoSourceOptions()[0]?.id ?? null
          title = 'Выбрана основа ТЗ'
          description = 'Открыты обезличенные варианты базового КП для дальнейшей работы.'
          break
        case 'tz-need':
          nextCase = {
            ...demoCase,
            tzRequestSummary: getDemoNeedText('tz', pipelineName),
          }
          title = 'Заполнена техническая цель'
          description = 'Заполнен пример текста для адаптации задачи под ТЗ.'
          break
        case 'tz-comments':
          nextCase = {
            ...demoCase,
            tzTechnicalNotes: getDemoNotes('tz'),
            tzMeasurements: getDemoMeasurements(),
          }
          title = 'Заполнены технические вводные'
          description = 'Добавлены контрольные параметры и свободные технические вводные.'
          break
        case 'kp-draft':
        case 'tz-draft':
          nextDraft = {
            ...nextDraft,
            ...buildDraftDemo(branch, pipelineName),
          }
          title = branch === 'kp' ? 'Подготовлена рабочая таблица КП' : 'Подготовлен черновик ТЗ'
          description = branch === 'kp'
            ? 'Сформирована таблица с товарами Вертикаль, ценами и статусами проверки.'
            : 'Подготовлен обезличенный черновик для просмотра и правок.'
          break
        case 'kp-export':
        case 'tz-export':
          nextDraft = {
            ...nextDraft,
            ...buildDraftDemo(branch, pipelineName),
          }
          nextExportForm = createDemoExportForm()
          nextExportGeneration = createEmptyExportGeneration()
          title = branch === 'kp' ? 'Подготовлено финальное КП' : 'Подготовлен экспорт ТЗ'
          description = branch === 'kp'
            ? 'Подготовлен экран финального КП без внутренних статусов и рабочих комментариев.'
            : 'Подготовлен экран экспорта с реквизитами и выбором формата.'
          break
        case 'kp-run':
        case 'tz-run':
          nextRun = {
            ...current.run,
            status: 'idle',
            startedAt: null,
            completedAt: null,
            stages: getRunStageBlueprints(branch),
          }
          title = branch === 'kp' ? 'Подготовлена сборка КП' : 'Подготовлена сборка ТЗ'
          description = 'Подготовлен сценарий для экрана сборки.'
          break
      }

      return sanitizeDemoState({
        ...current,
        cases: [nextCase],
        draft: nextDraft,
        run: nextRun,
        selectedDocumentType: branch,
        selectedSectionId: getDefaultSectionId(branch),
        selectedSourceKpId: nextSelectedSourceKpId,
        exportForm: nextExportForm,
        exportGeneration: nextExportGeneration,
        demoAppliedByPage: {
          ...current.demoAppliedByPage,
          [pageKey]: true,
        },
        recentOperations: appendOperation(current, createOperation(branch, title, description)),
      })
    })
  }, [])

  const applyKpOfferTable = useCallback((offerTable: DemoOfferTable) => {
    setState((current) => {
      const nextOfferTable = recalculateOfferTable({
        ...offerTable,
        items: offerTable.items.map((item) => ({ ...item })),
        totals: offerTable.totals.map((total) => ({ ...total })),
      })

      return sanitizeDemoState({
        ...current,
        selectedDocumentType: 'kp',
        draft: {
          ...current.draft,
          documentType: 'kp',
          offerTable: nextOfferTable,
        },
        currentBranchStage: {
          ...current.currentBranchStage,
          kp: 'editor',
        },
        branchProgress: {
          ...current.branchProgress,
          kp: {
            ...current.branchProgress.kp,
            currentStageId: 'editor',
            completedStageIds: Array.from(new Set([...current.branchProgress.kp.completedStageIds, 'need', 'run'])),
          },
        },
        recentOperations: appendOperation(
          current,
          createOperation('kp', 'Подготовлена демо-таблица КП', 'Рабочая таблица заполнена выбранным демо-набором.'),
        ),
      })
    })
  }, [])

  const startRun = useCallback((runId: string, branch: DemoDocumentType) => {
    setState((current) => {
      if (current.run.id !== runId) {
        return current
      }

      return {
        ...current,
        selectedDocumentType: branch,
        selectedSectionId: getDefaultSectionId(branch),
        run: {
          ...current.run,
          status: 'running',
          startedAt: current.run.status === 'running' ? current.run.startedAt : Date.now(),
          completedAt: null,
          stages: getRunStageBlueprints(branch),
        },
        currentBranchStage: {
          ...current.currentBranchStage,
          [branch]: 'run',
        },
        branchProgress: {
          ...current.branchProgress,
          [branch]: {
            currentStageId: 'run',
            completedStageIds: Array.from(new Set([...current.branchProgress[branch].completedStageIds])),
          },
        },
        focusedIssueId: null,
        exportGeneration: createEmptyExportGeneration(),
        recentOperations: appendOperation(
          current,
          createOperation(
            branch,
            branch === 'kp' ? 'Запущено формирование таблицы КП' : 'Запущена сборка ТЗ',
            branch === 'kp'
              ? 'Система начала распознавание, подбор на Вертикаль и подтягивание цен.'
              : 'Система начала сборку технического задания.',
          ),
        ),
      }
    })
  }, [])

  const abortRun = useCallback((branch: DemoDocumentType) => {
    setState((current) => {
      if (current.run.status !== 'running') {
        return current
      }

      return {
        ...current,
        selectedDocumentType: branch,
        run: {
          ...current.run,
          status: 'aborted',
          startedAt: null,
          completedAt: null,
          stages: getRunStageBlueprints(branch),
        },
        recentOperations: appendOperation(
          current,
          createOperation(
            branch,
            branch === 'kp' ? 'Сборка КП прервана' : 'Сборка ТЗ прервана',
            'Выполнение остановлено, чтобы можно было вернуться к вводным и запустить сценарий заново.',
          ),
        ),
      }
    })
  }, [])


  const completeRun = useCallback((branch: DemoDocumentType) => {
    setState((current) => {
      if (current.run.status === 'completed') {
        return current
      }

      const pipelineName =
        current.branchLaunch[branch].pipelineName ||
        (branch === 'kp' ? 'Товарное КП' : 'Технический пайплайн')
      const draftPageKey = branch === 'kp' ? 'kp-draft' : 'tz-draft'

      return {
        ...current,
        selectedDocumentType: branch,
        run: {
          ...current.run,
          status: 'completed',
          completedAt: Date.now(),
          stages: getRunStageBlueprints(branch),
        },
        draft: {
          ...current.draft,
          ...buildDraftDemo(branch, pipelineName),
        },
        demoAppliedByPage: {
          ...current.demoAppliedByPage,
          [draftPageKey]: true,
        },
        currentBranchStage: {
          ...current.currentBranchStage,
          [branch]: 'editor',
        },
        branchProgress: {
          ...current.branchProgress,
          [branch]: {
            currentStageId: 'editor',
            completedStageIds: Array.from(
              new Set([...current.branchProgress[branch].completedStageIds, 'run']),
            ),
          },
        },
        recentOperations: appendOperation(
          current,
          createOperation(
            branch,
            branch === 'kp' ? 'Рабочая таблица КП готова' : 'Черновик ТЗ собран',
            branch === 'kp'
              ? 'Таблица сформирована, можно проверить товары, цены и статусы.'
              : 'Сборка завершена, можно перейти в рабочее пространство ТЗ.',
          ),
        ),
      }
    })
  }, [])

  const updateField = useCallback(
    (fieldId: DemoState['draft']['fields'][number]['id'], value: string) => {
      setState((current) => {
        const existingField = current.draft.fields.find((field) => field.id === fieldId)
        if (!existingField || existingField.value === value) {
          return current
        }

        return {
          ...current,
          draft: {
            ...current.draft,
            fields: current.draft.fields.map((field) =>
              field.id === fieldId ? { ...field, value } : field,
            ),
          },
        }
      })
    },
    [],
  )

  const updateOfferItem = useCallback((itemId: string, field: OfferItemEditableField, value: string) => {
    setState((current) => {
      const offerTable = current.draft.offerTable
      const item = offerTable?.items.find((entry) => entry.id === itemId)

      if (!offerTable || !item) {
        return current
      }

      const textFields: OfferItemEditableField[] = [
        'description',
        'sourceNeed',
        'productCode',
        'unit',
        'reviewStatus',
        'managerComment',
      ]

      if (textFields.includes(field)) {
        if (item[field] === value) {
          return current
        }

        return {
          ...current,
          draft: {
            ...current.draft,
            offerTable: recalculateOfferTable({
              ...offerTable,
              items: offerTable.items.map((entry) =>
                entry.id === itemId ? { ...entry, [field]: value } : entry,
              ),
            }),
          },
        }
      }

      const normalizedValue = value.replace(/\s+/g, '').replace(',', '.')
      const parsedValue = normalizedValue === '' ? 0 : Number(normalizedValue)

      if (!Number.isFinite(parsedValue)) {
        return current
      }

      if (item[field] === parsedValue) {
        return current
      }

      return {
        ...current,
        draft: {
          ...current.draft,
          offerTable: recalculateOfferTable({
            ...offerTable,
            items: offerTable.items.map((entry) =>
              entry.id === itemId ? { ...entry, [field]: parsedValue } : entry,
            ),
          }),
        },
      }
    })
  }, [])

  const addOfferItem = useCallback(() => {
    setState((current) => {
      const offerTable = current.draft.offerTable

      if (!offerTable) {
        return current
      }

      const timestamp = Date.now()

      return {
        ...current,
        draft: {
          ...current.draft,
          offerTable: recalculateOfferTable({
            ...offerTable,
            items: [
              ...offerTable.items,
              {
                id: `offer-manual-${timestamp}`,
                sourceNeed: 'Добавлено вручную',
                description: '',
                productCode: '',
                unit: 'шт',
                quantity: 1,
                unitPrice: 0,
                installationUnitPrice: 0,
                minSalePrice: 0,
                maxSalePrice: 0,
                marketBenchmark: 0,
                reviewStatus: 'нужно уточнить',
                managerComment: '',
              },
            ],
          }),
        },
      }
    })
  }, [])

  const deleteOfferItem = useCallback((itemId: string) => {
    setState((current) => {
      const offerTable = current.draft.offerTable

      if (!offerTable || !offerTable.items.some((entry) => entry.id === itemId)) {
        return current
      }

      return {
        ...current,
        draft: {
          ...current.draft,
          offerTable: recalculateOfferTable({
            ...offerTable,
            items: offerTable.items.filter((entry) => entry.id !== itemId),
          }),
        },
      }
    })
  }, [])

  const updateSectionStat = useCallback((sectionId: string, statIndex: number, value: string) => {
    setState((current) => {
      const targetSection = current.draft.sections.find((section) => section.id === sectionId)
      const currentValue = targetSection?.stats?.[statIndex]?.value

      if (!targetSection?.stats || currentValue === undefined || currentValue === value) {
        return current
      }

      return {
        ...current,
        draft: {
          ...current.draft,
          sections: current.draft.sections.map((section) => {
            if (section.id !== sectionId || !section.stats) {
              return section
            }

            return {
              ...section,
              stats: section.stats.map((stat, index) =>
                index === statIndex ? { ...stat, value } : stat,
              ),
            }
          }),
        },
      }
    })
  }, [])

  const selectDocumentType = useCallback((documentType: DemoDocumentType) => {
    setState((current) => {
      const fallbackSection =
        current.draft.sections.find((section) => section.documentType === documentType)?.id ??
        getDefaultSectionId(documentType)

      if (
        current.selectedDocumentType === documentType &&
        current.draft.documentType === documentType &&
        current.selectedSectionId === fallbackSection
      ) {
        return current
      }

      return {
        ...current,
        selectedDocumentType: documentType,
        draft: {
          ...current.draft,
          documentType,
        },
        selectedSectionId: fallbackSection,
      }
    })
  }, [])

  const selectSection = useCallback((sectionId: string) => {
    setState((current) => {
      if (current.selectedSectionId === sectionId && current.focusedIssueId === null) {
        return current
      }

      return {
        ...current,
        selectedSectionId: sectionId,
        focusedIssueId: null,
      }
    })
  }, [])

  const focusIssue = useCallback((issue: QAFlag) => {
    setState((current) => {
      const nextDocumentType =
        current.draft.sections.find((section) => section.id === issue.relatedSectionId)?.documentType ??
        current.selectedDocumentType

      if (
        current.focusedIssueId === issue.id &&
        current.selectedSectionId === issue.relatedSectionId &&
        current.selectedDocumentType === nextDocumentType
      ) {
        return current
      }

      return {
        ...current,
        focusedIssueId: issue.id,
        selectedSectionId: issue.relatedSectionId,
        selectedDocumentType: nextDocumentType,
      }
    })
  }, [])

  const openSectionFromSource = useCallback((sectionId: string) => {
    setState((current) => {
      const nextDocumentType =
        current.draft.sections.find((section) => section.id === sectionId)?.documentType ??
        current.selectedDocumentType

      if (
        current.selectedSectionId === sectionId &&
        current.selectedDocumentType === nextDocumentType &&
        current.focusedIssueId === null
      ) {
        return current
      }

      return {
        ...current,
        selectedSectionId: sectionId,
        selectedDocumentType: nextDocumentType,
        focusedIssueId: null,
      }
    })
  }, [])

  /*
  const registerExport = useCallback((format: ExportFormat, branch: DemoDocumentType) => {
    setState((current) => {
      const artifact = createExportArtifact(format)

      return {
        ...current,
        exportArtifacts: [artifact, ...current.exportArtifacts],
        previewArtifact: artifact,
        recentOperations: appendOperation(
          current,
          createOperation(
            branch,
            `Сформирован ${format}`,
            branch === 'kp'
              ? `Экспортирован пакет коммерческого предложения в формате ${format}.`
              : `Экспортирован пакет технического задания в формате ${format}.`,
          ),
        ),
      }
    })
  }, [])

  const closeExportPreview = useCallback(() => {
    setState((current) => {
      if (current.previewArtifact === null) {
        return current
      }

      return {
        ...current,
        previewArtifact: null,
      }
    })
  }, [])

  const sendForSignature = useCallback((branch: DemoDocumentType) => {
    setState((current) => {
      if (current.approvalSent && current.draft.approvalState === 'approved') {
        return current
      }

      return {
        ...current,
        approvalSent: true,
        draft: {
          ...current.draft,
          approvalState: 'approved',
        },
        recentOperations: appendOperation(
          current,
          createOperation(
            branch,
            branch === 'kp' ? 'КП отправлено на согласование' : 'ТЗ отправлено на согласование',
            'Финальный пакет передан дальше без добавления чувствительных данных.',
          ),
        ),
      }
    })
  }, [])

  */

  const updateExportField = useCallback((field: keyof DemoState['exportForm'], value: string) => {
    setState((current) => {
      if (current.exportForm[field] === value) {
        return current
      }

      return {
        ...current,
        exportForm: {
          ...current.exportForm,
          [field]: value,
        },
      }
    })
  }, [])

  const startExportGeneration = useCallback((format: ExportFormat) => {
    setState((current) => ({
      ...current,
      exportGeneration: {
        selectedFormat: format,
        status: 'generating',
        progressPercent: 0,
        generatedArtifact: null,
        downloadMessage: null,
      },
    }))
  }, [])

  const setExportProgress = useCallback((value: number) => {
    setState((current) => {
      if (current.exportGeneration.status !== 'generating') {
        return current
      }

      const progressPercent = Math.max(0, Math.min(100, Math.round(value)))
      if (current.exportGeneration.progressPercent === progressPercent) {
        return current
      }

      return {
        ...current,
        exportGeneration: {
          ...current.exportGeneration,
          progressPercent,
        },
      }
    })
  }, [])

  const completeExportGeneration = useCallback((branch: DemoDocumentType) => {
    setState((current) => {
      const format = current.exportGeneration.selectedFormat
      if (!format) {
        return current
      }

      const artifact = createExportArtifact(format)

      return {
        ...current,
        exportGeneration: {
          selectedFormat: format,
          status: 'ready',
          progressPercent: 100,
          generatedArtifact: artifact,
          downloadMessage: null,
        },
        recentOperations: appendOperation(
          current,
          createOperation(
            branch,
            `Сформирован ${format}`,
            branch === 'kp'
              ? `Подготовлено финальное коммерческое предложение в формате ${format}.`
              : `Подготовлен экспорт технического задания в формате ${format}.`,
          ),
        ),
      }
    })
  }, [])

  const showDownloadMessage = useCallback(() => {
    setState((current) => {
      const format = current.exportGeneration.generatedArtifact?.format ?? current.exportGeneration.selectedFormat
      if (!format) {
        return current
      }

      return {
        ...current,
        exportGeneration: {
          ...current.exportGeneration,
          downloadMessage: `Скачивание ${format} начнётся здесь.`,
        },
      }
    })
  }, [])

  const resetExportGeneration = useCallback(() => {
    setState((current) => ({
      ...current,
      exportGeneration: createEmptyExportGeneration(),
    }))
  }, [])

  const setBranchStage = useCallback((branch: DemoDocumentType, stageId: DemoWorkflowStageId) => {
    setState((current) => {
      if (
        current.currentBranchStage[branch] === stageId &&
        current.branchProgress[branch].currentStageId === stageId
      ) {
        return current
      }

      return {
        ...current,
        currentBranchStage: {
          ...current.currentBranchStage,
          [branch]: stageId,
        },
        branchProgress: {
          ...current.branchProgress,
          [branch]: {
            ...current.branchProgress[branch],
            currentStageId: stageId,
          },
        },
      }
    })
  }, [])

  const markStageComplete = useCallback((branch: DemoDocumentType, stageId: DemoWorkflowStageId) => {
    setState((current) => {
      if (current.branchProgress[branch].completedStageIds.includes(stageId)) {
        return current
      }

      return {
        ...current,
        branchProgress: {
          ...current.branchProgress,
          [branch]: {
            ...current.branchProgress[branch],
            completedStageIds: Array.from(
              new Set([...current.branchProgress[branch].completedStageIds, stageId]),
            ),
          },
        },
      }
    })
  }, [])

  const selectSourceKp = useCallback((caseId: string | null) => {
    setState((current) => ({
      ...current,
      selectedDocumentType: 'tz',
      selectedSourceKpId: caseId,
      selectedSectionId: getDefaultSectionId('tz'),
      recentOperations: appendOperation(
        current,
        createOperation(
          'tz',
          caseId ? 'Выбрана рабочая основа' : 'ТЗ собирается без основы',
          caseId
            ? 'Для сценария ТЗ выбрана нейтральная база из подготовленного КП.'
            : 'Сценарий ТЗ продолжает работу без заранее выбранной основы.',
        ),
      ),
    }))
  }, [])

  const updateRequestSummary = useCallback((branch: DemoDocumentType, value: string) => {
    setState((current) => {
      const demoCase = current.cases[0]
      if (!demoCase) {
        return current
      }

      if (branch === 'kp' && demoCase.kpRequestSummary === value) {
        return current
      }

      if (branch === 'tz' && demoCase.tzRequestSummary === value) {
        return current
      }

      return sanitizeDemoState({
        ...current,
        cases: [
          branch === 'kp'
            ? { ...demoCase, kpRequestSummary: removeFastenersLine(value) }
            : { ...demoCase, tzRequestSummary: value },
        ],
      })
    })
  }, [])

  const updateStageNotes = useCallback((branch: DemoDocumentType, value: string) => {
    setState((current) => {
      const demoCase = current.cases[0]
      if (!demoCase) {
        return current
      }

      if (branch === 'kp' && demoCase.kpContextNotes === value) {
        return current
      }

      if (branch === 'tz' && demoCase.tzTechnicalNotes === value) {
        return current
      }

      return sanitizeDemoState({
        ...current,
        cases: [
          branch === 'kp'
            ? { ...demoCase, kpContextNotes: removeFastenersLine(value) }
            : { ...demoCase, tzTechnicalNotes: value },
        ],
      })
    })
  }, [])

  const updateMeasurement = useCallback((measurementId: string, value: string) => {
    setState((current) => {
      const demoCase = current.cases[0]
      const targetMeasurement = demoCase?.tzMeasurements.find((measurement) => measurement.id === measurementId)

      if (!demoCase || !targetMeasurement || targetMeasurement.value === value) {
        return current
      }

      return {
        ...current,
        cases: [
          {
            ...demoCase,
            tzMeasurements: demoCase.tzMeasurements.map((measurement) =>
              measurement.id === measurementId ? { ...measurement, value } : measurement,
            ),
          },
        ],
      }
    })
  }, [])

  const resetDemo = useCallback(() => {
    const nextState = createInitialDemoState()
    window.localStorage.setItem(storageKey, JSON.stringify(nextState))
    setState(nextState)
  }, [])

  const value = useMemo<DemoContextValue>(
    () => ({
      state,
      startPipeline,
      applyDemoVariant,
      applyKpOfferTable,
      startRun,
      abortRun,
      completeRun,
      updateField,
      updateOfferItem,
      addOfferItem,
      deleteOfferItem,
      updateSectionStat,
      selectDocumentType,
      selectSection,
      focusIssue,
      openSectionFromSource,
      updateExportField,
      startExportGeneration,
      setExportProgress,
      completeExportGeneration,
      showDownloadMessage,
      resetExportGeneration,
      setBranchStage,
      markStageComplete,
      selectSourceKp,
      updateRequestSummary,
      updateStageNotes,
      updateMeasurement,
      resetDemo,
    }),
    [
      state,
      startPipeline,
      applyDemoVariant,
      applyKpOfferTable,
      startRun,
      abortRun,
      completeRun,
      updateField,
      updateOfferItem,
      addOfferItem,
      deleteOfferItem,
      updateSectionStat,
      selectDocumentType,
      selectSection,
      focusIssue,
      openSectionFromSource,
      updateExportField,
      startExportGeneration,
      setExportProgress,
      completeExportGeneration,
      showDownloadMessage,
      resetExportGeneration,
      setBranchStage,
      markStageComplete,
      selectSourceKp,
      updateRequestSummary,
      updateStageNotes,
      updateMeasurement,
      resetDemo,
    ],
  )

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = useContext(DemoContext)

  if (!context) {
    throw new Error('useDemo must be used inside DemoProvider')
  }

  return context
}
