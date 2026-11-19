import { useThemeVariant } from './useThemeVariant';

// Corner radius of the raised settings cards.
export const CARD_SURFACE_RADIUS = 12;

// Row chevrons on these cards are a size down from ListItem's 24px default so
// they sit quieter beside 14px text. The wider negative margin keeps the
// stroke on the same right edge.
export const CARD_ROW_CHEVRON_PROPS = { size: '$5', mx: -4.5 } as const;

// A card reads as raised, not outlined: a faint ring stands in for the edge
// and two soft layers give it lift. Dark surfaces can't show the layers, so
// they keep the ring alone.
const CARD_SHADOW = {
  light:
    '0 0 0 1px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 10px -4px rgba(0, 0, 0, 0.06)',
  dark: '0 0 0 1px rgba(255, 255, 255, 0.09)',
} as const;

export function useCardShadow() {
  const themeVariant = useThemeVariant();
  return CARD_SHADOW[themeVariant === 'dark' ? 'dark' : 'light'];
}
