import { useId, type ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
  tight = false,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return (
    <section className={`card${tight ? ' tight' : ''}${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && (
              <div className="card-title">
                {icon && <span aria-hidden>{icon}</span>}
                <span>{title}</span>
              </div>
            )}
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          {actions && <div className="row tight">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const color =
    tone === 'good' ? 'var(--good-ink)' : tone === 'warn' ? 'var(--warn-ink)' : tone === 'bad' ? 'var(--bad-ink)' : undefined;
  return (
    <div className="card tight">
      <div className="tiny dim">{label}</div>
      <div className="stat-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {hint && <div className="tiny muted">{hint}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  hint,
}: {
  value: number;
  max?: number;
  label?: ReactNode;
  hint?: ReactNode;
}) {
  const percent = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      {(label || hint) && (
        <div className="row between tiny">
          <span className="muted">{label}</span>
          <span className="dim">{hint}</span>
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'default',
  title,
}: {
  children: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent';
  title?: string;
}) {
  return (
    <span className={`badge${tone === 'default' ? '' : ` ${tone}`}`} title={title}>
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="card center">
      <h3>{title}</h3>
      <p className="muted small">{body}</p>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="tiny dim" style={{ display: 'block', marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

export function KeyValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="kv">
      <span className="muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Initials avatar used in the sidebar, topbar and profile page. */
export function Avatar({ name, size = 36, title }: { name?: string | null; size?: number; title?: string }) {
  const initials =
    (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0]?.toUpperCase() ?? '')
      .join('') || 'QV';
  return (
    <span
      className="avatar"
      title={title ?? name ?? ''}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}

/** Circular progress indicator (topbar indicator, progress page and profile). */
export function ProgressRing({
  value,
  size = 52,
  thickness = 5,
  label,
  caption,
}: {
  value: number;
  size?: number;
  thickness?: number;
  label?: ReactNode;
  caption?: ReactNode;
}) {
  // Unique per instance: the topbar ring and a page ring can be on screen together.
  const gradientId = `qv-ring-${useId()}`;
  const percent = Math.max(0, Math.min(100, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;
  return (
    <div className="ring">
      <svg width={size} height={size} role="img" aria-label={`${Math.round(percent)}% complete`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <span className="ring-label" style={{ fontSize: Math.round(size * 0.3) }}>
        {label ?? `${Math.round(percent)}%`}
      </span>
      {caption && <span className="ring-caption">{caption}</span>}
    </div>
  );
}

/** Small uppercase section label used on the landing page and long pages. */
export function SectionLabel({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="section-label">
      {icon}
      <span>{children}</span>
    </div>
  );
}

/** Small gate chip used in explanations and tables. */
export function GateChip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="mono tiny"
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 6,
        border: `1px solid ${color ?? 'var(--border)'}`,
        color: color ?? 'inherit',
        background: 'var(--overlay-faint)',
      }}
    >
      {label}
    </span>
  );
}
