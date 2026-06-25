import { useState } from 'react'
import { FileText } from 'lucide-react'
import { renderTemplate } from '../lib/utils'
import type {
  DemoDocumentType,
  DemoOfferTable,
  DraftCellAnnotation,
  DraftCellId,
  DraftField,
  DraftSection,
  OfferItemEditableField,
} from '../types/demo'
import { KpOfferTableEditor } from './KpOfferTableEditor'
import { Panel, StatusPill } from './ui'

const documentLabels: Record<DemoDocumentType, string> = {
  kp: 'Коммерческое предложение',
  tz: 'Техническое задание',
}

export function DocumentPreview({
  documentType,
  sections,
  offerTable,
  fields,
  cellAnnotations = {},
  pipelineName,
  selectedSectionId,
  onSelectSection,
  onUpdateOfferItem,
  onAddOfferItem,
  onDeleteOfferItem,
  onUpdateField,
  onUpdateSectionStat,
  readOnly = false,
}: {
  documentType: DemoDocumentType
  sections: DraftSection[]
  offerTable?: DemoOfferTable | null
  fields: DraftField[]
  cellAnnotations?: Partial<Record<DraftCellId, DraftCellAnnotation>>
  pipelineName: string
  selectedSectionId: string
  onSelectSection?: (sectionId: string) => void
  onUpdateOfferItem?: (itemId: string, field: OfferItemEditableField, value: string) => void
  onAddOfferItem?: () => void
  onDeleteOfferItem?: (itemId: string) => void
  onUpdateField?: (fieldId: DraftField['id'], value: string) => void
  onUpdateSectionStat?: (sectionId: string, statIndex: number, value: string) => void
  readOnly?: boolean
}) {
  const [editingStat, setEditingStat] = useState<{ sectionId: string; statIndex: number } | null>(
    null,
  )
  const [editingValue, setEditingValue] = useState('')

  if (documentType === 'kp') {
    return (
      <KpOfferTableEditor
        offerTable={offerTable ?? null}
        fields={fields}
        cellAnnotations={cellAnnotations}
        editable={!readOnly}
        onUpdateOfferItem={onUpdateOfferItem}
        onAddOfferItem={onAddOfferItem}
        onDeleteOfferItem={readOnly ? undefined : onDeleteOfferItem}
        onUpdateField={onUpdateField}
      />
    )
  }

  const filledFields: DraftField[] = []
  const canEditStats = !readOnly && Boolean(onUpdateSectionStat)

  function beginStatEdit(sectionId: string, statIndex: number, value: string) {
    if (!canEditStats) {
      return
    }

    setEditingStat({ sectionId, statIndex })
    setEditingValue(value)
  }

  function stopStatEdit() {
    setEditingStat(null)
    setEditingValue('')
  }

  function commitStatEdit() {
    if (!editingStat || !onUpdateSectionStat) {
      stopStatEdit()
      return
    }

    onUpdateSectionStat(editingStat.sectionId, editingStat.statIndex, editingValue)
    stopStatEdit()
  }

  return (
    <div className="document-paper rounded-[34px] border border-[var(--border-soft)] p-6 md:p-8">
      <div className="relative flex flex-col gap-4 border-b border-[var(--border-soft)] pb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="display-section-title text-4xl text-[var(--ink-950)] md:text-[2.6rem]">
              {documentLabels[documentType]}
            </h2>
          </div>
          <StatusPill tone={readOnly ? 'ready' : 'progress'}>
            {readOnly ? 'Режим согласования' : 'Рабочая версия'}
          </StatusPill>
        </div>

        {filledFields.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filledFields.map((field) => (
              <div key={field.id} className="executive-card rounded-[22px] px-4 py-3">
                <div className="relative">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-500)]">
                    {field.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--ink-950)]">
                    {field.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-5">
        {sections.length ? (
          sections.map((section) => (
            <Panel
              key={section.id}
              onClick={() => onSelectSection?.(section.id)}
              tone={selectedSectionId === section.id ? 'highlight' : 'default'}
              className={`${onSelectSection ? 'cursor-pointer' : 'cursor-default'} rounded-[28px] bg-white border border-[var(--border-soft)] p-5 transition-all`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[var(--ink-500)]">
                    <FileText size={16} />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                      {documentLabels[documentType]}
                    </span>
                  </div>
                  <h3 className="display-section-title text-3xl text-[var(--ink-950)]">
                    {section.title}
                  </h3>
                  <p className="max-w-3xl text-sm leading-7 text-[var(--ink-700)]">
                    {section.summary}
                  </p>
                </div>
                {section.stats ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {section.stats.map((stat, statIndex) => {
                      const isEditing =
                        editingStat?.sectionId === section.id &&
                        editingStat.statIndex === statIndex
                      const renderedValue = renderTemplate(stat.value, fields, { pipelineName })

                      return (
                        <div
                          key={`${section.id}-${stat.label}`}
                          className="executive-card rounded-[20px] px-4 py-3"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="relative">
                            <div className="text-xs text-[var(--ink-500)]">{stat.label}</div>
                            {isEditing ? (
                              <textarea
                                autoFocus
                                rows={2}
                                value={editingValue}
                                onChange={(event) => setEditingValue(event.target.value)}
                                onBlur={commitStatEdit}
                                onKeyDown={(event) => {
                                  if (event.key === 'Escape') {
                                    event.preventDefault()
                                    stopStatEdit()
                                  }

                                  if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault()
                                    commitStatEdit()
                                  }
                                }}
                                className="executive-input mt-2 min-h-[72px] w-full resize-none px-3 py-2 text-sm font-semibold leading-6 text-[var(--ink-950)]"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => beginStatEdit(section.id, statIndex, stat.value)}
                                className={`mt-1 w-full text-left text-sm font-semibold text-[var(--ink-950)] ${
                                  canEditStats ? 'cursor-text' : 'cursor-default'
                                }`}
                              >
                                {renderedValue}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 space-y-3 text-[15px] leading-8 text-[var(--ink-800)]">
                {section.content.map((paragraph) => (
                  <p key={`${section.id}-${paragraph.slice(0, 12)}`}>
                    {renderTemplate(paragraph, fields, { pipelineName })}
                  </p>
                ))}
              </div>
            </Panel>
          ))
        ) : (
          <Panel className="surface-dashed rounded-[24px] p-6 text-sm leading-7 text-[var(--ink-700)]">
            Пока пусто.
          </Panel>
        )}
      </div>
    </div>
  )
}
