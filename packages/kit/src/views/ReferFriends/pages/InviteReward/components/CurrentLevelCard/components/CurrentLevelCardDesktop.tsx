import { YStack } from '@onekeyhq/components';

import { useCurrentLevelCard } from '../hooks/useCurrentLevelCard';

import type { ICurrentLevelCardProps } from '../types';

export function CurrentLevelCardDesktop(props: ICurrentLevelCardProps) {
  useCurrentLevelCard(props);

  return (
    <YStack px="$5" pt="$6" pb="$5" $platform-native={{ pb: '$8' }}>
      {/* TODO: Implement desktop card content */}
    </YStack>
  );
}
