import { Separator } from '@tamagui/separator';
import { styled } from '@tamagui/web';
import { StyleSheet } from 'react-native';

import type { GetProps } from '@tamagui/web';

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
