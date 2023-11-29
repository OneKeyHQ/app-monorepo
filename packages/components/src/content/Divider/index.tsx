import { StyleSheet } from 'react-native';
import { Separator, styled } from 'tamagui';

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
