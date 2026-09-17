import { Stack } from '@onekeyhq/components';

/**
 * Shared vertical rhythm for the mobile Earn surfaces (OK-59904).
 *
 * The home and its list pages used a flush ListItem cadence that read as
 * cramped. One scale, three levels:
 *
 *   section -> section   $10 (40)  home sections: recommended / trending /
 *                                  fixed rate / FAQ
 *   heading -> rows      $3  (12)  unchanged
 *   row -> row           $2  (8)   was flush
 *
 * Everything is expressed as space/size tokens rather than raw numbers: narrow
 * Android screens apply a 0.9 uiScale inside the token scale (see
 * packages/components/src/utils/scale.ts), so a raw number would keep its
 * unscaled value and drift out of alignment with its neighbors.
 *
 * Skeletons must consume the same constants as the real rows — a skeleton with
 * its own spacing makes the list shift when the loading state swaps to content.
 */
export const EARN_LIST_ROW_GAP = '$2' as const;

export const EARN_SECTION_GAP = '$10' as const;

/**
 * ListItem's own metrics (minHeight $11 + py $2) put a populated row at ~60;
 * the separator adds the row gap on top. Only a virtualization hint — FlashList
 * measures for real — but keeping it honest avoids scroll-extent jumps.
 */
export const EARN_LIST_ESTIMATED_ITEM_SIZE = 68;

/**
 * Row separator for the virtualized Earn list pages. A separator rather than a
 * per-row margin so the last row does not leave a dangling gap above the tab
 * bar padding.
 */
export function EarnListRowSeparator() {
  return <Stack h={EARN_LIST_ROW_GAP} />;
}
