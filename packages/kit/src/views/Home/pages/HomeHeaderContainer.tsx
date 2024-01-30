import { Portal, Stack, XStack } from '@onekeyhq/components';

import { AccountSelectorActiveAccountHome } from '../../../components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '../../../components/AccountSelector/DeriveTypeSelectorTrigger';
import { NetworkSelectorTriggerHome } from '../../../components/AccountSelector/NetworkSelectorTrigger';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  const num = 0;

  return (
    <Stack
      p="$5"
      $gtMd={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Stack>
        <XStack mb="$1" alignItems="center" space="$1">
          <NetworkSelectorTriggerHome num={num} />
          <AccountSelectorActiveAccountHome num={num} />
          <DeriveTypeSelectorTrigger miniMode num={num} />
        </XStack>

        <Stack mt="$1">
          <HomeOverviewContainer />
        </Stack>
      </Stack>
      <Portal.Container name="test123" />
    </Stack>
  );
}

export { HomeHeaderContainer };
