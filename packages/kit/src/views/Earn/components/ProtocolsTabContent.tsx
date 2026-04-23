import { memo } from 'react';

import { YStack } from '@onekeyhq/components';

import { AvailableAssetsTabViewList } from './AvailableAssetsTabViewList';
import { Recommended } from './Recommended';

function BaseProtocolsTabContent() {
  return (
    <YStack gap="$8">
      <Recommended />
      <AvailableAssetsTabViewList />
    </YStack>
  );
}

export const ProtocolsTabContent = memo(BaseProtocolsTabContent);
