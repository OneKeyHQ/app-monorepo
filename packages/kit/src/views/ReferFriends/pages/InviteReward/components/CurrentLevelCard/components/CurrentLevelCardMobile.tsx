import { YStack } from '@onekeyhq/components';

import { useCurrentLevelCard } from '../hooks/useCurrentLevelCard';

import type { ICurrentLevelCardProps } from '../types';

export function CurrentLevelCardMobile(props: ICurrentLevelCardProps) {
  const {} = useCurrentLevelCard(props);

  return (
    <YStack px="$5" py="$5" gap="$5">
      {/* TODO: Implement mobile card content */}
    </YStack>
  );
}
