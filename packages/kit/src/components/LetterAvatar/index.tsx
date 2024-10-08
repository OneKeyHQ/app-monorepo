import type { IStackProps } from '@onekeyhq/components';
import { SizableText, Stack, getTokenValue } from '@onekeyhq/components';

import type { Token } from 'tamagui';

type ILetterAvatarProps = {
  letter?: string;
  size?: IStackProps['width'];
} & IStackProps;

export function LetterAvatar({
  letter,
  size = '$8',
  ...props
}: ILetterAvatarProps) {
  const frameSize: number =
    typeof size === 'number' ? size : getTokenValue(size as Token, 'size');
  const fontSize = Math.round(frameSize / 1.6667);
  const lineHeight = Math.round(fontSize * 1.3333);
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
      >
        {letter?.toUpperCase()}
      </SizableText>
    </Stack>
  );
}
