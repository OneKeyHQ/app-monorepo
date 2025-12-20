import { forwardRef } from 'react';

import { ActivityIndicator } from 'react-native';

import {
  type ColorTokens,
  type TamaguiElement,
  type ThemeTokens,
  YStack,
  type YStackProps,
  themeable,
  useTheme,
  variableToString,
} from '@onekeyhq/components/src/shared/tamagui';

export type ISpinnerProps = Omit<YStackProps, 'children'> & {
  size?: 'small' | 'large';
  // eslint-disable-next-line @typescript-eslint/ban-types
  color?: (ColorTokens | ThemeTokens | (string & {})) | null;
};

export const Spinner: React.ForwardRefExoticComponent<
  ISpinnerProps & React.RefAttributes<any>
> = YStack.extractable(
  themeable(
    // eslint-disable-next-line react/display-name
    forwardRef<TamaguiElement>((props: ISpinnerProps, ref) => {
      // eslint-disable-next-line react/prop-types
      const { size, color: colorProp, ...stackProps } = props;
      const theme = useTheme();
      let color = colorProp as string;
      if (color && color[0] === '$') {
        color = variableToString(theme[color]);
      }
      return (
        <YStack ref={ref} {...stackProps}>
          <ActivityIndicator size={size} color={color} />
        </YStack>
      );
    }),
    {
      componentName: 'Spinner',
    },
  ),
) as any;
