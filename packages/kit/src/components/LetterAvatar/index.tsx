import memoizee from 'memoizee';

import type { IStackProps } from '@onekeyhq/components';
import { SizableText, Stack, getTokenValue } from '@onekeyhq/components';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { Token } from 'tamagui';

type ILetterAvatarProps = {
  letter?: string;
  size?: IStackProps['width'];
} & IStackProps;

const a = -19.7066004937894;
const b = 4.22374087403456;
const c = -0.118638455363439;
const d = 0.00138657758442369;

// uses a cubic polynomial (ax³ + bx² + cx + d) to calculate the lineHeight based on the input size
//  where data from packages/components/tamagui.config.ts.
const getLineHeight = (x: number) =>
  Math.round(a + b * x + c * x * x + d * x * x * x);

const getFontStyle = memoizee(
  (size: ILetterAvatarProps['size']) => {
    const x: number =
      typeof size === 'number' ? size : getTokenValue(size as Token, 'size');
    const y = Math.round(x / 1.6667);
    const z = getLineHeight(y);
    return [x, y, z];
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
  },
);

export function LetterAvatar({
  letter,
  size = '$8',
  ...props
}: ILetterAvatarProps) {
  const [frameSize, fontSize, lineHeight] = getFontStyle(size);
  return (
    <Stack
      borderRadius="$full"
      bg="$bgInverse"
      width={frameSize}
      height={frameSize}
      justifyContent="center"
      alignItems="center"
      {...props}
    >
      <SizableText
        color="$textInverse"
        fontSize={fontSize}
        lineHeight={lineHeight}
        fontWeight="600"
      >
        {letter?.toUpperCase()}
      </SizableText>
    </Stack>
  );
}
