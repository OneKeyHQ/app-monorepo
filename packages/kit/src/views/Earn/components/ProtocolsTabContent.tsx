import { memo } from 'react';

import { YStack } from '@onekeyhq/components';

import { AvailableAssetsTabViewList } from './AvailableAssetsTabViewList';
import { Recommended } from './Recommended';

function BaseProtocolsTabContent({ isActive = true }: { isActive?: boolean }) {
  return (
    <YStack gap="$8">
      <Recommended isActive={isActive} />
      <AvailableAssetsTabViewList isActive={isActive} />
    </YStack>
  );
}

export const ProtocolsTabContent = memo(BaseProtocolsTabContent);
