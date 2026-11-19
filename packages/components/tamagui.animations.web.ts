import { createAnimations } from '@tamagui/animations-css';

const easeOut = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
const easeOutCubic = 'cubic-bezier(0.215, 0.61, 0.355, 1)';
const smoothEase = 'cubic-bezier(0.2, 0, 0, 1)';

export const animations = createAnimations({
  '0ms': '0ms linear',
  '50ms': '50ms linear',
  '100ms': '100ms ease-out',
  repeat: '300ms linear',
  quick: `150ms ${easeOut}`,
  popoverQuick: `150ms ${easeOutCubic}`,
  smooth: `300ms ${smoothEase}`,
  fast: `200ms ${easeOut}`,
  medium: `300ms ${easeOut}`,
  slow: `450ms ${easeOut}`,
  switch: `200ms ${smoothEase}`,
});
