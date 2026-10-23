import { SizableText, Skeleton, XStack } from '@onekeyhq/components';

// Under an amount box: what the typed amount turns into (what reaches the
// vault, the tokens bought). One box to type in, so the form reads as one
// action rather than a swap between two boxes
export function StakingAmountResultLine({
  label,
  value,
  loading,
  isPlaceholder,
  testID,
}: {
  label: string;
  value: string;
  loading?: boolean;
  // Nothing typed or quoted yet: grey, as the box's own "0" is
  isPlaceholder?: boolean;
  testID?: string;
}) {
  return (
    <XStack testID={testID} px="$3.5" gap="$3" ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      {loading ? (
        <Skeleton.BodyMd w={96} />
      ) : (
        <SizableText
          size="$bodyMdMedium"
          color={isPlaceholder ? '$textDisabled' : undefined}
          textAlign="right"
          numberOfLines={1}
          flexShrink={1}
        >
          {value}
        </SizableText>
      )}
    </XStack>
  );
}
