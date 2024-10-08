import type { ISizableTextProps, IStackProps } from '@onekeyhq/components';
import { SizableText, Stack } from '@onekeyhq/components';

type ILetterAvatarProps = {
  letter?: string;
  size?: 'lg' | 'md' | 'sm' | 'xs' | 'xxs' | 'xxxs';
} & IStackProps;

const sizeMap: Record<
  string,
  { frameSize: IStackProps['width']; letterSize: ISizableTextProps['size'] }
> = {
  lg: { frameSize: '$10', letterSize: '$heading2xl' },
  md: { frameSize: '$8', letterSize: '$headingXl' },
  sm: { frameSize: '$6', letterSize: '$headingSm' },
  xs: { frameSize: '$5', letterSize: '$headingXs' },
  xxs: { frameSize: '$4', letterSize: '$headingXs' },
  // eslint-disable-next-line spellcheck/spell-checker
  xxxs: { frameSize: '$3', letterSize: '$headingXxs' },
};

export function LetterAvatar({
  letter,
  size = 'md',
  ...props
}: ILetterAvatarProps) {
  const { frameSize, letterSize } = sizeMap[size];

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
      <SizableText color="$textInverse" size={letterSize}>
        {letter}
      </SizableText>
    </Stack>
  );
}
