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

// Pressable label/value cells on pointer layouts: the hover surface bleeds
// 8px past the text, so the text stays aligned with the rest of the card.
export const POINTER_ROW_BLEED_PROPS = { mx: -8, px: '$2' } as const;

export const INVITE_POPOVER_PANEL_PROPS = { width: 320 } as const;

// Invite home cards round a step further than the card lists on the codes
// and level pages and drop the border: they are tinted cards on the plain
// app canvas on every layout.
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
  return useInviteCardStyle({
    borderRadius: INVITE_HOME_CARD_RADIUS,
    bordered: false,
    tinted: true,
  });
}

// Pages behind the invite home (Referrals) sit on the plain app canvas: the
// home's tinted cards on compact layouts, the bordered default elsewhere.
export function useInviteListCardStyle() {
  const { md } = useMedia();
  return useInviteCardStyle({
    borderRadius: md ? INVITE_HOME_CARD_RADIUS : '$3',
    bordered: !md,
    tinted: md,
  });
}

// The invite home sits on the plain app canvas on every layout, under its
// tinted cards.
export function useInvitePageCanvas() {
  const theme = useTheme();
  const headerBackgroundColor = theme.bgApp.val;
  // Reference-stable: PageHeader diffs options shallowly before setOptions.
  const headerStyle = useMemo(
    () => ({ backgroundColor: headerBackgroundColor }),
    [headerBackgroundColor],
  );
  return {
    backgroundColor: '$bgApp',
    headerBackgroundColor,
    headerStyle,
  } as const;
}

export type IInviteCardStyle = ReturnType<typeof useInviteCardStyle>;
