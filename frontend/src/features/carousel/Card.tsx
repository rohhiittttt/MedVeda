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
      className={`relative w-full h-full select-none overflow-hidden rounded-[26px] bg-slate-950 border border-black/20 flex flex-col justify-between group cursor-pointer shadow-[0_20px_45px_-12px_rgba(0,0,0,0.35),0_6px_16px_rgba(0,0,0,0.2)] ${
        isActive
          ? 'ring-1 ring-black/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5),0_12px_28px_-8px_rgba(0,0,0,0.2)]'
          : ''
      } ${className}`}
    >
      {/* Background artwork: fits smoothly at top and extends behind blurred content panel */}
      {card.video ? (
        <video
          src={card.video}
          autoPlay
          loop
          muted={isMuted || !isActive}
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-top transform transition-transform duration-700 ease-out group-hover:scale-105 select-none pointer-events-none"
        />
      ) : (
        <img
          src={card.image || './card-symptoms.png'}
          alt={card.title}
          loading={slotIndex < 4 ? 'eager' : 'lazy'}
          className="absolute inset-0 w-full h-full object-cover object-top transform transition-transform duration-700 ease-out group-hover:scale-105 select-none pointer-events-none"
        />
      )}

      {/* Progressive Linear Blur Layers: Soft progressive blur increasing down to heading and button area with NO straight line */}
      <div
        className="absolute inset-0 pointer-events-none z-[1] rounded-[26px]"
        style={{
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,1) 80%, rgba(0,0,0,1) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,1) 80%, rgba(0,0,0,1) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-[2] rounded-[26px]"
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.25) 52%, rgba(0,0,0,0.7) 72%, rgba(0,0,0,1) 90%, rgba(0,0,0,1) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.25) 52%, rgba(0,0,0,0.7) 72%, rgba(0,0,0,1) 90%, rgba(0,0,0,1) 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-[3] rounded-[26px]"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.3) 65%, rgba(0,0,0,0.8) 82%, rgba(0,0,0,1) 96%, rgba(0,0,0,1) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.3) 65%, rgba(0,0,0,0.8) 82%, rgba(0,0,0,1) 96%, rgba(0,0,0,1) 100%)',
        }}
      />

      {/* Progressive Linear Dark Gradient Overlay: Smooth transition into dark slate, matching reference card with zero straight borders */}
      <div
        className="absolute inset-0 pointer-events-none z-[4] rounded-[26px]"
        style={{
          background: 'linear-gradient(to bottom, rgba(15,23,42,0) 0%, rgba(15,23,42,0) 25%, rgba(15,23,42,0.12) 40%, rgba(15,23,42,0.38) 55%, rgba(15,23,42,0.68) 70%, rgba(15,23,42,0.92) 85%, #0f172a 100%)'
        }}
      />

      {/* Top section: Clean, unobstructed photo view */}
      <div className="flex-1 w-full min-h-[140px] pointer-events-none z-[5]" />

      {/* Bottom Content Panel: Pure seamless overlay on top of linear blur & gradient (NO border-t, NO hard cut) */}
      <div className="relative z-10 w-full p-4 sm:p-5 flex flex-col justify-end">
        {/* Heading: exact same content preserved */}
        <h3 className="text-lg sm:text-[19px] font-bold text-white tracking-tight leading-snug drop-shadow-md truncate mb-1">
          {card.title}
        </h3>

        {/* Paragraph: exact same content preserved */}
        <p className="text-xs text-slate-100 leading-relaxed font-normal line-clamp-2 mb-3.5 drop-shadow-md">
          {card.description}
        </p>

        {/* Badges row: In place of 4star/romantic/night-trip badges from reference pic 2 */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {card.badge && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-black/25 text-slate-100 border border-black/20 backdrop-blur-md shadow-xs">
              <span>{card.badge}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-black/20 backdrop-blur-md shadow-xs">
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>Verified</span>
          </span>
        </div>

        {/* Button: full width rounded-full pill matching reference pic 2, exact same action label */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (card.action) card.action();
          }}
          className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-full text-xs sm:text-[13px] transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer active:scale-98 group/btn"
        >
          <span>{card.actionLabel || 'Launch Feature'}</span>
          <span className="transition-transform duration-200 group-hover/btn:translate-x-1">&rarr;</span>
        </button>
      </div>
    </div>
  );
};
