/* eslint-disable react-refresh/only-export-components */
import { motion } from 'framer-motion'
import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '../lib/utils'

export function buttonStyles(variant: 'primary' | 'secondary' | 'ghost' = 'primary') {
  return cn(
    'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-4 py-2.5 text-sm font-medium tracking-[-0.01em] transition-all duration-300 ease-[var(--ease-premium)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(214,194,162,0.18)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page-bg)]',
    variant === 'primary' &&
      'border border-[var(--border-strong)] bg-transparent text-[var(--ink-950)] shadow-none hover:border-[var(--ink-950)] hover:bg-[rgba(41,41,41,0.04)]',
    variant === 'secondary' &&
      'border border-[rgba(232,221,204,0.1)] bg-[rgba(255,248,234,0.03)] text-[var(--ink-950)] shadow-[inset_0_1px_0_rgba(255,248,234,0.02)] hover:-translate-y-0.5 hover:border-[rgba(232,221,204,0.16)] hover:bg-[rgba(255,248,234,0.05)]',
    variant === 'ghost' &&
      'border border-transparent bg-transparent text-[var(--ink-700)] hover:-translate-y-0.5 hover:border-[rgba(232,221,204,0.1)] hover:bg-[rgba(255,248,234,0.03)] hover:text-[var(--ink-950)]',
  )
}

export const fieldStyles =
  'executive-input px-4 py-3 text-sm leading-7 text-[var(--ink-950)]'

export const interactiveCardStyles =
  'executive-card panel-outline rounded-[28px] p-5 text-left'

export function Button({
  className,
  variant = 'primary',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  return <button type={type} className={cn(buttonStyles(variant), className)} {...props} />
}

export function Panel({
  tone = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: 'default' | 'highlight' | 'gold' }) {
  const toneClasses = {
    default: '',
    highlight: 'executive-highlight',
    gold: 'gold-highlight',
  }[tone]

  return (
    <div
      className={cn(
        'frosted panel-outline rounded-[32px] p-5 text-[var(--ink-800)]',
        toneClasses,
        className,
      )}
      {...props}
    />
  )
}

export function Eyebrow({ children }: PropsWithChildren) {
  return (
    <span className="metal-pill inline-flex items-center rounded-full px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--ink-700)]">
      {children}
    </span>
  )
}

export function StatusPill({
  tone,
  children,
}: PropsWithChildren<{ tone: 'ready' | 'progress' | 'attention' | 'high' | 'medium' | 'low' }>) {
  const toneClasses = {
    ready:
      'border-[var(--border-strong)] bg-white text-[var(--ink-950)]',
    progress:
      'border-[var(--border-strong)] bg-white text-[var(--ink-950)]',
    attention:
      'border-[rgba(186,142,88,0.2)] bg-[rgba(186,142,88,0.09)] text-[var(--brand-700)]',
    high:
      'border-rose-500/18 bg-[rgba(88,36,42,0.22)] text-rose-100',
    medium:
      'border-[rgba(170,124,72,0.18)] bg-[rgba(170,124,72,0.1)] text-[var(--brand-700)]',
    low: 'border-[var(--border-soft)] bg-white text-[var(--ink-700)]',
  }[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center text-center rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-[0.01em]',
        toneClasses,
      )}
    >
      {children}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <Panel className={cn('rounded-[28px] px-5 py-5', className)}>
      <div className="flex min-h-[126px] flex-col justify-between gap-4">
        <span className="text-[11px] uppercase tracking-[0.24em] text-[var(--ink-600)]">{label}</span>
        <div className="text-xl font-semibold leading-tight text-[var(--ink-950)]">{value}</div>
      </div>
    </Panel>
  )
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full border border-[rgba(255,248,234,0.04)] bg-[rgba(255,248,234,0.05)]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(value, 1)) * 100}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
        className="relative h-full rounded-full bg-[var(--ink-950)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)] animate-[shimmer_2s_infinite]" />
      </motion.div>
    </div>
  )
}
