export interface CardItem {
  id: string;
  code: string;
  title: string;
  description: string;
  badge?: string;
  actionLabel?: string;
  action?: () => void;
  image?: string;
  video?: string;
  alt?: string;
  theme?: {
    iconBg?: string;
    hoverText?: string;
    accentColor?: string;
    gradient?: string;
  };
}

export interface CarouselConfig {
  cardWidth: number;
  cardHeight: number;
  cardSpacingX: number;
  depthStepZ: number;
  scaleStep: number;
  rotateY: number;
  rotateX: number;
  fadeSteps: number[];
  perspective: number;
  transitionDuration: number;
  transitionEasing: string;
  autoplayDelay: number;
  visibleCardsCount: number;
}
