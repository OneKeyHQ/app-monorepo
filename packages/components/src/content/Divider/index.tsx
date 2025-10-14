import { Separator } from '../../shared/tamagui';
import { styled } from '../../shared/tamagui';
import { StyleSheet } from 'react-native';

import type { GetProps } from '../../shared/tamagui';

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
