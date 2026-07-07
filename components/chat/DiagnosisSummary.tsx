'use client';

import type { DiagnosisResult } from '@/types/diagnosis';

interface DiagnosisSummaryProps {
  diagnosis: DiagnosisResult;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  moderate: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-accent-subtle text-accent-text border-accent/20',
};

const urgencyLabels: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
};

export function DiagnosisSummary({ diagnosis }: DiagnosisSummaryProps) {
  const topCause = diagnosis.possibleCauses[0];
  const color = severityColors[diagnosis.urgency] || severityColors.low;

  return (
    <div className="mt-3 rounded-2xl border border-border-subtle bg-surface overflow-hidden animate-fade-in">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-primary">Diagnosis Result</h3>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${color}`}>
            {urgencyLabels[diagnosis.urgency] || diagnosis.urgency}
          </span>
        </div>

        {topCause && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-text-primary">{topCause.name}</span>
              <span className="text-xs text-text-muted">
                {(topCause.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border-subtle overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${topCause.confidence * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {diagnosis.recommendations
            .filter((r) => r.category === 'immediate_action')
            .map((r, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent mt-0.5 shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-sm text-text-secondary">{r.text}</span>
              </div>
            ))}
        </div>

        {diagnosis.extensionOfficerAdvice && (
          <div className="mt-4 pt-3 border-t border-border-subtle">
            <div className="flex items-start gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-text mt-0.5 shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-sm text-text-secondary">{diagnosis.extensionOfficerAdvice}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
