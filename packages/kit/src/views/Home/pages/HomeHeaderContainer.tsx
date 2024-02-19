import { Portal, Stack } from '@onekeyhq/components';

import HomeSelector from '../components/HomeSelector';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
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
        <HomeSelector mb="$2" />
        <HomeOverviewContainer />
      </Stack>
      <Portal.Container name={Portal.Constant.WALLET_ACTIONS} />
    </Stack>
  );
}

export { HomeHeaderContainer };
