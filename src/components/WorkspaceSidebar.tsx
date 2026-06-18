import type { LucideIcon } from 'lucide-react'
import { Home } from 'lucide-react'
import { motion } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { branchSelectionPath } from '../lib/routes'
import { cn } from '../lib/utils'

export interface WorkspaceSidebarItem {
  to: string
  label: string
  hint: string
  icon: LucideIcon
}

export function WorkspaceSidebar({
  items = [],
}: {
  items?: WorkspaceSidebarItem[]
}) {
  const links: WorkspaceSidebarItem[] = [
    {
      to: branchSelectionPath(),
      label: 'Рабочая область',
      hint: 'старт сценария',
      icon: Home,
    },
    ...items,
  ]

  return (
    <aside className="frosted panel-outline sticky top-3 flex h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-[22px] px-3 py-4">
      <div className="relative z-10 px-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
          Навигация
        </div>
      </div>

      <nav aria-label="Основная навигация" className="relative z-10 mt-4 flex flex-col gap-1.5">
        {links.map((item, index) => {
          const Icon = item.icon

          return (
            <motion.div
              key={`${item.label}-${item.to}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.025 }}
            >
              <NavLink
                to={item.to}
                end={item.to === branchSelectionPath()}
                className={({ isActive }) =>
                  cn(
                    'group flex min-h-12 items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-white',
                    isActive
                      ? 'border-[var(--ink-950)] bg-[var(--ink-950)] text-white shadow-[var(--shadow-soft)] hover:bg-[var(--ink-950)]'
                      : 'border-transparent bg-transparent text-[var(--ink-950)]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition',
                        isActive
                          ? 'border-white/20 bg-white/10 text-white'
                          : 'border-[var(--border-soft)] bg-white text-[var(--ink-700)] group-hover:text-[var(--ink-950)]',
                      )}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                      <span
                        className={cn(
                          'mt-0.5 block truncate text-[11px]',
                          isActive ? 'text-white/70' : 'text-[var(--ink-600)]',
                        )}
                      >
                        {item.hint}
                      </span>
                    </span>
                  </>
                )}
              </NavLink>
            </motion.div>
          )
        })}
      </nav>
    </aside>
  )
}
