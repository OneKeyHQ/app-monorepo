import { MotiView } from 'moti';
import { getTokenValue } from 'tamagui';

import { useThemeValue } from '../../hooks';
import { Stack } from '../../primitives';

import type { IStackProps } from '../../primitives';
import type { Token } from 'tamagui';

interface IConfirmHighlighter extends Partial<IStackProps> {
  highlight?: boolean;
  borderRadius?: IStackProps['borderRadius'];
}

export function ConfirmHighlighter({
  highlight,
  children,
  borderRadius,
  ...rest
}: IConfirmHighlighter) {
  const highlightColor = useThemeValue('brand11');

  return (
    <Stack borderRadius={borderRadius} {...rest}>
      {children}
      {highlight ? (
        <MotiView
          from={{
            borderWidth: 0,
            opacity: 0,
            shadowOpacity: 0.5,
          }}
          animate={{
            borderWidth: 2,
            opacity: 1,
            shadowOpacity: 1,
          }}
          transition={{
            type: 'timing',
            duration: 1000,
            loop: true,
          }}
          style={{
            position: 'absolute',
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
            shadowOpacity: 1,
            shadowOffset: {
              width: 0,
              height: 0,
            },
          }}
        />
      ) : null}
    </Stack>
  );
}
