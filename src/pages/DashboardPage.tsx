import { motion } from 'framer-motion'
import { ArrowRight, FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { ResetDemoButton } from '../components/ResetDemoButton'
import { WorkspaceSidebar } from '../components/WorkspaceSidebar'
import { Panel, buttonStyles } from '../components/ui'
import { useDemo } from '../context/DemoContext'
import { defaultCaseStagePath } from '../lib/routes'

export function DashboardPage() {
  const navigate = useNavigate()
  const {
    state: { cases },
    startPipeline,
    resetDemo,
  } = useDemo()

  const anchorCase = cases.find((demoCase) => demoCase.isAnchor) ?? cases[0]

  function handleStart() {
    if (!anchorCase) {
      return
    }

    startPipeline('kp', '')
    navigate(defaultCaseStagePath('kp', anchorCase.id))
  }

  return (
    <div className="relative min-h-screen overflow-hidden">

      <div className="relative mx-auto flex min-h-screen w-full max-w-none gap-3 px-3 py-3 md:px-4 lg:px-5">
        <div className="hidden w-[190px] shrink-0 xl:block">
          <WorkspaceSidebar />
        </div>

        <ResetDemoButton onReset={resetDemo} className="absolute right-5 top-3 z-20" />

        <main className="flex min-w-0 flex-1 items-start justify-center py-6 md:py-10">
          <PageTransition className="w-full space-y-6">
            <Panel className="rounded-[38px] px-6 py-7 md:px-8 md:py-8 border-none bg-transparent shadow-none">
              <div className="flex flex-col items-center text-center pb-4">
                <div className="max-w-4xl flex flex-col items-center text-center">
                  <h1 className="display-title mt-6 text-5xl text-[var(--ink-950)] md:text-7xl">
                    Формирование документа по входным данным
                  </h1>
                </div>
              </div>
            </Panel>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.15 },
                },
              }}
              className="mt-2 grid grid-cols-1 gap-6"
            >
              <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                <Panel className="flex h-full flex-col justify-between rounded-[36px] p-7 md:p-8">
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="accent-icon-block-soft rounded-[24px] p-4">
                        <FileSpreadsheet size={30} />
                      </div>
                    </div>

                    <h2 className="display-section-title mt-7 text-3xl text-[var(--ink-950)] md:text-4xl">
                      Подготовка товарного КП
                    </h2>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--ink-800)]">
                      Прямой путь от потребности заказчика к рабочей таблице и финальному
                      коммерческому предложению.
                    </p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStart}
                    className={`mt-8 inline-flex ${buttonStyles('primary')} px-6 py-3 text-base`}
                  >
                    Создать КП
                    <ArrowRight size={18} />
                  </motion.button>
                </Panel>
              </motion.div>

            </motion.div>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
