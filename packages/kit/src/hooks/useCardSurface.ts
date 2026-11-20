import { useThemeName } from '@onekeyhq/components';

// Corner radius of the raised settings cards.
export const CARD_SURFACE_RADIUS = 12;

// The cards' fill: the page's own white in light; in dark a step above the
// page, since a ring alone leaves a lone card all but invisible there.
export const CARD_SURFACE_BG = '$bg';

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

// Follows the theme the card renders in, not the app's setting: some screens
// force their own (onboarding is always dark).
export function useCardShadow() {
  const themeName = useThemeName();
  return CARD_SHADOW[themeName.startsWith('dark') ? 'dark' : 'light'];
}
