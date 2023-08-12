import { metrics } from '../constants/metrics';

export const CARD_HEIGHT_CLOSED = 224;
export const CARD_HEIGHT_OPEN = 300;
export const CARD_HEADER_HEIGHT = 60;
export const CARD_MARGIN = 80;
export const BACK_BUTTON_HEIGHT = 40;
export const CLOSE_THRESHOLD = metrics.screenHeight * 0.11;

export const SPRING_CONFIG = {
  OPEN: {
    mass: 0.8,
    stiffness: 80,
  },
  CLOSE: {
    mass: 0.8,
    damping: 11,
    stiffness: 87,
  },
  SWIPE: {
    mass: 0.7,
    stiffness: 80,
  },
};
