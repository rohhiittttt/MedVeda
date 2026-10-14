'use client';

import React, { useRef, useState, useEffect } from 'react';

export interface HealthcareImpactSectionProps {
  onLaunchFeature1?: () => void;
  onLaunchFeature2?: () => void;
  onLaunchFeature4?: () => void;
  onLaunchFeature7?: () => void;
}

export const HealthcareImpactSection: React.FC<HealthcareImpactSectionProps> = ({
  onLaunchFeature1,
  onLaunchFeature2,
  onLaunchFeature4,
  onLaunchFeature7,
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const titleWords = ['Our', 'Impact'];
  const subtitleWords = ['Trusted', 'by', 'thousands', 'of', 'people'];

  const cards = [
    {
      id: 'doctors',
      img: './impact-doctors-connected.jpg',
      alt: 'Doctors connected across MedVeda network',
      stat: '2,500+',
      words: ['Doctors', 'Connected'],
      subtext: 'Verified specialists on call 24/7',
      action: onLaunchFeature2,
      baseDelay: 200,
    },
    {
      id: 'patients',
      img: './impact-patients-served.jpg',
      alt: 'Patients served with immediate clinical care',
      stat: '150,000+',
      words: ['Patients', 'Served'],
      subtext: 'Accurately triaged & treated',
      action: onLaunchFeature1,
      baseDelay: 284,
    },
    {
      id: 'rating',
      img: './impact-average-rating.jpg',
      alt: 'Average rating from verified patient feedback',
      stat: '4.9 ★',
      words: ['Average', 'Rating'],
      subtext: 'Based on 25,000+ patient reviews',
      action: onLaunchFeature4,
      baseDelay: 368,
    },
    {
      id: 'facilities',
      img: './impact-facilities-connected.jpg',
      alt: 'Healthcare facilities connected nationwide',
      stat: '850+',
      words: ['Facilities', 'Connected'],
      subtext: 'Hospitals, clinics & diagnostic centers',
      action: onLaunchFeature7,
      baseDelay: 452,
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="our-impact-section"
      className="relative w-full bg-white py-16 sm:py-20 lg:py-24 select-none overflow-hidden"
      aria-label="Our Impact"
    >
      <style>{`
        @keyframes blurLiftSettle {
          0% {
            opacity: 0;
            transform: translateY(22px);
            filter: blur(12px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
        }
      `}</style>

      <div className="relative z-10 max-w-7xl xl:max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Centered Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16 flex flex-col items-center justify-center">
          {/* Main Title: "Our Impact" in big font */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.08] flex items-center justify-center gap-x-3 sm:gap-x-4">
            {titleWords.map((word, idx) => (
              <span
                key={word}
                className="inline-block"
                style={
                  isInView
                    ? {
                        animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                        animationDelay: `${idx * 28}ms`,
                        willChange: 'transform, filter, opacity',
                      }
                    : { opacity: 0 }
                }
              >
                {word}
              </span>
            ))}
          </h2>

          {/* Subtitle: "Trusted by thousands of people" in small sized font */}
          <p className="text-base sm:text-lg text-slate-600 font-normal mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-x-1.5">
            {subtitleWords.map((word, idx) => (
              <span
                key={`${word}-${idx}`}
                className="inline-block"
                style={
                  isInView
                    ? {
                        animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                        animationDelay: `${(titleWords.length + idx) * 28}ms`,
                        willChange: 'transform, filter, opacity',
                      }
                    : { opacity: 0 }
                }
              >
                {word}
              </span>
            ))}
          </p>
        </div>

        {/* 4 Impact Cards with Attached Compressed Images */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7">
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={card.action}
              title={`View ${card.stat} ${card.words.join(' ')}`}
              className="group/card relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-200/90 shadow-sm hover:shadow-2xl hover:border-sky-400/50 hover:-translate-y-1.5 cursor-pointer transition-all duration-300 flex flex-col justify-end aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5]"
            >
              {/* Compressed Image */}
              <img
                src={card.img}
                alt={card.alt}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover object-center transform transition-transform duration-700 ease-out group-hover/card:scale-105 select-none"
              />

              {/* Cinematic Vignette Overlay ensuring text contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent pointer-events-none" />

              {/* Animated Text on Card: Words lift out of a soft blur and settle into place */}
              <div className="relative z-10 p-6 sm:p-7 flex flex-col justify-end pointer-events-none">
                {/* Metric Number */}
                <div
                  className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md"
                  style={
                    isInView
                      ? {
                          animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                          animationDelay: `${card.baseDelay}ms`,
                          willChange: 'transform, filter, opacity',
                        }
                      : { opacity: 0 }
                  }
                >
                  {card.stat}
                </div>

                {/* Metric Words */}
                <div className="text-sm sm:text-base font-bold text-sky-300 tracking-wide mt-1.5 drop-shadow-sm flex flex-wrap gap-x-1.5">
                  {card.words.map((word, wIdx) => (
                    <span
                      key={word}
                      className="inline-block"
                      style={
                        isInView
                          ? {
                              animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                              animationDelay: `${card.baseDelay + (wIdx + 1) * 28}ms`,
                              willChange: 'transform, filter, opacity',
                            }
                          : { opacity: 0 }
                      }
                    >
                      {word}
                    </span>
                  ))}
                </div>

                {/* Subtext */}
                <div
                  className="text-xs text-slate-300/90 font-medium mt-1 drop-shadow-sm"
                  style={
                    isInView
                      ? {
                          animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                          animationDelay: `${card.baseDelay + 3 * 28}ms`,
                          willChange: 'transform, filter, opacity',
                        }
                      : { opacity: 0 }
                  }
                >
                  {card.subtext}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HealthcareImpactSection;
