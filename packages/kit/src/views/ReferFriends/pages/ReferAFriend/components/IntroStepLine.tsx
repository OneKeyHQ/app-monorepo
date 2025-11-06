import { SizableText, XStack } from '@onekeyhq/components';

interface IIntroStepLineProps {
  no: number;
  description: string;
}

export function IntroStepLine({ no, description }: IIntroStepLineProps) {
  return (
    <XStack gap="$3">
      <XStack
        bg="$bgInfo"
        w={28}
        h={28}
        p="$2"
        gap="$2"
        ai="center"
        jc="center"
        borderRadius="$full"
      >
        <SizableText size="$bodySmMedium" color="$textInfo">
          {no}
        </SizableText>
      </XStack>
      <SizableText size="$bodyLg">{description}</SizableText>
    </XStack>
  );
}
