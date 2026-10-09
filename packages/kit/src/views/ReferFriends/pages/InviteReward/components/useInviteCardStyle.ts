import { useMemo } from 'react';

import { useMedia, useTheme } from '@onekeyhq/components';
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

// Entry rows inside compact cards (Manage codes, Payout address…) match the
// field values' size and weight: one step below the product rows, while the
// subdued labels stay the only regular-weight text.
export const COMPACT_ENTRY_TITLE_PROPS = { size: '$bodyMdMedium' } as const;

// Product rows keep their icons (they name the product); at the entry rows'
// title size the icon steps down to 20px to match.
export const COMPACT_ROW_ICON_PROPS = { size: '$5' } as const;

// List rows inside compact cards: the press/hover surface bleeds 12px past
// the content on each side, so the highlight has padding while the icon and
// text stay aligned with the card's other rows. Sitting 4px inside the 16px
// card corner, the surface uses a 12px radius so the two curves stay parallel.
export const COMPACT_ROW_BLEED_PROPS = {
  mx: -12,
  px: 12,
  borderRadius: '$3',
} as const;

export const INVITE_POPOVER_PANEL_PROPS = { width: 320 } as const;

// Invite home cards round a step further than the card lists on the codes
// and level pages, and drop the border: on desktop the subdued canvas and the
// soft shadow separate them; compact layouts flip to tinted cards on the app
// canvas, which need neither.
export const INVITE_HOME_CARD_RADIUS = '$4';

export function useInviteCardStyle({
  borderRadius = '$3',
  bordered = true,
  tinted = false,
}: {
  borderRadius?: '$3' | typeof INVITE_HOME_CARD_RADIUS;
  bordered?: boolean;
  tinted?: boolean;
} = {}) {
  const isDark = useThemeVariant() === 'dark';
  return useMemo(
    () =>
      ({
        borderWidth: bordered ? 1 : 0,
        borderColor: INVITE_CARD_BORDER_COLOR,
        borderRadius,
        borderCurve: 'continuous',
        bg: tinted ? '$bgSubdued' : '$bg',
        boxShadow: isDark || tinted ? undefined : LIGHT_CARD_SHADOW,
      }) as const,
    [borderRadius, bordered, isDark, tinted],
  );
}

export function useInviteHomeCardStyle() {
  const { md } = useMedia();
  return useInviteCardStyle({
    borderRadius: INVITE_HOME_CARD_RADIUS,
    bordered: false,
    tinted: md,
  });
}

// Compact layouts use the app canvas under tinted cards. Desktop puts bright
// `$bg` cards on the subdued canvas, except in dark mode, which needs the
// deeper app canvas so the card background stays visible.
export function useInvitePageCanvas() {
  const theme = useTheme();
  const { md } = useMedia();
  const isDark = useThemeVariant() === 'dark';
  const isAppCanvas = md || isDark;
  const backgroundColor = isAppCanvas ? '$bgApp' : '$bgSubdued';
  const headerBackgroundColor = isAppCanvas
    ? theme.bgApp.val
    : theme.bgSubdued.val;
  // Reference-stable: PageHeader diffs options shallowly before setOptions.
  const headerStyle = useMemo(
    () => ({ backgroundColor: headerBackgroundColor }),
    [headerBackgroundColor],
  );
  return { backgroundColor, headerBackgroundColor, headerStyle } as const;
}

export type IInviteCardStyle = ReturnType<typeof useInviteCardStyle>;
