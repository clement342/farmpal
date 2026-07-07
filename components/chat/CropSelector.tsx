'use client';

import { useState, useEffect, useRef } from 'react';
import type { Crop } from '@/types/crop';
import { fetchCrops } from '@/lib/api/crops';

interface CropSelectorProps {
  selected: Crop | null;
  onSelect: (crop: Crop | null) => void;
}

export function CropSelector({ selected, onSelect }: CropSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showHelper, setShowHelper] = useState(true);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCrops()
      .then(setCrops)
      .catch(() => {
        // Fallback crops if API unavailable
        setCrops([
          { id: 'maize', name: 'Maize', regions: [], growthStages: [], commonDiseaseIds: [] },
          { id: 'rice', name: 'Rice', regions: [], growthStages: [], commonDiseaseIds: [] },
          { id: 'wheat', name: 'Wheat', regions: [], growthStages: [], commonDiseaseIds: [] },
          { id: 'tomato', name: 'Tomato', regions: [], growthStages: [], commonDiseaseIds: [] },
          { id: 'coffee', name: 'Coffee', regions: [], growthStages: [], commonDiseaseIds: [] },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface text-sm text-text-secondary hover:border-border-hover hover:text-text-primary transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <span className="w-5 h-5 rounded-md bg-accent-subtle border border-accent/20 flex items-center justify-center text-[10px] font-medium text-accent-text">
              {selected.name[0]}
            </span>
            <span className="text-text-primary">{selected.name}</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 0-4 4v4h-2a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4h-2V6a4 4 0 0 0-4-4z" />
            </svg>
            <span>Optional — Select crop</span>
          </>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showHelper && !selected && (
        <p className="text-xs text-text-muted mt-1.5 whitespace-nowrap">
          Selecting a crop may improve diagnosis accuracy
        </p>
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-border-subtle bg-surface-elevated shadow-lg z-50 overflow-hidden" role="listbox">
          {loading ? (
            <div className="p-3 text-sm text-text-muted text-center">Loading...</div>
          ) : crops.length === 0 ? (
            <div className="p-3 text-sm text-text-muted text-center">No crops available</div>
          ) : (
            crops.map((crop) => (
              <button
                key={crop.id}
                onClick={() => {
                  onSelect(crop);
                  setOpen(false);
                  setShowHelper(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-background flex items-center gap-2.5 ${
                  selected?.id === crop.id ? 'text-accent-text bg-accent-subtle' : 'text-text-secondary'
                }`}
                role="option"
                aria-selected={selected?.id === crop.id}
              >
                <span className="w-5 h-5 rounded-md bg-accent-subtle border border-accent/20 flex items-center justify-center text-[10px] font-medium text-accent-text shrink-0">
                  {crop.name[0]}
                </span>
                {crop.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
