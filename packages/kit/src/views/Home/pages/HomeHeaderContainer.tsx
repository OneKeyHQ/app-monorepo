import { Stack, useIsWideScreen } from '@onekeyhq/components';

import { UniversalSearchInput } from '../../../components/TabPageHeader/UniversalSearchInput';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActions } from '../components/WalletActions';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  const isWideScreen = useIsWideScreen();
  return (
    <HomeTokenListProviderMirror>
      <Stack
        testID="Wallet-Tab-Header"
        gap="$5"
        p="$5"
        $gtMd={{
          pt: '$2.5',
        }}
        bg="$bgApp"
        $gtLg={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Stack gap="$2.5">
          {isWideScreen ? null : <UniversalSearchInput size="medium" />}
          <HomeOverviewContainer />
        </Stack>
        <WalletActions
          $gtLg={{
            pt: 0,
          }}
        />
      </Stack>
    </HomeTokenListProviderMirror>
  );
}

export { HomeHeaderContainer };
