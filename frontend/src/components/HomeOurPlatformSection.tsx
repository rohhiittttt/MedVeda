'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface HomeOurPlatformSectionProps {
  isDHO?: boolean;
  onLaunchFeature1?: () => void;
  onLaunchFeature2?: () => void;
  onLaunchFeature3?: () => void;
  onLaunchFeature4?: () => void;
  onLaunchFeature5?: () => void;
  onLaunchFeature6?: () => void;
  onLaunchFeature7?: () => void;
  onLaunchFeature8?: () => void;
  onLaunchFeature9?: () => void;
  onLaunchFeature10?: () => void;
}

export const HomeOurPlatformSection: React.FC<HomeOurPlatformSectionProps> = ({
  isDHO = false,
  onLaunchFeature1,
  onLaunchFeature2,
  onLaunchFeature3,
  onLaunchFeature4,
  onLaunchFeature5,
  onLaunchFeature6,
  onLaunchFeature7,
  onLaunchFeature8,
  onLaunchFeature9,
  onLaunchFeature10,
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

  const allFeatures = [
    {
      id: 'feature1',
      title: 'Smart Care Navigator',
      tagline: 'Quick symptom check',
      actionLabel: 'Check Symptoms',
      action: onLaunchFeature1,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      )
    },
    {
      id: 'feature2',
      title: 'Teleconsultation',
      tagline: 'Doctor video call',
      actionLabel: 'Talk to Doctor',
      action: onLaunchFeature2,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      )
    },
    {
      id: 'feature3',
      title: 'Referral Routing',
      tagline: 'Find specialist hospital',
      actionLabel: 'Find Hospital',
      action: onLaunchFeature3,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )
    },
    {
      id: 'feature4',
      title: 'Health Monitoring',
      tagline: 'Daily health checkup',
      actionLabel: 'Track Health',
      action: onLaunchFeature4,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      )
    },
    {
      id: 'feature5',
      title: 'Unified Health Records',
      tagline: 'Save medical reports',
      actionLabel: 'View Records',
      action: onLaunchFeature5,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 15l2 2 4-4" />
        </svg>
      )
    },
    {
      id: 'feature6',
      title: 'Medicine Search & Delivery',
      tagline: 'Find medicines nearby',
      actionLabel: 'Find Medicines',
      action: onLaunchFeature6,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
          <path d="m8.5 8.5 7 7" />
        </svg>
      )
    },
    {
      id: 'feature7',
      title: 'Facility Operations Dashboard',
      tagline: 'Check hospital beds',
      actionLabel: 'Check Hospital Beds',
      action: onLaunchFeature7,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      )
    },
    {
      id: 'feature8',
      title: 'AI Govt Health Scheme Finder',
      tagline: 'Free government schemes',
      actionLabel: 'Find Schemes',
      action: onLaunchFeature8,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    },
    {
      id: 'feature9',
      title: 'District Admin Command Center',
      tagline: 'District health monitor',
      actionLabel: 'Command Center',
      action: onLaunchFeature9,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    },
    {
      id: 'feature10',
      title: 'MediBot AI Assistant',
      tagline: 'Voice health helper',
      actionLabel: 'Talk to MediBot',
      action: onLaunchFeature10,
      icon: (
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4" />
          <line x1="8" y1="16" x2="8.01" y2="16" />
          <line x1="16" y1="16" x2="16.01" y2="16" />
        </svg>
      )
    }
  ];

  // District Admin Control is visible only to DHO / Admins. Hidden for public.
  const features = isDHO
    ? allFeatures
    : allFeatures.filter((f) => f.id !== 'feature9');

  return (
    <section
      ref={sectionRef}
      id="our-platform-section"
      aria-label="Our Platform"
      className="relative w-full bg-white py-16 sm:py-20 lg:py-28 select-none overflow-hidden"
    >
      <style>{`
        @keyframes blurLiftSettle1s {
          0% {
            opacity: 0;
            transform: translateY(28px);
            filter: blur(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
        }
      `}</style>

      <div className="relative z-10 max-w-7xl xl:max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Main Heading in the Middle */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#1565C0]/10 text-[#1565C0] border border-[#1565C0]/20 mb-4"
            style={
              isInView
                ? {
                    animation: 'blurLiftSettle1s 1s cubic-bezier(0.16, 1, 0.3, 1) both',
                    animationDelay: '0ms',
                    willChange: 'transform, filter, opacity',
                  }
                : { opacity: 0 }
            }
          >
            <span className="w-2 h-2 rounded-full bg-[#1565C0]" />
            <span className="tracking-wider uppercase">Healthcare Services</span>
          </div>

          {/* Heading with 1s fade-in text in Y direction */}
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.08] flex items-center justify-center gap-x-3 sm:gap-x-4"
          >
            {['Our', 'Platform'].map((word, idx) => (
              <span
                key={word}
                className="inline-block"
                style={
                  isInView
                    ? {
                        animation: 'blurLiftSettle1s 1s cubic-bezier(0.16, 1, 0.3, 1) both',
                        animationDelay: `${40 + idx * 35}ms`,
                        willChange: 'transform, filter, opacity',
                      }
                    : { opacity: 0 }
                }
              >
                {word}
              </span>
            ))}
          </h2>

          <p
            className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed"
            style={
              isInView
                ? {
                    animation: 'blurLiftSettle1s 1s cubic-bezier(0.16, 1, 0.3, 1) both',
                    animationDelay: '120ms',
                    willChange: 'transform, filter, opacity',
                  }
                : { opacity: 0 }
            }
          >
            Simple and accessible care for every family — quick symptom checkups, verified doctors, and emergency hospital services.
          </p>
        </div>

        {/* Feature Cards Grid: Strictly 3 feature cards in a row on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {features.map((feat, idx) => (
            <div
              key={feat.id}
              onClick={feat.action}
              className="bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/90 hover:border-[#1565C0]/40 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
              style={
                isInView
                  ? {
                      animation: 'blurLiftSettle1s 1s cubic-bezier(0.16, 1, 0.3, 1) both',
                      animationDelay: `${140 + idx * 50}ms`,
                      willChange: 'transform, filter, opacity',
                    }
                  : { opacity: 0 }
              }
            >
              {/* Logo on the left, Feature title and gray descriptive 2-3 word line on the right side of the logo */}
              <div className="flex items-start gap-4">
                {/* Feature Logo */}
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#1565C0]/10 border border-[#1565C0]/20 flex items-center justify-center shrink-0 group-hover:bg-[#1565C0] group-hover:border-[#1565C0] transition-all duration-300 shadow-2xs">
                  {React.cloneElement(feat.icon, {
                    className: 'w-6 h-6 sm:w-7 sm:h-7 text-[#1565C0] group-hover:text-white transition-colors duration-300'
                  })}
                </div>

                {/* Feature Title and Gray Descriptive Line */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug group-hover:text-[#1565C0] transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-slate-500 text-sm sm:text-base font-normal mt-1 leading-snug">
                    {feat.tagline}
                  </p>
                </div>
              </div>

              {/* Bottom Action Row */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#1565C0] group-hover:text-blue-700">
                <span>{feat.actionLabel}</span>
                <span className="text-base group-hover:translate-x-1.5 transition-transform">
                  &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
