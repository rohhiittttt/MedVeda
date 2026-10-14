'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface Home3DVideoShowcaseProps {
  className?: string;
  onLaunchOverview?: () => void;
  onLaunchAbout?: () => void;
  onExploreNow?: () => void;
}

export const Home3DVideoShowcase: React.FC<Home3DVideoShowcaseProps> = ({
  className = '',
  onLaunchOverview,
  onLaunchAbout,
  onExploreNow,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleExplore = () => {
    if (onExploreNow) onExploreNow();
    else if (onLaunchOverview) onLaunchOverview();
    else if (typeof window !== 'undefined') {
      window.location.hash = '#overview';
    }
  };

  const handleAbout = () => {
    if (onLaunchAbout) onLaunchAbout();
    else if (typeof window !== 'undefined') {
      window.location.hash = '#about';
    }
  };

  // Ultra-smooth scroll tracking using requestAnimationFrame and passive listener
  useEffect(() => {
    let ticking = false;

    const updateScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalScrollable = rect.height - window.innerHeight;
      if (totalScrollable <= 0) {
        setScrollProgress(0);
        return;
      }

      const current = -rect.top;
      const progress = Math.max(0, Math.min(1, current / totalScrollable));
      setScrollProgress(progress);
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.muted = true;
    const p = v.play();
    if (p !== undefined) {
      p.catch(() => {});
    }

    const onFirstInteraction = () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', onFirstInteraction, { once: true });
    window.addEventListener('touchstart', onFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('click', onFirstInteraction);
      window.removeEventListener('touchstart', onFirstInteraction);
    };
  }, []);

  // Smoothstep easing helper for continuous, butter-smooth scroll transitions
  const smoothstep = (min: number, max: number, value: number) => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
  };

  // Phase 1: "Welcome to MedVeda" (Left Side)
  let p1Opacity = 0;
  let p1TranslateY = 0;
  if (scrollProgress <= 0.18) {
    p1Opacity = 1;
    p1TranslateY = 0;
  } else if (scrollProgress <= 0.32) {
    const t = smoothstep(0.18, 0.32, scrollProgress);
    p1Opacity = 1 - t;
    p1TranslateY = -t * 30;
  }

  // Phase 2: "India's First Fully Connected HealthCare Ecosystem" (Top Center)
  let p2Opacity = 0;
  let p2TranslateY = 0;
  if (scrollProgress >= 0.28 && scrollProgress <= 0.40) {
    const t = smoothstep(0.28, 0.40, scrollProgress);
    p2Opacity = t;
    p2TranslateY = (1 - t) * 30;
  } else if (scrollProgress > 0.40 && scrollProgress <= 0.58) {
    p2Opacity = 1;
    p2TranslateY = 0;
  } else if (scrollProgress > 0.58 && scrollProgress <= 0.70) {
    const t = smoothstep(0.58, 0.70, scrollProgress);
    p2Opacity = 1 - t;
    p2TranslateY = -t * 30;
  }

  // Phase 3: "Making Quality Care Accessible To Everyone" (Right Side)
  let p3Opacity = 0;
  let p3TranslateY = 0;
  if (scrollProgress >= 0.65 && scrollProgress <= 0.78) {
    const t = smoothstep(0.65, 0.78, scrollProgress);
    p3Opacity = t;
    p3TranslateY = (1 - t) * 30;
  } else if (scrollProgress > 0.78 && scrollProgress <= 0.92) {
    p3Opacity = 1;
    p3TranslateY = 0;
  } else if (scrollProgress > 0.92) {
    const t = smoothstep(0.92, 1.0, scrollProgress);
    p3Opacity = Math.max(0, 1 - t * 0.85);
    p3TranslateY = -t * 20;
  }

  return (
    <section
      ref={containerRef}
      aria-label="Fullscreen 3D Video Hero Showcase"
      className={`relative w-full h-[220vh] bg-slate-950 select-none ${className}`}
    >
      {/* Sticky Fullscreen Viewport: Completely Covers The Whole Page (No Tilt) */}
      <div className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center">
        {/* Full-bleed Edge-to-Edge Video Background with Enhanced Sharpness & Clarity */}
        <video
          ref={videoRef}
          src="./gemini_generated_video_f609bbc5.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover object-center select-none"
          style={{
            filter: 'contrast(1.08) brightness(1.03) saturate(1.08)',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        />

        {/* Minimal Vignettes: Only at top and bottom edges so middle 70% is 100% crystal clear */}
        {/* Top Edge Vignette (For Headline Contrast) */}
        <div
          className="absolute inset-x-0 top-0 h-40 sm:h-52 pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.15) 60%, transparent 100%)',
          }}
        />

        {/* Bottom Edge Vignette (For Button Contrast) */}
        <div
          className="absolute inset-x-0 bottom-0 h-32 sm:h-40 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.45) 0%, transparent 100%)',
          }}
        />

        {/* ============================================================== */}
        {/* THREE GIVEN USER HEADLINES — SMOOTH TRANSITIONS DRIVEN BY SCROLL */}
        {/* ============================================================== */}

        {/* HEADLINE 1: "Welcome to MedVeda" — POSITION: LEFT SIDE */}
        <div
          className="absolute left-6 sm:left-12 md:left-16 lg:left-24 top-1/2 max-w-2xl text-left z-20 pointer-events-none"
          style={{
            opacity: p1Opacity,
            transform: `translateY(calc(-50% + ${p1TranslateY}px))`,
            visibility: p1Opacity > 0.01 ? 'visible' : 'hidden',
            willChange: 'opacity, transform',
            transition: 'opacity 0.08s linear, transform 0.08s linear',
          }}
        >
          <h1 className="text-white font-black tracking-tight leading-[1.06] select-none text-4xl sm:text-6xl lg:text-7xl drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
            Welcome to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-white">
              MedVeda
            </span>
          </h1>
        </div>

        {/* HEADLINE 2: "India's First Fully Connected HealthCare Ecosystem" — POSITION: TOP CENTER */}
        <div
          className="absolute top-16 sm:top-24 md:top-28 inset-x-6 sm:inset-x-12 max-w-4xl mx-auto text-center z-20 pointer-events-none"
          style={{
            opacity: p2Opacity,
            transform: `translateY(${p2TranslateY}px)`,
            visibility: p2Opacity > 0.01 ? 'visible' : 'hidden',
            willChange: 'opacity, transform',
            transition: 'opacity 0.08s linear, transform 0.08s linear',
          }}
        >
          <h2 className="text-white font-black tracking-tight leading-[1.1] select-none text-3xl sm:text-5xl lg:text-6xl drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
            India&apos;s First Fully Connected<br className="hidden sm:inline" /> HealthCare Ecosystem
          </h2>
        </div>

        {/* HEADLINE 3: "Making Quality Care Accessible To Everyone" — POSITION: RIGHT SIDE */}
        <div
          className="absolute right-6 sm:right-12 md:right-16 lg:right-24 top-1/2 max-w-2xl text-right ml-auto z-20 pointer-events-none"
          style={{
            opacity: p3Opacity,
            transform: `translateY(calc(-50% + ${p3TranslateY}px))`,
            visibility: p3Opacity > 0.01 ? 'visible' : 'hidden',
            willChange: 'opacity, transform',
            transition: 'opacity 0.08s linear, transform 0.08s linear',
          }}
        >
          <h2 className="text-white font-black tracking-tight leading-[1.1] select-none text-3xl sm:text-5xl lg:text-6xl drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
            Making Quality Care<br />Accessible To Everyone
          </h2>
        </div>

        {/* ============================================================== */}
        {/* CONTROLS: BUTTONS ON BOTTOM RIGHT, SCROLL CUE AT BOTTOM */}
        {/* ============================================================== */}

        {/* Bottom Center: Scroll Prompt (Only visible at top, quickly fades out on scroll) */}
        <button
          type="button"
          onClick={() => {
            if (containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              window.scrollTo({
                top: window.scrollY + rect.height,
                behavior: 'smooth'
              });
            }
          }}
          className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 transition-opacity duration-200 cursor-pointer group"
          style={{
            opacity: Math.max(0, 1 - scrollProgress * 7),
            pointerEvents: scrollProgress < 0.15 ? 'auto' : 'none',
          }}
          title="Scroll to explore"
        >
          <span className="text-white/80 group-hover:text-white text-[10px] sm:text-[11px] font-bold tracking-widest uppercase transition-colors">
            Scroll
          </span>
          <svg
            className="w-4 h-4 text-white/80 group-hover:text-white group-hover:translate-y-0.5 animate-bounce transition-all"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Bottom Right: Explore Now & About Us Action Buttons */}
        <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 z-30 flex items-center gap-2.5 sm:gap-3">
          {/* About Us Button (Redirects to About Us page) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAbout();
            }}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-white/85 hover:bg-white text-slate-800 hover:text-[#0b2b82] text-xs sm:text-sm font-bold backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
          >
            About Us
          </button>

          {/* Explore Now Button (Redirects to Overview page) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleExplore();
            }}
            className="px-4.5 py-2 sm:px-6 sm:py-2.5 rounded-full bg-[#0b2b82] hover:bg-[#071a4f] text-white text-xs sm:text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 flex items-center gap-1.5 group/btn"
          >
            <span>Explore Now</span>
            <span className="group-hover/btn:translate-x-0.5 transition-transform duration-200">&rarr;</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default Home3DVideoShowcase;
