'use client';

import React, { useRef, useState, useEffect } from 'react';

export interface HomeWelcomeMotiveSectionProps {
  onLaunchFeature1?: () => void;
  onLaunchFeature2?: () => void;
  onLaunchFeature8?: () => void;
}

export const HomeWelcomeMotiveSection: React.FC<HomeWelcomeMotiveSectionProps> = ({
  onLaunchFeature1,
  onLaunchFeature2,
  onLaunchFeature8,
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

  const motives = [
    {
      kicker: 'Universal Access',
      title: 'Democratizing Quality Healthcare',
      description:
        'Eliminating geographic and financial boundaries to bring certified clinical specialists, instant AI triage, and transparent medical navigation to every doorstep across India.',
      action: onLaunchFeature2 || onLaunchFeature1,
      badge: '24/7 Specialist Connect',
      icon: (
        <svg className="w-6 h-6 text-[#1565C0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" />
          <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
          <path d="M9 10h6" />
          <path d="M12 7v6" />
        </svg>
      )
    },
    {
      kicker: 'Urgent Intervention',
      title: 'Preventing Avoidable Mortality',
      description:
        'Intercepting critical emergencies before it is too late. Intelligent triage assesses symptom severity in real-time and routes acute cases directly to equipped emergency centers with verified bed availability.',
      action: onLaunchFeature1,
      badge: 'Zero-Delay Emergency Triage',
      icon: (
        <svg className="w-6 h-6 text-[#1565C0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      )
    },
    {
      kicker: 'Grassroots Empowerment',
      title: 'Uplifting Underserved & Rural Regions',
      description:
        'Extending modern clinical infrastructure to Tier-2, Tier-3, and remote rural districts with vernacular voice triage, community health worker tools, and automated Ayushman Bharat scheme navigation.',
      action: onLaunchFeature8 || onLaunchFeature1,
      badge: 'Last-Mile Public Health',
      icon: (
        <svg className="w-6 h-6 text-[#1565C0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    }
  ];

  return (
    <section
      ref={sectionRef}
      id="welcome-medveda"
      aria-label="Welcome to MedVeda and Core Purpose"
      className="relative w-full bg-white py-16 sm:py-20 lg:py-24 select-none overflow-hidden"
    >
      <style>{`
        @keyframes blurLiftSettle {
          0% {
            opacity: 0;
            transform: translateY(24px);
            filter: blur(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
        }
      `}</style>

      <div className="max-w-7xl xl:max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Header / Introduction */}
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#1565C0]/10 text-[#1565C0] border border-[#1565C0]/20 mb-5">
            <span className="w-2 h-2 rounded-full bg-[#1565C0]" />
            <span className="tracking-wider uppercase">Our Foundational Purpose</span>
          </div>

          {/* Large Animated Title: Words lift out of a soft blur and settle into place */}
          <h2
            className="font-black tracking-tight leading-[1.06] select-none flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 md:gap-x-5"
            style={{ fontSize: 'clamp(2.75rem, 6.8vw, 5.75rem)' }}
          >
            <span
              className="inline-block text-slate-900"
              style={
                isInView
                  ? {
                      animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                      animationDelay: '0ms',
                      willChange: 'transform, filter, opacity',
                    }
                  : { opacity: 0 }
              }
            >
              Welcome
            </span>
            <span
              className="inline-block text-slate-900"
              style={
                isInView
                  ? {
                      animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                      animationDelay: '28ms',
                      willChange: 'transform, filter, opacity',
                    }
                  : { opacity: 0 }
              }
            >
              to
            </span>
            <span className="inline-flex items-center whitespace-nowrap">
              <span
                className="inline-block text-slate-900"
                style={
                  isInView
                    ? {
                        animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                        animationDelay: '56ms',
                        willChange: 'transform, filter, opacity',
                      }
                    : { opacity: 0 }
                }
              >
                Med
              </span>
              <span
                className="inline-block text-[#0ea5e9]"
                style={
                  isInView
                    ? {
                        animation: 'blurLiftSettle 0.56s cubic-bezier(0.16, 1, 0.3, 1) both',
                        animationDelay: '84ms',
                        willChange: 'transform, filter, opacity',
                      }
                    : { opacity: 0 }
                }
              >
                Veda
              </span>
            </span>
          </h2>

          <p className="mt-5 sm:mt-6 text-slate-600 text-base sm:text-lg md:text-xl leading-relaxed font-normal max-w-2xl mx-auto">
            Bridging healthcare disparity across India through an intelligent, connected ecosystem designed to deliver timely, compassionate care to every citizen.
          </p>
        </div>

        {/* 3 Core Motive Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-12 sm:mt-16 lg:mt-20">
          {motives.map((m, idx) => (
            <div
              key={idx}
              onClick={m.action}
              className="bg-white rounded-3xl p-7 sm:p-8 border border-slate-200 hover:border-[#1565C0]/40 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between cursor-pointer group"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50/90 border border-blue-100 flex items-center justify-center mb-6 group-hover:bg-[#1565C0] transition-colors duration-300">
                  <div className="group-hover:text-white transition-colors duration-300">
                    {React.cloneElement(m.icon, {
                      className: 'w-6 h-6 text-[#1565C0] group-hover:text-white transition-colors duration-300'
                    })}
                  </div>
                </div>

                <div className="text-xs font-bold uppercase tracking-wider text-[#1565C0] mb-2">
                  {m.kicker}
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug group-hover:text-[#1565C0] transition-colors">
                  {m.title}
                </h3>

                <p className="text-slate-600 text-sm sm:text-base leading-relaxed mt-3.5 font-normal">
                  {m.description}
                </p>
              </div>

              <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                <span className="text-[#1565C0] font-bold">{m.badge}</span>
                <span className="text-slate-400 group-hover:text-[#1565C0] group-hover:translate-x-1.5 transition-transform">
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

export default HomeWelcomeMotiveSection;
