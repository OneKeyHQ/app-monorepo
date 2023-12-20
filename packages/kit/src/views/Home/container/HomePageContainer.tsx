import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';
import { YStack } from 'tamagui';

import {
  Button,
  Icon,
  Image,
  Page,
  Popover,
  Stack,
  Tab,
  Text,
  XStack,
} from '@onekeyhq/components';
import { getTokens } from '@onekeyhq/components/src/hooks';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';

import { DefiListContainer } from './DefiListContainer';
import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';
import { WalletActionsContainer } from './WalletActionsContainer';

function HomePage() {
  const screenWidth = useWindowDimensions().width;
  const sideBarWidth = getTokens().size.sideBarWidth.val;
  const intl = useIntl();

  const onRefresh = useCallback(() => {
    // tabsViewRef?.current?.setRefreshing(true);
  }, []);

  const tabs = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: 'asset__tokens',
        }),
        page: memo(TokenListContainerWithProvider, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'asset__collectibles',
        }),
        page: memo(NFTListContainer, () => true),
      },
      {
        title: 'Defi',
        page: memo(DefiListContainer, () => true),
      },
      {
        title: intl.formatMessage({
          id: 'transaction__history',
        }),
        page: memo(TxHistoryListContainer, () => true),
      },
    ],
    [intl],
  );

  const renderHeaderView = useCallback(
    () => (
      // <XStack justifyContent="space-between" alignItems="center" px="$2">
      //   <YStack>
      //     <AccountSelectorTrigger num={0} />
      //     <AccountSelectorActiveAccount num={0} />
      //   </YStack>
      //   <WalletActionsContainer />
      // </XStack>
      <Stack
        p="$5"
        $gtMd={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Stack>
          <XStack>
            <XStack alignItems="center" p="$1" bg="$bgStrong" borderRadius="$2">
              <Image
                w="$5"
                h="$5"
                source={{
                  uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
                }}
              />
              <Text pl="$2" variant="$bodyMd">
                Bitcoin
                {/* 0xbe52...73f3 */}
              </Text>
              <Icon
                name="ChevronDownSmallOutline"
                color="$iconSubdued"
                size="$5"
              />
            </XStack>
          </XStack>

          <Stack mt="$1">
            <Text variant="$heading5xl">$1000</Text>
          </Stack>
        </Stack>
        <XStack space="$2.5">
          <Button size="small" icon="ArrowTopOutline">
            Send
          </Button>
          <Button size="small" icon="ArrowBottomOutline">
            Receive
          </Button>
          <Button size="small" icon="SwitchHorOutline">
            Swap
          </Button>
          <Button size="small" icon="DotHorOutline" pr="$0.5" />
        </XStack>
      </Stack>
    ),
    [],
  );

  const headerTitle = useCallback(
    () => (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
      >
        <AccountSelectorTriggerHome num={0} />
      </AccountSelectorProviderMirror>
    ),
    [],
  );

  const headerRight = () => (
    <Popover
      title="Wallets"
      renderTrigger={
        <Stack>
          <HeaderIconButton icon="SettingsOutline" />
        </Stack>
      }
      renderContent={
        <XStack justifyContent="space-between" alignItems="center" px="$2">
          <YStack>
            <AccountSelectorProvider
              config={{
                sceneName: EAccountSelectorSceneName.home,
                sceneUrl: '',
              }}
              enabledNum={[0]}
            >
              <AccountSelectorTrigger num={0} />
              <AccountSelectorActiveAccount num={0} />
            </AccountSelectorProvider>
          </YStack>
          <WalletActionsContainer />
        </XStack>
      }
    />
  );

  return useMemo(
    () => (
      <Page>
        <Page.Header headerTitle={headerTitle} />
        <Page.Body alignItems="center">
          <Tab
            // @ts-expect-error
            data={tabs}
            ListHeaderComponent={<>{renderHeaderView()}</>}
            initialScrollIndex={0}
            stickyHeaderIndices={[1]}
            $md={{
              width: '100%',
            }}
            $gtMd={{
              width: screenWidth - sideBarWidth,
              // maxWidth: 1024,
            }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          />
        </Page.Body>
      </Page>
    ),
    [headerTitle, tabs, renderHeaderView, screenWidth, sideBarWidth, onRefresh],
  );
}

function HomePageContainer() {
  return (
    <AccountSelectorProvider
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomePage />
    </AccountSelectorProvider>
  );
}

export { HomePageContainer };
