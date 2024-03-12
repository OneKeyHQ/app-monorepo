import { Portal, Stack } from '@onekeyhq/components';

import HomeSelector from '../components/HomeSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProviderMirror';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  return (
    <HomeTokenListProviderMirror>
      <Stack testID="Wallet-Tab-Header" p="$5">
        <HomeSelector mb="$2.5" />
        <Stack
          space="$5"
          $gtLg={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <HomeOverviewContainer />
          <Portal.Container name={Portal.Constant.WALLET_ACTIONS} />
        </Stack>
      </Stack>
    </HomeTokenListProviderMirror>
  );
}

export { HomeHeaderContainer };
