import { YStack } from '@onekeyhq/components';

import { AvailableAssetsTabViewList } from './AvailableAssetsTabViewList';
import { Recommended } from './Recommended';

export function ProtocolsTabContent() {
  return (
    <YStack gap="$8">
      <Recommended />
      <AvailableAssetsTabViewList />
    </YStack>
  );
}
