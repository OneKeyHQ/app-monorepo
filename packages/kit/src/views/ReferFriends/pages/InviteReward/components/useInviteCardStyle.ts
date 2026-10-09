import { useMemo } from 'react';

import { useTheme } from '@onekeyhq/components';
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
// text stay aligned with the card's other rows. Sitting 4px inside the 16px
// card corner, the surface uses a 12px radius so the two curves stay parallel.
export const COMPACT_ROW_BLEED_PROPS = {
  mx: -12,
  px: 12,
  borderRadius: '$3',
} as const;

// Entry rows pair 14px titles with 20px icons; product rows keep the
// list default (24px) next to their 16px titles.
export const COMPACT_ENTRY_ICON_PROPS = { size: '$5' } as const;

export const INVITE_POPOVER_PANEL_PROPS = { width: 320 } as const;

// The invite home sits its cards on a subdued canvas, so the canvas and the
// soft shadow separate them without a border; they also round a step further
// than the card lists on the codes and level pages.
export const INVITE_HOME_CARD_RADIUS = '$4';

export function useInviteCardStyle({
  borderRadius = '$3',
  bordered = true,
}: {
  borderRadius?: '$3' | typeof INVITE_HOME_CARD_RADIUS;
  bordered?: boolean;
} = {}) {
  const isDark = useThemeVariant() === 'dark';
  return useMemo(
    () =>
      ({
        borderWidth: bordered ? 1 : 0,
        borderColor: INVITE_CARD_BORDER_COLOR,
        borderRadius,
        borderCurve: 'continuous',
        bg: '$bg',
        boxShadow: isDark ? undefined : LIGHT_CARD_SHADOW,
      }) as const,
    [borderRadius, bordered, isDark],
  );
}

export function useInviteHomeCardStyle() {
  return useInviteCardStyle({
    borderRadius: INVITE_HOME_CARD_RADIUS,
    bordered: false,
  });
}

// Light mode puts the bright `$bg` cards on the subdued canvas. Dark mode
// needs the deeper app canvas so the card background stays visible.
export function useInvitePageCanvas() {
  const theme = useTheme();
  const isDark = useThemeVariant() === 'dark';
  const backgroundColor = isDark ? '$bgApp' : '$bgSubdued';
  const headerBackgroundColor = isDark ? theme.bgApp.val : theme.bgSubdued.val;
  // Reference-stable: PageHeader diffs options shallowly before setOptions.
  const headerStyle = useMemo(
    () => ({ backgroundColor: headerBackgroundColor }),
    [headerBackgroundColor],
  );
  return { backgroundColor, headerBackgroundColor, headerStyle } as const;
}

export type IInviteCardStyle = ReturnType<typeof useInviteCardStyle>;
