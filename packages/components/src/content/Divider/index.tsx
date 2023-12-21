import { StyleSheet } from 'react-native';
import { Separator, styled } from 'tamagui';

import type { GetProps } from 'tamagui';

export const Divider = styled(Separator, {
  borderColor: '$borderSubdued',
  borderBottomWidth: StyleSheet.hairlineWidth,

  variants: {
    vertical: {
      true: {
        borderRightWidth: StyleSheet.hairlineWidth,
      },
    },
  },
});

export type IDivider = GetProps<typeof Divider>;
