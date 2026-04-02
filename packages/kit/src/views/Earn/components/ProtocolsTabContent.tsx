import { memo } from 'react';

import { YStack } from '@onekeyhq/components';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';

import { AvailableAssetsTabViewList } from './AvailableAssetsTabViewList';
import { Recommended } from './Recommended';

function BaseProtocolsTabContent() {
  const [{ refreshTrigger = 0 }] = useEarnAtom();

  return (
    <YStack gap="$8">
      <Recommended refreshTrigger={refreshTrigger} />
      <AvailableAssetsTabViewList />
    </YStack>
  );
}

export const ProtocolsTabContent = memo(BaseProtocolsTabContent);
