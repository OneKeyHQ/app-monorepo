import { Text as TextComponent } from 'tamagui';

import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';
import { getTypographyStyleProps } from '../../Typography';

import type { FontProps, TypographyStyle } from '../../Typography';

type TextProps = {
  typography?:
    | TypographyStyle
    | { 'sm': TypographyStyle; 'md': TypographyStyle };
} & FontProps;

export function Text({ typography, children, ...rest }: TextProps) {
  // const isSmallScreen = useIsVerticalLayout();
  // let props;
  // if (typography) {
  //   if (typeof typography === 'string') {
  //     props = getTypographyStyleProps(typography);
  //   } else {
  //     props = getTypographyStyleProps(
  //       isSmallScreen ? typography.sm : typography.md,
  //     );
  //   }
  // }
  return <TextComponent color="$color">{children}</TextComponent>;
}
