import { Illustration, SizableText, YStack } from '@onekeyhq/components';

export function PerpMobileEmptyState({
  title,
  description,
  contentOffsetY = 0,
}: {
  title: string;
  description?: string;
  contentOffsetY?: number;
}) {
  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      px="$5"
      py="$6"
    >
      <YStack
        width="100%"
        maxWidth={320}
        gap="$3"
        alignItems="center"
        y={contentOffsetY}
      >
        <YStack h={64} alignItems="center" overflow="visible">
          <Illustration name="Orders" size={88} />
        </YStack>
        <SizableText
          size="$headingSm"
          color="$text"
          textAlign="center"
          maxWidth={280}
        >
          {title}
        </SizableText>
        {description ? (
          <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
            {description}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}
