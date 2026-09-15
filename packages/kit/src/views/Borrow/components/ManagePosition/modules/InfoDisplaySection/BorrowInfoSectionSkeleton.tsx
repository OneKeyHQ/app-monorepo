import { StyleSheet } from 'react-native';

import { Divider, Skeleton, XStack, YStack } from '@onekeyhq/components';

import type { IBorrowActionType } from '../../types';

function InfoRowSkeleton({
  highlight = false,
  tall = false,
}: {
  highlight?: boolean;
  tall?: boolean;
}) {
  let minHeight: '$5' | '$10' | number = '$5';
  if (highlight) {
    minHeight = '$10';
  } else if (tall) {
    minHeight = 29;
  }

  return (
    <XStack
      minHeight={minHeight}
      alignItems="center"
      justifyContent="space-between"
      gap="$4"
    >
      <Skeleton
        h={highlight ? '$4' : '$3.5'}
        w={highlight ? 88 : 104}
        borderRadius="$1"
      />
      <YStack alignItems="flex-end" gap="$1">
        <Skeleton h="$4" w={96} borderRadius="$1" />
        {highlight ? <Skeleton h="$3" w={64} borderRadius="$1" /> : null}
      </YStack>
    </XStack>
  );
}

export function BorrowInfoSectionSkeleton({
  action,
}: {
  action: IBorrowActionType;
}) {
  const primaryRowCount = action === 'borrow' || action === 'repay' ? 2 : 1;
  let secondaryRowCount = 1;
  if (action === 'supply') {
    secondaryRowCount = 3;
  } else if (action === 'repay') {
    secondaryRowCount = 2;
  } else if (action === 'withdraw') {
    secondaryRowCount = 0;
  }
  const showSecondaryInfo = secondaryRowCount > 0;
  const hasTallLastRow = action === 'supply' || action === 'repay';

  return (
    <YStack
      testID="borrow-info-section-skeleton"
      width="100%"
      p="$3.5"
      pt="$5"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
      <YStack gap="$6">
        {Array.from({ length: primaryRowCount }).map((_, index) => (
          <InfoRowSkeleton key={`primary-${index}`} highlight />
        ))}
      </YStack>
      {showSecondaryInfo ? <Divider my="$5" /> : null}
      {showSecondaryInfo ? (
        <YStack gap="$6">
          {Array.from({ length: secondaryRowCount }).map((_, index) => (
            <InfoRowSkeleton
              key={`secondary-${index}`}
              tall={hasTallLastRow && index === secondaryRowCount - 1}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
