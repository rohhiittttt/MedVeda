import React, { useState } from 'react';
import { CardItem } from './types';
import { Carousel3D } from './Carousel3D';
import { LensZoomHeroStage } from './LensZoomHeroStage';
import { CookieBanner } from './CookieBanner';
import { MEDVEDA_FEATURE_CARDS } from './media';

export interface HeroProps {
  cards?: CardItem[];
  headline?: React.ReactNode;
  subparagraph?: string;
  badge?: string;
  className?: string;
  showCookieBanner?: boolean;
  useLensZoom?: boolean;
}

export const Hero: React.FC<HeroProps> = ({
  cards = MEDVEDA_FEATURE_CARDS,
  headline = (
    <>
      Quality healthcare,<br />
      from wherever you are.
    </>
  ),
  subparagraph = 'Connect with experienced doctors through secure video consultations, even when distance or access becomes a challenge.',
  badge = 'Prioritized Telehealth',
  className = '',
  showCookieBanner = true,
  useLensZoom = true,
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
  const currentCard = cards[activeIndex] || cards[0];

  return (
    <section
      aria-label="Lens Zoom Healthcare Showcase Hero"
      className={`relative w-full min-h-[640px] lg:min-h-[720px] bg-white text-slate-900 overflow-hidden flex flex-col justify-center select-none ${className}`}
    >
      <div className="relative z-10 max-w-[1440px] w-full mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
        {/* Left Column (about 45–50% width): typography, description, CTA buttons, badges & slide controls */}
        <div className="w-full lg:w-[48%] xl:w-[46%] flex flex-col justify-center shrink-0 pr-0 lg:pr-6">
          {/* Section badge pill */}
          {(currentCard?.badge || badge) && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1565C0] border border-blue-200/80 shadow-2xs">
                <svg className="w-3.5 h-3.5 text-[#1565C0]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 6.6L21 11l-5.6 4.4L17 22l-5-3.8L7 22l1.6-6.6L3 11l6.6-2.4L12 2z"/>
                </svg>
                <span>{currentCard?.badge || badge}</span>
              </span>
            </div>
          )}

          {/* Large black headline (~44–58px, weight 600, tight tracking) */}
          <h1 className="text-3xl sm:text-4xl lg:text-[46px] xl:text-[52px] font-black text-slate-950 tracking-tight leading-[1.08]">
            {currentCard?.title ? (
              <>
                {currentCard.title === 'Teleconsultation' ? (
                  <>
                    Quality healthcare,<br />
                    <span>from wherever you are.</span>
                  </>
                ) : (
                  currentCard.title
                )}
              </>
            ) : (
              headline
            )}
          </h1>

          {/* Short grey sub-paragraph */}
          <p className="mt-4 sm:mt-5 text-slate-600 text-base sm:text-lg leading-relaxed font-normal max-w-xl">
            {currentCard?.description || subparagraph}
          </p>

          {/* Interactive Button Group */}
          <div className="mt-7 sm:mt-8 flex items-center gap-3.5 sm:gap-4 flex-wrap">
            <button
              type="button"
              className="px-7 sm:px-8 py-3.5 sm:py-4 bg-[#1565C0] hover:bg-blue-700 text-white font-bold text-sm sm:text-base rounded-full shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer"
            >
              <span>{currentCard?.actionLabel || 'Start Consultation'}</span>
              <span>&rarr;</span>
            </button>

            <button
              type="button"
              className="px-7 sm:px-8 py-3.5 sm:py-4 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm sm:text-base rounded-full border border-slate-300 hover:border-slate-400 shadow-2xs hover:shadow-xs active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Learn More</span>
            </button>
          </div>

          {/* Trust Badges Footer */}
          <div className="mt-7 sm:mt-8 flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure</span>
            </div>
            <span className="text-slate-300">&bull;</span>
            <span className="text-slate-500 font-medium">Simple</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-slate-500 font-medium">Accessible</span>
          </div>

          {/* Bottom of text block: thin progress line/dash + 2 circular outline buttons */}
          <div className="mt-8 sm:mt-10 flex flex-col gap-3">
            <div className="w-full max-w-[320px] flex items-center gap-3">
              <div className="relative flex-1 h-[3px] bg-slate-200/90 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-[#1565C0] transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[12px] font-mono font-bold text-slate-700 tracking-wider shrink-0">
                {String(activeIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>

              {/* Two circular outline buttons (←, →) */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous card"
                  title="Previous card"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-300 hover:border-slate-800 hover:bg-slate-100 text-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next card"
                  title="Next card"
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-300 hover:border-slate-800 hover:bg-slate-100 text-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (about 52–54% width): Lens Zoom Visual Stage */}
        <div className="w-full lg:w-[52%] xl:w-[54%] relative flex justify-center lg:justify-end pl-0 lg:pl-4 overflow-visible min-h-[460px]">
          {useLensZoom ? (
            <LensZoomHeroStage
              cards={cards}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
            />
          ) : (
            <Carousel3D
              cards={cards}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
            />
          )}
        </div>
      </div>

      {/* Floating Cookie Consent Banner */}
      {showCookieBanner && <CookieBanner />}
    </section>
  );
};
