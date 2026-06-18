import { RotateCcw } from 'lucide-react'

export function ResetDemoButton({
  onReset,
  className = '',
}: {
  onReset: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onReset}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-4 text-sm font-semibold text-[var(--ink-950)] shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:bg-[rgba(41,41,41,0.04)] ${className}`}
    >
      <RotateCcw size={15} />
      Сброс демо
    </button>
  )
}
