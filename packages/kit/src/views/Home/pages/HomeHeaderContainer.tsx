import { Portal, Stack } from '@onekeyhq/components';

import HomeSelector from '../components/HomeSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  return (
    <HomeTokenListProviderMirror>
      <Stack testID="Wallet-Tab-Header" p="$5" bg="$bgApp">
        <HomeSelector mb="$2.5" />
        <Stack
          $gtLg={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Portal.Container name={Portal.Constant.WALLET_ACTIONS} />
          <HomeOverviewContainer />
        </Stack>
      </Stack>
    </HomeTokenListProviderMirror>
  );
}

export { HomeHeaderContainer };
