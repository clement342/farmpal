'use client';

import type { DiagnosisResult } from '@/types/diagnosis';

interface DiagnosisSummaryProps {
  diagnosis: DiagnosisResult;
}

// ─── Colour maps ─────────────────────────────────────────────────────────────

const urgencyConfig: Record<string, { badge: string; bar: string; label: string }> = {
  critical: { badge: 'bg-red-500/10 text-red-400 border-red-500/20', bar: 'bg-red-500', label: 'Critical' },
  high:     { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', bar: 'bg-orange-400', label: 'High' },
  moderate: { badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', bar: 'bg-yellow-400', label: 'Moderate' },
  low:      { badge: 'bg-accent-subtle text-accent-text border-accent/20', bar: 'bg-accent', label: 'Low' },
};

function confidenceLabel(score: number): { text: string; classes: string } {
  if (score >= 0.75) return { text: 'High confidence', classes: 'bg-accent-subtle text-accent-text border-accent/20' };
  if (score >= 0.5)  return { text: 'Medium confidence', classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
  return                    { text: 'Low confidence',    classes: 'bg-[var(--bg-elevated)] text-text-muted border-border-subtle' };
}

// ─── Shared section wrapper ───────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-accent-text">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-widest text-text-muted">{title}</h4>
      </div>
      {children}
    </div>
  );
}

// ─── Bullet list ─────────────────────────────────────────────────────────────

function BulletList({ items, icon }: { items: string[]; icon: React.ReactNode }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="text-accent mt-0.5 shrink-0">{icon}</span>
          <span className="text-sm text-text-secondary leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconDisease = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconConfidence = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconReasoning = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const IconTreatment = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconPrevention = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const IconUrgency = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconExtension = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconShield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// ─── DiagnosisSummary ─────────────────────────────────────────────────────────

export function DiagnosisSummary({ diagnosis }: DiagnosisSummaryProps) {
  const topCause = diagnosis.possibleCauses[0];
  const altCauses = diagnosis.possibleCauses.slice(1);
  const urg = urgencyConfig[diagnosis.urgency] ?? urgencyConfig.low;
  const conf = confidenceLabel(topCause?.confidence ?? 0);

  const immediateActions = diagnosis.recommendations.filter((r) => r.category === 'immediate_action');
  const preventive = diagnosis.recommendations.filter((r) => r.category === 'preventive');
  const consultations = diagnosis.recommendations.filter((r) => r.category === 'consultation');

  return (
    <div className="mt-2 w-full animate-fade-in">
      {/* ── Outer card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden shadow-lg shadow-black/20">

        {/* ── Card header: success state ──────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-[var(--bg-card)]">
          <div className="flex items-center gap-2.5">
            {/* Green checkmark circle */}
            <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-text-primary">Diagnosis Complete</span>
          </div>
          {/* Urgency badge */}
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${urg.badge}`}>
            <IconUrgency />
            {urg.label} urgency
          </span>
        </div>

        {/* ── Card body ───────────────────────────────────────────── */}
        <div className="px-5 py-5 space-y-5">

          {/* 1 · Disease name + confidence ──────────────────────── */}
          {topCause && (
            <Section icon={<IconDisease />} title="Identified Condition" delay={60}>
              <div className="rounded-xl border border-border-subtle bg-[var(--bg-elevated)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <h3 className="text-base font-semibold text-text-primary leading-tight">
                    {topCause.name}
                  </h3>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${conf.classes}`}>
                    {conf.text}
                  </span>
                </div>

                {/* Confidence bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-border-subtle overflow-hidden">
                    <div
                      className={`h-full rounded-full ${urg.bar} transition-all duration-700 ease-out`}
                      style={{ width: `${(topCause.confidence * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-text-muted shrink-0">
                    {(topCause.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Alt causes */}
              {altCauses.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-text-muted font-medium ml-0.5 mb-2">
                    Also considered
                  </p>
                  {altCauses.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-elevated)]/50 border border-border-subtle">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-text-secondary truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1 rounded-full bg-border-subtle overflow-hidden">
                          <div
                            className="h-full rounded-full bg-text-muted/60"
                            style={{ width: `${(c.confidence * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-text-muted w-8 text-right">
                          {(c.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Divider */}
          <div className="border-t border-border-subtle" />

          {/* 2 · Reasoning ──────────────────────────────────────── */}
          <Section icon={<IconReasoning />} title="Reasoning" delay={120}>
            <p className="text-sm text-text-secondary leading-relaxed">
              {diagnosis.reasoning}
            </p>
          </Section>

          {/* Divider */}
          {immediateActions.length > 0 && <div className="border-t border-border-subtle" />}

          {/* 3 · Treatment ──────────────────────────────────────── */}
          {immediateActions.length > 0 && (
            <Section icon={<IconTreatment />} title="Immediate Treatment" delay={180}>
              <BulletList items={immediateActions.map((r) => r.text)} icon={<IconCheck />} />
            </Section>
          )}

          {/* Divider */}
          {preventive.length > 0 && <div className="border-t border-border-subtle" />}

          {/* 4 · Prevention ─────────────────────────────────────── */}
          {preventive.length > 0 && (
            <Section icon={<IconPrevention />} title="Prevention" delay={240}>
              <BulletList items={preventive.map((r) => r.text)} icon={<IconShield />} />
            </Section>
          )}

          {/* Divider */}
          {consultations.length > 0 && <div className="border-t border-border-subtle" />}

          {/* 5 · Consultation ───────────────────────────────────── */}
          {consultations.length > 0 && (
            <Section icon={<IconConfidence />} title="When to Seek Help" delay={280}>
              <BulletList items={consultations.map((r) => r.text)} icon={<IconCheck />} />
            </Section>
          )}

          {/* Divider */}
          {diagnosis.extensionOfficerAdvice && <div className="border-t border-border-subtle" />}

          {/* 6 · Extension officer advice ───────────────────────── */}
          {diagnosis.extensionOfficerAdvice && (
            <Section icon={<IconExtension />} title="Extension Officer Advice" delay={320}>
              <div className="flex items-start gap-3 rounded-xl border border-accent/15 bg-accent-subtle px-4 py-3">
                <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                  <IconExtension />
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {diagnosis.extensionOfficerAdvice}
                </p>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
