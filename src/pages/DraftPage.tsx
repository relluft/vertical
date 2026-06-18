import { AlertCircle, ArrowRight, Link2, PencilLine, Sparkles } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { DocumentPreview } from '../components/DocumentPreview'
import { PageTransition } from '../components/PageTransition'
import { Button, Eyebrow, Panel, StatusPill, buttonStyles } from '../components/ui'
import { useDemo } from '../context/DemoContext'
import { exportPath } from '../lib/routes'
import { getBranchLabel } from '../lib/workflow'
import type { DemoDocumentType, DemoPageKey } from '../types/demo'

function resolveDraftPageKey(branch: DemoDocumentType): DemoPageKey {
  return branch === 'kp' ? 'kp-draft' : 'tz-draft'
}

function formatConfidence(confidence: 'high' | 'medium') {
  return confidence === 'high' ? 'Высокая' : 'Средняя'
}

export function DraftPage() {
  const { branch, draftId } = useParams()
  const {
    state: {
      cases,
      draft,
      selectedSectionId,
      focusedIssueId,
      branchLaunch,
      demoAppliedByPage,
    },
    applyDemoVariant,
    updateField,
    updateOfferItem,
    addOfferItem,
    deleteOfferItem,
    updateSectionStat,
    selectSection,
    focusIssue,
    openSectionFromSource,
  } = useDemo()

  if (branch !== 'kp' && branch !== 'tz') {
    return <Navigate to="/workspace" replace />
  }

  const activeBranch = branch as DemoDocumentType
  const demoCase = cases.find((demoCase) => demoCase.id === draft.caseId) ?? cases[0]
  const pageKey = resolveDraftPageKey(activeBranch)
  const hasDemoVariant = !!demoAppliedByPage[pageKey]
  const pipelineName = branchLaunch[activeBranch].pipelineName
  const visibleSections = hasDemoVariant
    ? draft.sections.filter((section) => section.documentType === activeBranch)
    : []

  if (!demoCase || draftId !== draft.id) {
    return null
  }

  if (activeBranch === 'kp') {
    return (
      <PageTransition className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Eyebrow>{getBranchLabel(activeBranch)} / Рабочая таблица</Eyebrow>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              to={exportPath(activeBranch, demoCase.exportId)}
              className={`${buttonStyles('primary')} px-4 py-2.5 text-sm`}
            >
              Перейти к финальному КП
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <DocumentPreview
          documentType={activeBranch}
          sections={visibleSections}
          offerTable={draft.offerTable}
          fields={draft.fields}
          cellAnnotations={draft.cellAnnotations}
          pipelineName={pipelineName}
          selectedSectionId={selectedSectionId}
          onUpdateOfferItem={updateOfferItem}
          onAddOfferItem={addOfferItem}
          onDeleteOfferItem={deleteOfferItem}
          onUpdateField={updateField}
          onUpdateSectionStat={updateSectionStat}
        />
      </PageTransition>
    )
  }

  return (
    <PageTransition className="space-y-6">
      <Panel tone="highlight" className="rounded-[34px] p-6 md:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px]">
          <div>
            <Eyebrow>{getBranchLabel(activeBranch)} / Рабочее пространство</Eyebrow>
            <h1 className="display-title mt-5 text-5xl text-[var(--ink-950)] md:text-6xl">
              Рабочее пространство
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-[var(--ink-800)] md:text-base">
              Здесь можно просматривать структуру документа, переключаться по разделам и править
              ключевые значения прямо в содержимом.
            </p>
          </div>

          <div className="executive-card executive-highlight rounded-[30px] p-5">
            <div className="relative">
              <div className="text-sm text-[var(--ink-700)]">Состояние пространства</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--ink-950)]">
                {hasDemoVariant ? 'Черновик готов' : 'Рабочая область пуста'}
              </div>
              <Button
                className="mt-5 w-full justify-center"
                variant="secondary"
                onClick={() => applyDemoVariant(pageKey)}
              >
                <Sparkles size={16} />
                {hasDemoVariant ? 'Обновить пример' : 'Заполнить примером'}
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[240px,minmax(0,1fr),320px]">
        <Panel className="rounded-[32px] p-4">
          <div className="flex items-center gap-2">
            <PencilLine size={17} className="text-[var(--brand-700)]" />
            <div className="font-semibold text-[var(--ink-950)]">Структура документа</div>
          </div>
          {visibleSections.length ? (
            <div className="mt-4 space-y-2">
              {visibleSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => selectSection(section.id)}
                  className={`w-full rounded-[20px] px-4 py-3 text-left ${
                    selectedSectionId === section.id
                      ? 'executive-card executive-highlight'
                      : 'executive-card'
                  }`}
                >
                  <div className="relative">
                    <div className="font-semibold text-[var(--ink-950)]">{section.title}</div>
                    <div className="mt-1 text-sm leading-6 text-[var(--ink-700)]">
                      {section.summary}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="surface-dashed mt-4 rounded-[22px] p-4 text-sm leading-7 text-[var(--ink-700)]">
              Пусто.
            </div>
          )}
        </Panel>

        <DocumentPreview
          documentType={activeBranch}
          sections={visibleSections}
          offerTable={null}
          fields={draft.fields}
          pipelineName={pipelineName}
          selectedSectionId={selectedSectionId}
          onSelectSection={visibleSections.length ? selectSection : undefined}
          onUpdateSectionStat={updateSectionStat}
        />

        <div className="space-y-6">
          <Panel className="rounded-[32px] p-5">
            <div className="flex items-center gap-2">
              <AlertCircle size={17} className="text-[var(--brand-700)]" />
              <div className="font-semibold text-[var(--ink-950)]">Замечания проверки</div>
            </div>
            <div className="mt-4 space-y-3">
              {hasDemoVariant ? (
                draft.issues
                  .filter((issue) => issue.relatedSectionId.startsWith(activeBranch))
                  .map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => focusIssue(issue)}
                      className={`w-full rounded-[22px] px-4 py-4 text-left ${
                        focusedIssueId === issue.id
                          ? 'executive-card executive-highlight'
                          : 'executive-card'
                      }`}
                    >
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold text-[var(--ink-950)]">{issue.title}</div>
                          <StatusPill tone={issue.severity}>
                            {issue.severity === 'low' ? 'Низкий приоритет' : 'Нужна проверка'}
                          </StatusPill>
                        </div>
                        <div className="mt-2 text-sm leading-7 text-[var(--ink-800)]">
                          {issue.summary}
                        </div>
                      </div>
                    </button>
                  ))
              ) : (
                <div className="surface-dashed mt-4 rounded-[22px] px-4 py-4 text-sm text-[var(--ink-700)]">
                  Пусто.
                </div>
              )}
            </div>
          </Panel>

          <Panel className="rounded-[32px] p-5">
            <div className="flex items-center gap-2">
              <Link2 size={17} className="text-[var(--brand-700)]" />
              <div className="font-semibold text-[var(--ink-950)]">Источники и обоснование</div>
            </div>
            <div className="mt-4 space-y-3">
              {hasDemoVariant ? (
                draft.sources
                  .filter((source) => source.relatedSectionId.startsWith(activeBranch))
                  .map((source) => (
                    <button
                      key={source.id}
                      onClick={() => openSectionFromSource(source.relatedSectionId)}
                      className="executive-card w-full rounded-[22px] px-4 py-4 text-left"
                    >
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold text-[var(--ink-950)]">{source.label}</div>
                          <StatusPill tone={source.confidence === 'high' ? 'ready' : 'attention'}>
                            {formatConfidence(source.confidence)}
                          </StatusPill>
                        </div>
                        <div className="mt-2 text-sm leading-7 text-[var(--ink-800)]">
                          {source.excerpt}
                        </div>
                      </div>
                    </button>
                  ))
              ) : (
                <div className="surface-dashed rounded-[22px] px-4 py-4 text-sm text-[var(--ink-700)]">
                  Пусто.
                </div>
              )}
            </div>
          </Panel>

          <Link
            to={exportPath(activeBranch, demoCase.exportId)}
            className={`${buttonStyles('primary')} w-full px-4 py-3 text-sm`}
          >
            Перейти к экспорту
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </PageTransition>
  )
}
