import { Stack, useIsHorizontalLayout } from '@onekeyhq/components';

import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActions } from '../components/WalletActions';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  const isHorizontal = useIsHorizontalLayout();
  return (
    <HomeTokenListProviderMirror>
      <>
        <Stack
          testID="Wallet-Tab-Header"
          gap="$5"
          p="$5"
          bg="$bgApp"
          $gtLg={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Stack gap="$2.5">
            <HomeOverviewContainer />
          </Stack>
          <WalletActions
            $gtLg={{
              pt: 0,
            }}
          />
        </Stack>
      </>
    </HomeTokenListProviderMirror>
  );
}

export { HomeHeaderContainer };
