import { forwardRef } from 'react';

import { themeable, useTheme, variableToString } from '@tamagui/core';
import { YStack } from '@tamagui/stacks';
import { ActivityIndicator } from 'react-native';

import type { ColorTokens, TamaguiElement, ThemeTokens } from '@tamagui/core';
import type { YStackProps } from '@tamagui/stacks';

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
