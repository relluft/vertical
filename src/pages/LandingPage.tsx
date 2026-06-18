import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTransition } from '../components/PageTransition'
import { buttonStyles } from '../components/ui'
import { brandConfig } from '../config/brand'
import { branchSelectionPath } from '../lib/routes'

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1520px] flex-col px-4 py-5 md:px-6 lg:px-8">
        <main className="flex flex-1 items-center justify-center py-8 md:py-12">
          <PageTransition className="frosted panel-outline relative w-full max-w-6xl overflow-hidden rounded-[44px] px-6 py-12 md:px-10 md:py-16 lg:px-14 lg:py-20">
            <div className="relative mx-auto max-w-4xl text-center">

              <h1 className="display-title mt-7 text-6xl text-[var(--ink-950)] md:text-8xl">
                {brandConfig.companyName}
              </h1>

              <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[var(--ink-800)] md:text-[1.18rem] md:leading-9">
                Товарное КП из вводных данных - быстро и готово к согласованию.
              </p>



              <Link
                to={branchSelectionPath()}
                className={`mt-10 ${buttonStyles('primary')} px-8 py-3.5 text-base`}
              >
                Перейти в рабочее пространство
                <ArrowRight size={18} />
              </Link>
            </div>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
