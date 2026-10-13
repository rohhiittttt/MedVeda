import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CardItem } from './types';
import { Card } from './Card';

// ============================================================================
// --- EXPOSED CAROUSEL PARAMETERS (CALIBRATED TO REFERENCE VIDEO) ---
// ============================================================================
export const CARD_WIDTH = 330;           // Base active card width in px (~3:4.2 portrait)
export const CARD_HEIGHT = 460;          // Base active card height in px
export const CARD_SPACING_X = 180;       // Horizontal step delta in px
export const DEPTH_STEP_Z = -140;        // Z-axis push back delta in px
export const SCALE_STEP = 0.15;          // Scale down percentage per slot
export const ROTATE_Y = -10;             // Y rotation angle in degrees (-8° to -12°)
export const ROTATE_X = 2;               // Slight upward tilt in degrees
export const PERSPECTIVE = 1400;         // 3D stage perspective in px
export const TRANSITION_DURATION = 750;  // Animation duration in ms (700-900ms)
export const TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'; // Natural deceleration
export const AUTOPLAY_DELAY = 2500;      // Autoplay advance delay in ms (~2.5s)
export const VISIBLE_CARDS_COUNT = 7;    // Number of visible cards simultaneously

export interface Carousel3DProps {
  cards: CardItem[];
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  className?: string;
  enableAutoplay?: boolean;
}

export const Carousel3D: React.FC<Carousel3DProps> = ({
  cards,
  activeIndex: externalIndex,
  onActiveIndexChange,
  className = '',
  enableAutoplay = true,
}) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const activeIndex = externalIndex !== undefined ? externalIndex : internalIndex;

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragCurrentX, setDragCurrentX] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const prevSlotsRef = useRef<Record<string, number>>({});
  const wheelLockRef = useRef(false);
  const animLockRef = useRef(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const total = cards.length;

  const updateIndex = useCallback((nextIndex: number) => {
    if (total === 0) return;
    const wrapped = ((nextIndex % total) + total) % total;
    if (wrapped === activeIndex) return;

    if (externalIndex === undefined) {
      setInternalIndex(wrapped);
    }
    if (onActiveIndexChange) {
      onActiveIndexChange(wrapped);
    }
  }, [total, activeIndex, externalIndex, onActiveIndexChange]);

  const handleNext = useCallback(() => {
    if (total <= 1) return;
    updateIndex(activeIndex + 1);
  }, [total, activeIndex, updateIndex]);

  const handlePrev = useCallback(() => {
    if (total <= 1) return;
    updateIndex(activeIndex - 1);
  }, [total, activeIndex, updateIndex]);

  // Autoplay (~2.5s when idle, pause on hover or drag)
  useEffect(() => {
    if (!enableAutoplay || reducedMotion || isHovered || isDragging || total <= 1) return;

    const timer = setInterval(() => {
      handleNext();
    }, AUTOPLAY_DELAY);

    return () => clearInterval(timer);
  }, [enableAutoplay, reducedMotion, isHovered, isDragging, total, handleNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // Wheel / Trackpad swipe with debounce
  const handleWheel = (e: React.WheelEvent) => {
    if (wheelLockRef.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 28) {
      wheelLockRef.current = true;
      if (delta > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 400);
    }
  };

  // Pointer drag events for grab / grabbing
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragCurrentX(e.clientX);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragCurrentX(e.clientX);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    const diff = dragCurrentX - dragStartX;
    if (diff < -45) {
      handleNext();
    } else if (diff > 45) {
      handlePrev();
    }
    setIsDragging(false);
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
  };

  // Determine slot for each card
  const getSlotForCard = (index: number) => {
    if (total <= 1) return 0;
    const diff = (index - activeIndex + total) % total;
    if (diff === 0) return 0;
    if (total === 2) return 1;
    if (diff === total - 1) return -1; // just exited to left
    if (diff < Math.min(total - 1, 7)) return diff;
    if (diff === 7) return 7;
    return 8; // hidden reservoir
  };

  // Compute 3D transformation for each slot
  const getCardTransform = (slot: number, isHoveredNonActive: boolean, isInstantReset: boolean) => {
    if (reducedMotion) {
      return {
        transform: `translateX(${Math.max(0, slot) * 40}px)`,
        opacity: slot === 0 ? 1 : slot === -1 ? 0 : Math.max(0, 0.8 - slot * 0.25),
        zIndex: slot === -1 ? 55 : 50 - slot,
        transition: isInstantReset ? 'none' : 'opacity 0.4s ease',
        pointerEvents: (slot === 0 || slot === 1 ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
      };
    }

    let x = 0;
    let z = 0;
    let scale = 1.0;
    let rotY = ROTATE_Y;
    let opacity = 1.0;
    let zIndex = 50;
    let pointerEvents: React.CSSProperties['pointerEvents'] = 'auto';

    if (slot === -1) {
      // Outgoing card smoothly sliding out to the left & tilting away
      x = -420;
      z = -80;
      scale = 0.92;
      rotY = ROTATE_Y - 16;
      opacity = 0;
      zIndex = 55;
      pointerEvents = 'none';
    } else if (slot === 0) {
      // Front active card
      x = 0;
      z = 0;
      scale = 1.0;
      rotY = ROTATE_Y;
      opacity = 1.0;
      zIndex = 50;
      pointerEvents = 'auto';
    } else {
      // Calibrated depth steps directly from reference recording
      const depthX = [0, 180, 335, 470, 590, 695, 785, 865, 940];
      const depthZ = [0, -140, -270, -390, -500, -600, -690, -780, -870];
      const depthScale = [1.0, 0.85, 0.72, 0.61, 0.52, 0.44, 0.37, 0.31, 0.26];
      const depthOpacity = [1.0, 0.95, 0.80, 0.62, 0.44, 0.28, 0.14, 0.00, 0.00];

      const sIdx = Math.min(Math.max(slot, 0), 8);
      x = depthX[sIdx];
      z = depthZ[sIdx];
      scale = depthScale[sIdx];
      opacity = depthOpacity[sIdx];
      zIndex = 50 - slot;
      pointerEvents = slot <= 5 ? 'auto' : 'none';
    }

    const liftY = isHoveredNonActive ? -8 : 0;

    return {
      transform: `translate3d(${x}px, ${liftY}px, ${z}px) rotateY(${rotY}deg) rotateX(${ROTATE_X}deg) scale(${scale})`,
      opacity,
      zIndex,
      pointerEvents,
      transition: isInstantReset
        ? 'none'
        : `transform ${TRANSITION_DURATION}ms ${TRANSITION_EASING}, opacity ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`,
      transformOrigin: 'bottom center',
      willChange: 'transform, opacity',
      backfaceVisibility: 'hidden' as const,
    };
  };

  // Keep track of previous slots so teleporting between -1 and 7/8 is instant
  useEffect(() => {
    cards.forEach((card, idx) => {
      prevSlotsRef.current[card.id] = getSlotForCard(idx);
    });
  }, [activeIndex, total, cards]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredSlot(null);
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`relative w-full h-[520px] sm:h-[560px] md:h-[600px] flex items-end select-none overflow-visible ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${className}`}
      style={{
        perspective: `${PERSPECTIVE}px`,
        transformStyle: 'preserve-3d',
        touchAction: 'pan-y',
      }}
    >
      {/* Studio Floor Soft Shadow Underneath */}
      <div
        className="absolute bottom-[-14px] left-[0%] w-[95%] h-[65px] pointer-events-none rounded-[100%]"
        style={{
          background: 'radial-gradient(ellipse 70% 32% at 35% 82%, rgba(15,23,42,0.11) 0%, rgba(15,23,42,0.03) 55%, transparent 75%)',
          filter: 'blur(10px)',
          transform: 'translateZ(-200px)',
        }}
      />

      {/* The 3D Stage Container */}
      <div
        className="relative w-full h-full flex items-end pb-8 sm:pb-12"
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {cards.map((card, idx) => {
          const slot = getSlotForCard(idx);
          const prevSlot = prevSlotsRef.current[card.id];
          const isInstantReset =
            (prevSlot === -1 && slot >= 7) ||
            (prevSlot >= 7 && slot === -1) ||
            (prevSlot === 8 && slot === -1);

          const isActive = slot === 0;
          const isSlotHovered = hoveredSlot === slot;
          const transformStyles = getCardTransform(slot, isSlotHovered && !isActive, isInstantReset);

          return (
            <div
              key={card.id}
              onMouseEnter={() => setHoveredSlot(slot)}
              onMouseLeave={() => setHoveredSlot(null)}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: `${CARD_WIDTH}px`,
                height: `${CARD_HEIGHT}px`,
                ...transformStyles,
              }}
            >
              <Card
                card={card}
                slotIndex={slot}
                isActive={isActive}
                isMuted={isMuted}
                onToggleMute={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                onClick={() => {
                  if (isActive) {
                    if (card.action) card.action();
                  } else {
                    // Clicking non-active card brings it to front smoothly
                    updateIndex(activeIndex + slot);
                  }
                }}
                className="w-full h-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
