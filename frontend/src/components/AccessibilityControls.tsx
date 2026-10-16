import React from 'react';
import { X, Moon, Sun, Accessibility } from 'lucide-react';

interface AccessibilityControlsProps {
  isOpen: boolean;
  onClose: () => void;
  textSize: string;
  setTextSize: (size: string) => void;
  darkContrast: boolean;
  setDarkContrast: (val: boolean) => void;
}

export const AccessibilityControls: React.FC<AccessibilityControlsProps> = ({
  isOpen,
  onClose,
  textSize,
  setTextSize,
  darkContrast,
  setDarkContrast,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Click-outside backdrop */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`absolute top-16 right-6 md:right-12 z-50 w-72 rounded-2xl shadow-2xl border p-5 animate-in fade-in zoom-in-95 duration-150 transition-colors ${
          darkContrast
            ? 'bg-black text-white border-white/40 ring-1 ring-white/20'
            : 'bg-white text-slate-800 border-slate-200'
        }`}
      >
      {/* Header with proper Accessibility Icon */}
      <div className={`flex items-center justify-between pb-3 border-b ${
        darkContrast ? 'border-white/20' : 'border-slate-100'
      }`}>
        <div className="flex items-center gap-2 font-bold text-sm">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            darkContrast ? 'bg-white text-black' : 'bg-[#0f2952] text-white'
          }`}>
            <Accessibility className="w-3.5 h-3.5" />
          </div>
          <span>Accessibility controls</span>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-lg transition-colors ${
            darkContrast
              ? 'text-white/70 hover:text-white hover:bg-white/10'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
          aria-label="Close accessibility controls"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="py-4 space-y-4">
        {/* Text Size Scale (A-, A, A+, A++) */}
        <div>
          <label className={`block text-xs font-semibold mb-2 ${
            darkContrast ? 'text-white/80' : 'text-slate-600'
          }`}>
            Text size
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'sm', label: 'A-' },
              { id: 'base', label: 'A' },
              { id: 'lg', label: 'A+' },
              { id: 'xl', label: 'A++' },
            ].map((item) => {
              const isActive = textSize === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTextSize(item.id)}
                  className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    isActive
                      ? darkContrast
                        ? 'bg-white text-black border-white shadow-sm ring-2 ring-white/50'
                        : 'bg-[#0f2952] text-white border-[#0f2952] shadow-sm'
                      : darkContrast
                      ? 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dark Contrast Toggle */}
        <div className={`pt-2 border-t ${
          darkContrast ? 'border-white/20' : 'border-slate-100'
        }`}>
          <button
            type="button"
            onClick={() => setDarkContrast(!darkContrast)}
            className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              darkContrast
                ? 'bg-white text-black border-white shadow-sm hover:bg-slate-100'
                : 'bg-[#0f2952] text-white border-[#0f2952] hover:bg-[#1a3a6b]'
            }`}
          >
            {darkContrast ? (
              <>
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Turn Dark Contrast OFF</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-white" />
                <span>Turn Dark Contrast ON</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </>
  );
};
