import { Stack, XStack, useIsWideScreen } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { UniversalSearchInput } from '../../../components/TabPageHeader/UniversalSearchInput';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActions } from '../components/WalletActions';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  const isWideScreen = useIsWideScreen();
  return (
    <HomeTokenListProviderMirror>
      <>
        {isWideScreen ? null : (
          <XStack
            pt={platformEnv.isNative ? '$5' : '$2.5'}
            px="$5"
            width="100%"
          >
            <UniversalSearchInput
              size="medium"
              containerProps={{
                width: '100%',
                $gtLg: undefined,
              }}
            />
          </XStack>
        )}
        <Stack
          testID="Wallet-Tab-Header"
          gap="$5"
          p="$5"
          $gtMd={
            platformEnv.isNative
              ? undefined
              : {
                  pt: '$2.5',
                }
          }
          bg="$bgApp"
          $gtLg={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
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
