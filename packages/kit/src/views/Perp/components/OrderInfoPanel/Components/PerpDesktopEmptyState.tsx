import { Illustration, SizableText, YStack } from '@onekeyhq/components';

export function PerpDesktopEmptyState({
  title,
  contentOffsetY = 0,
  alignToTop = false,
}: {
  title: string;
  contentOffsetY?: number;
  alignToTop?: boolean;
}) {
  return (
    <YStack
      flex={1}
      justifyContent={alignToTop ? 'flex-start' : 'center'}
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
