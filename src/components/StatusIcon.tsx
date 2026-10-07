import type { Level } from '../model.ts';

/**
 * Each state has its own shape as well as its own colour, so the two never have to be told
 * apart by colour alone: circle, triangle, diamond, dashed ring, plain ring.
 */
export function StatusIcon({ level, size = 15 }: { level: Level | 'planned'; size?: number }) {
  return (
    <svg className="status-icon" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {level === 'ok' && (
        <>
          <circle cx="8" cy="8" r="7" fill="var(--good)" />
          <path d="M4.7 8.3l2.2 2.2 4.4-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {level === 'warn' && (
        <>
          <path d="M8 1.6 15 14H1z" fill="var(--warning)" stroke="var(--warning)" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 6.2v3.6" stroke="var(--ink)" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.95" fill="var(--ink)" />
        </>
      )}
      {level === 'breach' && (
        <>
          <rect x="2.7" y="2.7" width="10.6" height="10.6" rx="1.8" transform="rotate(45 8 8)" fill="var(--critical)" />
          <path d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}
      {level === 'unmeasured' && (
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="2.4 2.3" />
      )}
      {level === 'planned' && <circle cx="8" cy="8" r="6.2" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />}
    </svg>
  );
}
