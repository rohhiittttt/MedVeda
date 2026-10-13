import React, { useState } from 'react';

export interface CookieBannerProps {
  onAccept?: () => void;
  onDecline?: () => void;
  className?: string;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({
  onAccept,
  onDecline,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleAccept = () => {
    setIsVisible(false);
    if (onAccept) onAccept();
  };

  const handleDecline = () => {
    setIsVisible(false);
    if (onDecline) onDecline();
  };

  return (
    <aside
      aria-label="Cookie consent banner"
      className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 max-w-sm w-[calc(100vw-2.5rem)] sm:w-80 bg-white rounded-[16px] p-4 sm:p-5 border border-slate-200/90 shadow-[0_16px_36px_-10px_rgba(15,23,42,0.14),0_0_1px_rgba(15,23,42,0.1)] transition-all duration-300 animate-fade-in-up ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" />
              <path d="M16 15.5v.01" />
              <path d="M12 12v.01" />
              <path d="M11 17v.01" />
              <path d="M7 14v.01" />
            </svg>
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
            Cookie Preference
          </h4>
        </div>

        <button
          type="button"
          onClick={handleDecline}
          aria-label="Close cookie consent banner"
          className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <p className="text-[12px] sm:text-[13px] text-slate-500 leading-relaxed font-normal mb-4">
        We use cookies to tailor care workflows, remember preference settings, and analyze anonymous network telemetry.
      </p>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleAccept}
          className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer text-center active:scale-98"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={handleDecline}
          className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-colors cursor-pointer active:scale-98"
        >
          Decline
        </button>
      </div>
    </aside>
  );
};
