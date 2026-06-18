import {
  ClipboardPenLine,
  FileCog,
  FileOutput,
  FileSpreadsheet,
  MessageSquareQuote,
  ScanSearch,
  ScrollText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DemoDocumentType, DemoWorkflowStageId } from '../types/demo'

export interface WorkflowStageDefinition {
  id: DemoWorkflowStageId
  label: string
  shortLabel: string
  description: string
  icon: LucideIcon
}

const workflowDefinitions: Record<DemoDocumentType, WorkflowStageDefinition[]> = {
  kp: [
    {
      id: 'need',
      label: 'Потребность',
      shortLabel: 'Потребность',
      description: 'Загружаем файл или вводим текст с товарными позициями.',
      icon: ClipboardPenLine,
    },
    {
      id: 'editor',
      label: 'Рабочая таблица',
      shortLabel: 'Таблица',
      description: 'Проверяем товары с Вертикаль, цены, статусы, маржу и комментарии.',
      icon: FileSpreadsheet,
    },
    {
      id: 'export',
      label: 'Финальное КП',
      shortLabel: 'Финал',
      description:
        'Формируем чистый документ после проверки рабочей таблицы.',
      icon: FileOutput,
    },
  ],
  tz: [
    {
      id: 'source',
      label: 'Основа из КП',
      shortLabel: 'Основа',
      description: 'Выбираем рабочую основу для будущего технического задания.',
      icon: ScrollText,
    },
    {
      id: 'need',
      label: 'Потребность и адаптация',
      shortLabel: 'Адаптация',
      description: 'Переводим задачу в формат технического сценария и уточняем цель проекта.',
      icon: ClipboardPenLine,
    },
    {
      id: 'comments',
      label: 'Замеры и вводные',
      shortLabel: 'Замеры',
      description: 'Фиксируем измеримые параметры и свободные технические вводные.',
      icon: MessageSquareQuote,
    },
    {
      id: 'run',
      label: 'Сборка ТЗ',
      shortLabel: 'Сборка',
      description: 'Показываем, как из введённых данных формируется обезличенный черновик ТЗ.',
      icon: ScanSearch,
    },
    {
      id: 'editor',
      label: 'Рабочее пространство',
      shortLabel: 'Пространство',
      description: 'Проверяем черновик, уточняем формулировки и готовим итоговый пакет.',
      icon: FileCog,
    },
    {
      id: 'export',
      label: 'Экспорт',
      shortLabel: 'Экспорт',
      description: 'Добавляем финальные реквизиты и подготавливаем документ в нужном формате.',
      icon: FileOutput,
    },
  ],
}

export function getWorkflowStages(branch: DemoDocumentType) {
  return workflowDefinitions[branch]
}

export function getWorkflowStage(branch: DemoDocumentType, stageId: DemoWorkflowStageId) {
  return workflowDefinitions[branch].find((stage) => stage.id === stageId) ?? workflowDefinitions[branch][0]
}

export function getBranchLabel(branch: DemoDocumentType) {
  return branch === 'kp' ? 'Коммерческое предложение' : 'Техническое задание'
}

export function getBranchShortLabel(branch: DemoDocumentType) {
  return branch === 'kp' ? 'КП' : 'ТЗ'
}
