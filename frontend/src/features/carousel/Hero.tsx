import React, { useState } from 'react';
import { CardItem } from './types';
import { Carousel3D } from './Carousel3D';
import { CookieBanner } from './CookieBanner';
import { MEDVEDA_FEATURE_CARDS } from './media';

export interface HeroProps {
  cards?: CardItem[];
  headline?: React.ReactNode;
  subparagraph?: string;
  badge?: string;
  className?: string;
  showCookieBanner?: boolean;
}

export const Hero: React.FC<HeroProps> = ({
  cards = MEDVEDA_FEATURE_CARDS,
  headline = (
    <>
      One connected system<br />
      for the whole care journey.
    </>
  ),
  subparagraph = 'MedVeda brings navigation, care delivery, and records together so patients move forward and clinicians stay in the loop.',
  badge = 'Our Features',
  className = '',
  showCookieBanner = true,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = cards.length;

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % total);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  };

  // Progress percentage (0 to 100%)
  const progressPercent = total > 0 ? ((activeIndex + 1) / total) * 100 : 0;

  return (
    <section
      aria-label="3D Media Card Carousel Hero"
      className={`relative w-full min-h-[640px] lg:min-h-[720px] bg-[#FCFCFB] text-slate-900 overflow-hidden flex flex-col justify-center select-none ${className}`}
    >
      {/* Studio lighting & subtle background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-blue-50/40 via-slate-100/30 to-transparent blur-3xl opacity-60" />
        <div className="absolute -bottom-20 right-10 w-[600px] h-[300px] rounded-[100%] bg-slate-200/40 blur-2xl opacity-40" />
      </div>

      <div className="relative z-10 max-w-[1440px] w-full mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
        {/* Left Column (about 30–35% width): text block, vertically centered */}
        <div className="w-full lg:w-[32%] xl:w-[30%] flex flex-col justify-center shrink-0 pr-0 lg:pr-4">
          {/* Section badge pill */}
          {badge && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1565C0] border border-blue-200/80 shadow-2xs">
                <svg className="w-3.5 h-3.5 text-[#1565C0]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 6.6L21 11l-5.6 4.4L17 22l-5-3.8L7 22l1.6-6.6L3 11l6.6-2.4L12 2z"/>
                </svg>
                <span>{badge}</span>
              </span>
            </div>
          )}

          {/* Large black headline (~48–64px, weight 500–600, tight tracking) */}
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] xl:text-[48px] font-semibold text-slate-950 tracking-[-0.035em] leading-[1.08]">
            {headline}
          </h1>

          {/* Short grey sub-paragraph (14–16px, max-width ~320px) */}
          <p className="mt-4 sm:mt-5 text-slate-500 text-sm sm:text-base leading-relaxed font-normal max-w-[320px]">
            {subparagraph}
          </p>

          {/* Bottom of text block: thin progress line/dash + 2 circular outline buttons */}
          <div className="mt-8 sm:mt-10 flex flex-col gap-4">
            {/* Thin progress line / dash */}
            <div className="w-full max-w-[280px] flex items-center gap-3">
              <div className="relative flex-1 h-[2px] bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-slate-900 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-medium text-slate-400 shrink-0">
                {String(activeIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
            </div>

            {/* Two circular outline buttons (←, →), 40px, 1px light-grey border, subtle hover fill */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous card"
                title="Previous card"
                className="w-10 h-10 rounded-full border border-slate-300 hover:border-slate-800 hover:bg-slate-100/80 text-slate-800 flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 shadow-2xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>

              <button
                type="button"
                onClick={handleNext}
                aria-label="Next card"
                title="Next card"
                className="w-10 h-10 rounded-full border border-slate-300 hover:border-slate-800 hover:bg-slate-100/80 text-slate-800 flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 shadow-2xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (about 65–70% width): the 3D carousel stage */}
        <div className="w-full lg:w-[68%] xl:w-[70%] relative flex justify-start pl-0 lg:pl-6 overflow-visible min-h-[500px]">
          <Carousel3D
            cards={cards}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
          />
        </div>
      </div>

      {/* Floating Cookie Consent Banner */}
      {showCookieBanner && <CookieBanner />}
    </section>
  );
};
