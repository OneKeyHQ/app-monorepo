import { useMemo } from 'react';

import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

// Cards and their inner dividers share one hairline color so they read as one
// weight; light mode adds a soft lift. `$theme-dark` does not match on
// desktop/web, so the variant is read here.
const LIGHT_CARD_SHADOW =
  '0 1px 2px -1px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02)';

export const INVITE_CARD_BORDER_COLOR = '$neutral4';

// Shared press feedback for rows, tiles and chips that act as buttons: the
// list-item hover/press/focus styles, with the arrow cursor this feature uses.
export const PRESSABLE_SURFACE_PROPS = {
  ...listItemPressStyle,
  cursor: 'default',
  role: 'button',
} as const;

// Entry rows inside compact cards (Manage codes, Payout history…) read at
// body size, so they stay below the figures and field values in weight.
export const COMPACT_ENTRY_TITLE_PROPS = { size: '$bodyMd' } as const;

// List rows inside compact cards: the press/hover surface bleeds 12px past
// the content on each side, so the highlight has padding while the icon and
// text stay aligned with the card's other rows. Sitting 4px inside the 12px
// card corner, the surface uses an 8px radius so the two curves stay parallel.
export const COMPACT_ROW_BLEED_PROPS = {
  mx: -12,
  px: 12,
  borderRadius: '$2',
} as const;

// Entry rows pair 14px titles with 20px icons; product rows keep the
// list default (24px) next to their 16px titles.
export const COMPACT_ENTRY_ICON_PROPS = { size: '$5' } as const;

export const INVITE_POPOVER_PANEL_PROPS = { width: 320 } as const;

export function useInviteCardStyle() {
  const isDark = useThemeVariant() === 'dark';
  return useMemo(
    () =>
      ({
        borderWidth: 1,
        borderColor: INVITE_CARD_BORDER_COLOR,
        borderRadius: '$3',
        borderCurve: 'continuous',
        bg: '$bg',
        boxShadow: isDark ? undefined : LIGHT_CARD_SHADOW,
      }) as const,
    [isDark],
  );
}

export type IInviteCardStyle = ReturnType<typeof useInviteCardStyle>;
