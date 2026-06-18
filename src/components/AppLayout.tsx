import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { FileInput, FileSpreadsheet, Send } from 'lucide-react'
import { useDemo } from '../context/DemoContext'
import { branchSelectionPath, caseStagePath, draftPath, exportPath } from '../lib/routes'
import { type DemoDocumentType, type DemoWorkflowStageId } from '../types/demo'
import { ProgressStepper } from './ProgressStepper'
import { ResetDemoButton } from './ResetDemoButton'
import { WorkspaceSidebar } from './WorkspaceSidebar'

function resolveStageId(pathname: string): DemoWorkflowStageId {
  if (pathname.includes('/runs/')) {
    return 'run'
  }

  if (pathname.includes('/drafts/')) {
    return 'editor'
  }

  if (pathname.includes('/export/')) {
    return 'export'
  }

  const lastSegment = pathname.split('/').at(-1)
  if (
    lastSegment === 'source' ||
    lastSegment === 'need' ||
    lastSegment === 'materials' ||
    lastSegment === 'comments'
  ) {
    return lastSegment
  }

  return 'need'
}

export function AppLayout() {
  const location = useLocation()
  const { branch, caseId, runId, draftId, exportId } = useParams()
  const {
    state: { cases, run, draft, branchProgress, branchLaunch },
    resetDemo,
  } = useDemo()

  const isValidBranch = branch === 'kp'
  const activeBranch = (isValidBranch ? branch : 'kp') as DemoDocumentType
  const activeCase =
    cases.find((demoCase) => demoCase.id === caseId) ??
    cases.find((demoCase) => demoCase.runId === runId) ??
    cases.find((demoCase) => demoCase.draftId === draftId) ??
    cases.find((demoCase) => demoCase.exportId === exportId) ??
    cases.find((demoCase) => demoCase.isAnchor) ??
    cases[0]
  const activeLocationStage = resolveStageId(location.pathname)

  if (!isValidBranch) {
    return <Navigate to={branchSelectionPath()} replace />
  }

  if (!branchLaunch[activeBranch].started) {
    return <Navigate to={branchSelectionPath()} replace />
  }

  if (!activeCase) {
    return <Navigate to={branchSelectionPath()} replace />
  }

  const sidebarItems = [
    {
      to: caseStagePath(activeBranch, activeCase.id, 'need'),
      label: 'Вводные',
      hint: 'заявка или файл',
      icon: FileInput,
    },
    {
      to: draftPath(activeBranch, draft.id),
      label: 'Таблица КП',
      hint: 'позиции и цены',
      icon: FileSpreadsheet,
    },
    {
      to: exportPath(activeBranch, activeCase.exportId),
      label: 'Финальное КП',
      hint: 'готовый документ',
      icon: Send,
    },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden">

      <div className="relative mx-auto flex min-h-screen w-full max-w-none items-start gap-3 px-3 py-3 md:px-4 lg:px-5">
        <div className="hidden w-[190px] shrink-0 xl:block">
          <WorkspaceSidebar items={sidebarItems} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-wrap items-start justify-end gap-2">
            <div className="min-w-[260px] flex-1">
              <ProgressStepper
                branch={activeBranch}
                caseId={activeCase.id}
                runId={run.id}
                draftId={draft.id}
                exportId={activeCase.exportId}
                currentStageId={activeLocationStage}
                completedStageIds={branchProgress[activeBranch].completedStageIds}
              />
            </div>
            <ResetDemoButton onReset={resetDemo} />
          </div>

          <main key={location.pathname} className="relative w-full flex-1 pb-4">
            <Outlet key={location.pathname} />
          </main>
        </div>
      </div>
    </div>
  )
}
