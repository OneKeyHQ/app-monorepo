import { Stack } from '@onekeyhq/components';

import HomeSelector from '../components/HomeSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActions } from '../components/WalletActions';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  return (
    <HomeTokenListProviderMirror>
      <Stack testID="Wallet-Tab-Header" p="$5" bg="$bgApp">
        <HomeSelector mb="$2.5" />
        <Stack
          $gtLg={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <HomeOverviewContainer />
          <WalletActions
            pt="$5"
            $gtLg={{
              pt: 0,
            }}
          />
        </Stack>
      </Stack>
    </HomeTokenListProviderMirror>
  );
}

export { HomeHeaderContainer };
