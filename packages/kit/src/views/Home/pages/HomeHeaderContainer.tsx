import { Stack, XStack, useIsHorizontalLayout } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActions } from '../components/WalletActions';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  const isHorizontal = useIsHorizontalLayout();
  return (
    <HomeTokenListProviderMirror>
      <>
        {isHorizontal ? null : (
          <XStack
            pt={platformEnv.isNative ? '$5' : '$2.5'}
            px="$5"
            width="100%"
          />
        )}
        <Stack
          testID="Wallet-Tab-Header"
          gap="$5"
          p="$5"
          $md={{
            pt: '$2.5',
          }}
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
