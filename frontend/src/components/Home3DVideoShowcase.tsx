'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface Home3DVideoShowcaseProps {
  className?: string;
}

export const Home3DVideoShowcase: React.FC<Home3DVideoShowcaseProps> = ({ className = '' }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const toggleSound = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    if (!nextMuted) {
      videoRef.current.volume = 1.0;
      videoRef.current.play().catch(() => {});
    }
    setIsMuted(nextMuted);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.muted = false;
    v.volume = 1.0;
    const p = v.play();
    if (p !== undefined) {
      p.then(() => {
        setIsMuted(false);
      }).catch(() => {
        v.muted = true;
        setIsMuted(true);
        v.play().catch(() => {});

        const onFirstInteraction = () => {
          if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.volume = 1.0;
            videoRef.current.play().catch(() => {});
            setIsMuted(false);
          }
          window.removeEventListener('click', onFirstInteraction);
          window.removeEventListener('keydown', onFirstInteraction);
          window.removeEventListener('touchstart', onFirstInteraction);
        };
        window.addEventListener('click', onFirstInteraction, { once: true });
        window.addEventListener('keydown', onFirstInteraction, { once: true });
        window.addEventListener('touchstart', onFirstInteraction, { once: true });
      });
    }
  }, []);

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      aria-label="3D Video"
      className={`relative w-full bg-white overflow-hidden py-8 sm:py-12 lg:py-16 flex items-center justify-center select-none ${className}`}
    >
      {/* Centered 3D Video Stage */}
      <div
        className="relative z-10 max-w-4xl lg:max-w-5xl xl:max-w-6xl w-full mx-auto px-4 sm:px-8 flex items-center justify-center"
        style={{
          perspective: '1200px',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          className="relative w-full flex items-center justify-center cursor-pointer"
          onClick={toggleSound}
          style={{
            transform: `rotateY(${mousePos.x * 12}deg) rotateX(${-mousePos.y * 10}deg)`,
            transformStyle: 'preserve-3d',
            transition: isHovered ? 'transform 0.12s ease-out' : 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Studio Pedestal Drop Shadow underneath */}
          <div
            className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-[90%] h-[50px] pointer-events-none rounded-[100%]"
            style={{
              background: 'radial-gradient(ellipse 70% 40% at 50% 50%, rgba(30,25,18,0.22) 0%, rgba(30,25,18,0.06) 55%, transparent 75%)',
              filter: 'blur(14px)',
              transform: 'translateZ(-40px)',
            }}
          />

          {/* 3D Video Frame with seamlessly feathered background */}
          <div
            className="relative w-full aspect-video rounded-3xl overflow-hidden transition-all duration-300"
            style={{
              transform: 'translateZ(10px)',
              maskImage: 'radial-gradient(ellipse 94% 92% at 50% 50%, black 75%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 94% 92% at 50% 50%, black 75%, transparent 100%)',
            }}
          >
            <video
              ref={videoRef}
              src="./gemini_generated_video_b7af3c29.mp4"
              poster="./video_poster.jpg"
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover object-center select-none transform scale-[1.03]"
            />

            {/* Subtle top scrim vignette to give bold white text crisp, cinematic contrast */}
            <div
              className="absolute inset-x-0 top-0 h-44 sm:h-56 md:h-64 pointer-events-none z-15"
              style={{
                background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.68) 0%, rgba(0, 0, 0, 0.38) 45%, rgba(0, 0, 0, 0.10) 75%, transparent 100%)',
              }}
            />

            {/* Fading Bold White Headline from Left to Right */}
            <div className="absolute top-0 inset-x-0 pt-4 sm:pt-6 md:pt-8 lg:pt-10 px-4 sm:px-8 md:px-12 z-20 pointer-events-none flex items-center justify-center text-center">
              <h1
                className="text-white font-black tracking-tight leading-[1.12] max-w-5xl select-none"
                style={{
                  fontSize: 'clamp(1.5rem, 4vw, 3.75rem)',
                  textShadow: '0 4px 24px rgba(0, 0, 0, 0.9), 0 2px 8px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 0, 0, 0.6)',
                  animation: 'medvedaFadeSlideLeftToRight 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                }}
              >
                India&apos;s First Fully Connected HealthCare Ecosystem
              </h1>
            </div>

            <style>{`
              @keyframes medvedaFadeSlideLeftToRight {
                0% {
                  opacity: 0;
                  transform: translateX(-45px);
                  filter: blur(10px);
                }
                40% {
                  opacity: 0.7;
                }
                100% {
                  opacity: 1;
                  transform: translateX(0);
                  filter: blur(0);
                }
              }
            `}</style>

            {/* Interactive Sound Toggle Button */}
            <button
              type="button"
              onClick={toggleSound}
              aria-label={isMuted ? "Unmute audio" : "Mute audio"}
              className="absolute bottom-4 right-4 z-30 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-md border border-white/20 shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              {isMuted ? (
                <>
                  <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                  <span>Click to Unmute</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-emerald-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                  <span>Audio On</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home3DVideoShowcase;
