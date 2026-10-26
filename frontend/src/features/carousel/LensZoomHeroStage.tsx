'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CardItem } from './types';
import { ShieldCheck, Calendar, Activity, Bot, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LensZoomHeroStageProps {
  cards?: CardItem[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  className?: string;
  autoplay?: number;
}

export const LensZoomHeroStage: React.FC<LensZoomHeroStageProps> = ({
  cards = [],
  activeIndex = 0,
  onActiveIndexChange,
  className = '',
  autoplay = 6000,
}) => {
  const total = cards.length;
  const [incoming, setIncoming] = useState<{ to: number; dir: number; id: number } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const downRef = useRef<{ x: number; y: number } | null>(null);

  const duration = 950;
  const depth = 1.35;

  const go = (dir: number) => {
    if (incoming || total < 2) return;
    const nextIdx = (activeIndex + dir + total) % total;
    setIncoming({ to: nextIdx, dir, id: Date.now() });
  };

  const commit = () => {
    if (!incoming) return;
    onActiveIndexChange?.(incoming.to);
    setIncoming(null);
  };

  const ghostScale = (d: number, g: number) => d + (d - 1) * 0.6 * (g + 1);
  const targetDepth = incoming ? (incoming.dir >= 0 ? depth : 1 / depth) : depth;

  const currentCard = cards[incoming ? incoming.to : activeIndex];

  return (
    <div
      ref={rootRef}
      className={`relative w-full max-w-[620px] h-[360px] sm:h-[420px] lg:h-[480px] xl:h-[510px] bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 p-2 sm:p-2.5 flex items-center justify-center overflow-hidden transition-all select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      data-moving={incoming ? '1' : '0'}
      data-paused={isPaused ? '1' : '0'}
    >
      <style>{`
        @keyframes lz-show { from { opacity: 0; } 35% { opacity: 1; } to { opacity: 1; } }
        @keyframes lz-zoom { from { transform: scale(var(--lz-depth, 1.35)); filter: blur(14px) brightness(1.2); } to { transform: scale(1); filter: none; } }
        @keyframes lz-ghost { from { transform: scale(var(--lz-g, 1.5)); opacity: 0.42; filter: blur(6px); } to { transform: scale(1); opacity: 0; filter: blur(0); } }
        @keyframes lz-rise { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes lz-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .lz-base-img { position: absolute; inset: 0; transition: filter .9s ease, transform 1.2s cubic-bezier(.2,.7,.2,1); }
        [data-moving='1'] .lz-base-img { filter: brightness(.45); transform: scale(1.04); }
        .lz-incoming { position: absolute; inset: 0; overflow: hidden; animation: lz-show 950ms cubic-bezier(.2,.75,.2,1) both; }
        .lz-main-img { animation: lz-zoom 950ms cubic-bezier(.16,.8,.2,1) both; }
        .lz-ghost-img { opacity: 0; mix-blend-mode: screen; animation: lz-ghost 950ms cubic-bezier(.16,.8,.2,1) both; }
        .lz-fill-line { height: 100%; background: #1565C0; transform-origin: left; transform: scaleX(0); }
        .lz-fill-line[data-run='1'] { animation: lz-fill 6000ms linear forwards; }
        [data-paused='1'] .lz-fill-line { animation-play-state: paused; }
      `}</style>

      {/* Outgoing Base Image Layer (Ensuring image is FULLY VIEWED via object-contain / object-cover) */}
      <div className="lz-base-img w-full h-full flex items-center justify-center">
        {cards[activeIndex]?.image && (
          <img
            src={cards[activeIndex].image}
            alt={cards[activeIndex].title}
            className="w-full h-full object-contain sm:object-cover object-center rounded-xl sm:rounded-2xl select-none"
            draggable={false}
          />
        )}
      </div>

      {/* Incoming Zoom-In Rush Layer */}
      {incoming && cards[incoming.to]?.image && (
        <div
          className="lz-incoming z-10 w-full h-full flex items-center justify-center"
          key={incoming.id}
          style={{ ['--lz-depth' as string]: String(targetDepth) }}
          onAnimationEnd={(e) => e.target === e.currentTarget && commit()}
        >
          <img
            src={cards[incoming.to].image}
            alt={cards[incoming.to].title}
            className="w-full h-full object-contain sm:object-cover object-center rounded-xl sm:rounded-2xl select-none lz-main-img"
            draggable={false}
          />
          {[1, 0].map((g) => (
            <img
              key={g}
              src={cards[incoming.to].image}
              alt=""
              className="w-full h-full object-contain sm:object-cover object-center rounded-xl sm:rounded-2xl select-none lz-ghost-img absolute inset-0 pointer-events-none"
              style={{
                ['--lz-g' as string]: String(ghostScale(targetDepth, g)),
                animationDelay: `${g * 45}ms`,
              }}
              draggable={false}
            />
          ))}
        </div>
      )}

      {/* Subtle Bottom Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent pointer-events-none rounded-2xl" />

      {/* Floating Clinical UI Badges directly matching reference image */}
      <div className="absolute top-3 left-3 sm:top-5 sm:left-5 z-20 flex items-center gap-2.5 bg-white/95 backdrop-blur-md px-3 sm:px-3.5 py-2 rounded-xl shadow-lg border border-slate-200/90 pointer-events-none transition-transform hover:scale-105">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            DR
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-slate-900 leading-tight">Dr. R. Sharma</span>
          <span className="text-[10px] text-slate-500 font-medium">
            General Physician • <span className="text-emerald-600 font-semibold">Consultation in progress</span>
          </span>
        </div>
      </div>

      <div className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 sm:px-3 py-1.5 rounded-lg shadow-md border border-slate-200/90 pointer-events-none">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span className="text-[11px] font-semibold text-slate-700">Secure Connection</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </div>

      <div className="absolute bottom-16 sm:bottom-20 left-3 sm:left-5 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200/90 pointer-events-none">
        <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#1565C0] flex items-center justify-center border border-sky-100">
          <Activity className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-slate-800 leading-tight">Your Health Records</span>
          <span className="text-[10px] text-slate-400 font-medium">Synced in real-time</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-3 sm:bottom-5 sm:right-5 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200/90 pointer-events-none">
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
          <Calendar className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] text-slate-400 font-medium">Next Appointment</span>
          <span className="text-[11px] font-bold text-slate-800">12 Apr 2025 • 10:30 AM</span>
        </div>
      </div>
    </div>
  );
};
