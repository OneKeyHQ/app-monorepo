import { useMemo } from 'react';

import { MotiView } from 'moti';

import {
  getTokenValue,
  useTheme,
} from '@onekeyhq/components/src/shared/tamagui';
import type { Token } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives/Stack';

import type { IStackProps } from '../../primitives';

interface IConfirmHighlighter extends Partial<IStackProps> {
  highlight?: boolean;
  borderRadius?: IStackProps['borderRadius'];
}

const motiFromStyle = {
  borderWidth: 0,
  opacity: 0,
  //  WARN  (ADVICE) View #10569 of type RCTView has a shadow set but cannot calculate shadow efficiently. Consider setting a background color to fix this, or apply the shadow to a more specific component.
  shadowOpacity: platformEnv.isNative ? undefined : 0.5,
};

const motiAnimateStyle = {
  borderWidth: 2,
  opacity: 1,
  shadowOpacity: platformEnv.isNative ? undefined : 1,
};

const motiTransition = {
  type: 'timing',
  duration: 1000,
  loop: true,
} as any;

const shadowOffset = {
  width: 0,
  height: 0,
};

export function ConfirmHighlighter({
  highlight,
  children,
  borderRadius,
  ...rest
}: IConfirmHighlighter) {
  const theme = useTheme();
  const highlightColor = theme.brand11.val;

  const motiStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: -2,
      top: -2,
      right: -2,
      bottom: -2,
      borderRadius:
        typeof borderRadius !== 'number'
          ? getTokenValue(borderRadius as Token, 'size')
          : borderRadius,
      borderColor: highlightColor,
      shadowColor: highlightColor,
      shadowRadius: 10,
      shadowOpacity: platformEnv.isNative ? undefined : 1,
      shadowOffset,
    }),
    [borderRadius, highlightColor],
  );

  return (
    <Stack borderRadius={borderRadius} {...rest}>
      {children}
      {highlight ? (
        <MotiView
          from={motiFromStyle}
          animate={motiAnimateStyle}
          transition={motiTransition}
          style={motiStyle}
        />
      ) : null}
    </Stack>
  );
}
