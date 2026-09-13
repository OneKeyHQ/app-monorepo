import type * as React from 'react';

import { ActivityIndicator } from 'react-native';

import {
  type ColorTokens,
  type ThemeTokens,
  YStack,
  type YStackProps,
  useTheme,
  variableToString,
} from '@onekeyhq/components/src/shared/tamagui';

export type ISpinnerProps = Omit<YStackProps, 'children'> & {
  size?: 'small' | 'large';
  // oxlint-disable-next-line @typescript-eslint/no-empty-object-type -- `string & {}` pattern for autocomplete
  color?: (ColorTokens | ThemeTokens | (string & {})) | null;
};

export const Spinner: React.ForwardRefExoticComponent<
  ISpinnerProps & React.RefAttributes<any>
> = YStack.styleable((props: ISpinnerProps, ref) => {
  // eslint-disable-next-line react/prop-types
  const { size, color: colorProp, ...stackProps } = props;
  const theme = useTheme();
  let color = (colorProp === undefined ? '$icon' : colorProp) as string;
  if (color && color[0] === '$') {
    color = variableToString(theme[color]);
  }
  return (
    <YStack ref={ref} {...stackProps}>
      <ActivityIndicator size={size} color={color} />
    </YStack>
  );
}) as any;
