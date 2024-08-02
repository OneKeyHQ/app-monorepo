import { Portal, Stack, XStack } from '@onekeyhq/components';

import HomeSelector from '../components/HomeSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  return (
    <HomeTokenListProviderMirror>
      <Stack testID="Wallet-Tab-Header" p="$5" bg="$bgApp">
        <HomeSelector mb="$2.5" />
        <Stack
          flexDirection="column"
          $gtLg={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <XStack height={48}>
            <HomeOverviewContainer />
          </XStack>
          <XStack $md={{ width: '100%', height: 94 }}>
            <Portal.Container name={Portal.Constant.WALLET_ACTIONS} />
          </XStack>
        </Stack>
      </Stack>
    </HomeTokenListProviderMirror>
  );
}

export { HomeHeaderContainer };
