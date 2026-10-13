import React, { useState } from 'react';
import { CardItem } from './types';

export interface CardProps {
  card: CardItem;
  slotIndex: number;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: (e: React.MouseEvent) => void;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
  isExiting?: boolean;
}

export const Card: React.FC<CardProps> = ({
  card,
  slotIndex,
  isActive,
  isMuted,
  onToggleMute,
  onClick,
  style,
  className = '',
  isExiting = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style}
      data-slot={slotIndex}
      className={`relative w-full h-full select-none overflow-hidden rounded-[16px] bg-slate-900 border border-black/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.22),0_4px_12px_rgba(0,0,0,0.08)] flex flex-col justify-between group cursor-pointer ${
        isActive ? 'ring-2 ring-black/10' : ''
      } ${className}`}
    >
      {/* Full-bleed background media / artwork matching reference recording */}
      {card.video ? (
        <video
          src={card.video}
          autoPlay
          loop
          muted={isMuted || !isActive}
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-center transform transition-transform duration-700 ease-out group-hover:scale-105 select-none"
        />
      ) : (
        <img
          src={card.image || './card-symptoms.png'}
          alt={card.title}
          loading={slotIndex < 4 ? 'eager' : 'lazy'}
          className="absolute inset-0 w-full h-full object-cover object-center transform transition-transform duration-700 ease-out group-hover:scale-105 select-none"
        />
      )}

      {/* Cinematic gradient overlay ensuring maximum text legibility & studio look */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/25 pointer-events-none" />

      {/* Top bar: Module code pill + Verified badge + Speaker/Audio button on active card */}
      <div className="relative z-10 p-3.5 sm:p-4 flex items-center justify-between pointer-events-none">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 backdrop-blur-md text-slate-900 shadow-sm border border-white/60">
          <span>{card.code}</span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {isActive && (
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              title={isMuted ? 'Unmute' : 'Mute'}
              className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer active:scale-95 border border-white/25"
            >
              {isMuted ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
          )}

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-black/45 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 shadow-xs">
            <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
            <span>Verified</span>
          </span>
        </div>
      </div>

      {/* Bottom Content: Category Tag + Title + Description + Action CTA */}
      <div className="relative z-10 p-4 sm:p-5 flex flex-col justify-end">
        {card.badge && (
          <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-white/20 backdrop-blur-md text-white border border-white/20 shadow-xs self-start mb-2">
            {card.badge}
          </span>
        )}

        <h3 className="text-lg sm:text-[19px] font-bold text-white tracking-tight leading-snug drop-shadow-sm mb-1 truncate">
          {card.title}
        </h3>

        <p className="text-xs text-slate-200/90 leading-relaxed font-normal line-clamp-2 mb-3.5 drop-shadow-xs">
          {card.description}
        </p>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (card.action) card.action();
          }}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-xs sm:text-[13px] transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer active:scale-98 group/btn"
        >
          <span>{card.actionLabel || 'Launch Feature'}</span>
          <span className="transition-transform duration-200 group-hover/btn:translate-x-1">&rarr;</span>
        </button>
      </div>
    </div>
  );
};
