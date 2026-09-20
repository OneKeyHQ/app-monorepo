import { StyleSheet } from 'react-native';

import { Separator, styled } from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';

// Tamagui's Separator ships `height: 0, maxHeight: 0` (and `width/maxWidth: 0`
// for the vertical variant) and relies on the border to give it a visible size.
// Yoga measures a child by its flex basis clamped to min/max (0 here) but lays
// it out no smaller than its padding + border (hairline), so an auto-sized
// parent comes up one hairline short and its last child overlaps the parent's
// trailing border. Keep the max size equal to the border so measure and layout
// agree.
export const Divider = styled(Separator, {
  borderColor: '$borderSubdued',
  borderBottomWidth: StyleSheet.hairlineWidth,
  maxHeight: StyleSheet.hairlineWidth,

  variants: {
    vertical: {
      true: {
        maxHeight: 'auto',
        borderRightWidth: StyleSheet.hairlineWidth,
        maxWidth: StyleSheet.hairlineWidth,
      },
    },
  },
});

export type IDivider = GetProps<typeof Divider>;
