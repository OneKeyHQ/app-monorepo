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
