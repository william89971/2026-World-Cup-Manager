import type { ReactNode } from 'react'
import type { Form } from '../../game/career'

/** Current-form indicator: ↑ good form, → neutral, ↓ poor form. */
export function FormArrow({ form }: { form: Form }) {
  if (form === null) return <span className="text-steel-600 w-4 text-center text-xs">·</span>
  const [glyph, cls, label] =
    form === 'up' ? ['▲', 'form-up', 'In form'] : form === 'down' ? ['▼', 'form-down', 'Poor form'] : ['▶', 'form-flat', 'Steady']
  return (
    <span title={label} className={`w-4 text-center text-[10px] font-black ${cls}`}>
      {glyph}
    </span>
  )
}

export function MoraleBar({ value, className = '' }: { value: number; className?: string }) {
  const color = value >= 70 ? 'bg-accent-500' : value >= 45 ? 'bg-warn-500' : 'bg-danger-500'
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-navy-700 ${className}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, value)}%` }} />
    </div>
  )
}

export function StatRow({
  label,
  home,
  away,
  homeColor = 'var(--color-accent-500)',
}: {
  label: string
  home: number
  away: number
  homeColor?: string
}) {
  const total = home + away || 1
  const hp = (home / total) * 100
  return (
    <div className="text-[11px]">
      <div className="flex justify-between font-semibold text-white">
        <span>{home}</span>
        <span className="text-steel-400 uppercase tracking-wide">{label}</span>
        <span>{away}</span>
      </div>
      <div className="mt-0.5 flex h-1 overflow-hidden rounded-full bg-navy-700">
        <div style={{ width: `${hp}%`, background: homeColor }} />
        <div style={{ width: `${100 - hp}%`, background: '#64748b' }} />
      </div>
    </div>
  )
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warn' | 'danger' | 'ok' }) {
  const cls =
    tone === 'danger'
      ? 'bg-danger-500/20 text-danger-500'
      : tone === 'warn'
        ? 'bg-warn-500/20 text-warn-500'
        : tone === 'ok'
          ? 'bg-accent-500/20 text-accent-400'
          : 'bg-navy-700 text-steel-300'
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{children}</span>
}

export function ScreenHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between border-b border-navy-700 px-6 py-4">
      <div>
        <h1 className="text-xl font-black tracking-tight">{title}</h1>
        {sub && <p className="text-steel-400 text-xs">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function PosBadge({ group }: { group: string }) {
  const color =
    group === 'GK' ? 'bg-amber-500/20 text-amber-300' : group === 'DEF' ? 'bg-sky-500/20 text-sky-300' : group === 'MID' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
  return <span className={`inline-block w-9 rounded text-center text-[10px] font-bold ${color}`}>{group}</span>
}

export function ratingColor(r: number): string {
  if (r >= 8) return 'text-accent-400'
  if (r >= 6.8) return 'text-emerald-300'
  if (r >= 5.5) return 'text-warn-500'
  return 'text-danger-500'
}
