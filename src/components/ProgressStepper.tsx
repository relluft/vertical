import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { stagePath } from '../lib/routes'
import { cn } from '../lib/utils'
import { getWorkflowStages } from '../lib/workflow'
import type { DemoDocumentType, DemoWorkflowStageId } from '../types/demo'

export function ProgressStepper({
  branch,
  caseId,
  runId,
  draftId,
  exportId,
  currentStageId,
  completedStageIds,
}: {
  branch: DemoDocumentType
  caseId: string
  runId: string
  draftId: string
  exportId: string
  currentStageId: DemoWorkflowStageId
  completedStageIds: DemoWorkflowStageId[]
}) {
  const stages = getWorkflowStages(branch)
  const visibleCompletedCount = stages.filter((stage) =>
    completedStageIds.includes(stage.id),
  ).length

  return (
    <div className="frosted panel-outline rounded-[18px] px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-600)]">
            Этапы
          </div>
          <div className="metal-pill rounded-full px-2.5 py-1 text-[10px] font-semibold text-[var(--ink-700)]">
            {visibleCompletedCount}/{stages.length}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {stages.map((stage, index) => {
            const isActive = currentStageId === stage.id
            const isCompleted = completedStageIds.includes(stage.id)
            const Icon = stage.icon

            return (
              <motion.div
                layout
                key={stage.id}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="min-w-[106px] flex-1"
              >
                <Link
                  to={stagePath(branch, caseId, runId, draftId, exportId, stage.id)}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-full border bg-white px-2.5 text-xs font-semibold transition-colors duration-300',
                    isActive && 'executive-highlight',
                    isCompleted && !isActive && 'border-[var(--ink-950)]',
                    !isActive && !isCompleted && 'border-[var(--border-soft)] text-[var(--ink-700)]',
                  )}
                >
                  <motion.div
                    layout
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
                      isActive
                        ? 'border-[var(--ink-950)] bg-white text-[var(--ink-950)]'
                        : isCompleted
                          ? 'border-[var(--ink-950)] bg-[var(--ink-950)] text-white'
                          : 'border-[var(--border-soft)] text-[var(--ink-700)]',
                    )}
                  >
                    <Icon size={12} />
                  </motion.div>
                  <span className="truncate text-[var(--ink-950)]">{stage.shortLabel}</span>
                  <span
                    className={cn(
                      'ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                      isCompleted
                        ? 'bg-[var(--ink-950)] text-white'
                        : isActive
                          ? 'bg-[var(--surface-muted)] text-[var(--ink-950)]'
                          : 'bg-[var(--surface-muted)] text-[var(--ink-600)]',
                    )}
                  >
                    {index + 1}
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
