import { Illustration, SizableText, YStack } from '@onekeyhq/components';

export function PerpDesktopEmptyState({
  title,
  contentOffsetY = 0,
}: {
  title: string;
  contentOffsetY?: number;
}) {
  return (
    <YStack
      flex={1}
      justifyContent="flex-start"
      alignItems="center"
      px="$5"
      py="$6"
    >
      <YStack
        width="100%"
        maxWidth={420}
        gap="$3"
        alignItems="center"
        y={contentOffsetY}
      >
        <Illustration name="Orders" size={100} mb={-24} />
        <SizableText
          size="$headingSm"
          color="$text"
          textAlign="center"
          maxWidth={360}
        >
          {title}
        </SizableText>
      </YStack>
    </YStack>
  );
}
