import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';
import { YStack, useMedia } from 'tamagui';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Form,
  Input,
  Page,
  Popover,
  SizableText,
  Stack,
  Tab,
  TextArea,
  XStack,
} from '@onekeyhq/components';
import { getTokens, useForm } from '@onekeyhq/components/src/hooks';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  AccountSelectorActiveAccount,
  AccountSelectorActiveAccountHome,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '../../../components/AccountSelector/DeriveTypeSelectorTrigger';
import {
  NetworkSelectorTrigger,
  NetworkSelectorTriggerHome,
} from '../../../components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EChainSelectorPages } from '../../ChainSelector/router/type';
import { EOnboardingPages } from '../../Onboarding/router/type';
import { ETokenPages } from '../../Token/router/type';

import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';

function HomeAccountSelectorInfoDemo() {
  return (
    <YStack mx="$2" my="$4">
      <AccountSelectorTrigger num={0} />
      <AccountSelectorActiveAccount num={0} />
      <Button
        onPress={() => {
          void backgroundApiProxy.serviceHardware.inputPinOnDevice();
        }}
      >
        硬件输入 PIN
      </Button>
      <Button
        onPress={() => {
          void backgroundApiProxy.serviceHardware.inputPassphraseOnDevice();
        }}
      >
        硬件输入 Passphrase
      </Button>
    </YStack>
  );
}

function HeaderAction({
  icon,
  label,
  onPress,
}: {
  icon?: IKeyOfIcons;
  label?: string;
  onPress?: () => void;
}) {
  const media = useMedia();

  return (
    <Button
      icon={icon}
      // {...(media.md && {
      //   size: 'large',
      // })}
      {...(icon && {
        pl: '$2.5',
        pr: '$0.5',
      })}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

function HomePage() {
  const form = useForm();
  const [addressType, setAddressType] = useState('nested-segWit');
  const navigation = useAppNavigation();

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
      // {
      //   title: 'Defi',
      //   page: memo(DefiListContainer, () => true),
      // },
      {
        title: intl.formatMessage({
          id: 'transaction__history',
        }),
        page: memo(TxHistoryListContainer, () => true),
      },
    ],
    [intl],
  );

  const handleChainPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.ChainSelector,
    });
  }, [navigation]);

  const handleReceivePress = useCallback(() => {
    navigation.pushModal(EModalRoutes.TokenModal, {
      screen: ETokenPages.Receive,
    });
  }, [navigation]);

  const navigateOnboardingModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.GetStarted,
    });
  }, [navigation]);

  const handleSendPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.TokenModal, {
      screen: ETokenPages.TokenList,
      params: {
        title: 'Select a Token',
        onTokenPress: () => {
          navigation.push(ETokenPages.Send, {
            params: {
              fromTokenList: true,
            },
          });
        },
      },
    });
  }, [navigation]);

  const renderHeaderView = useCallback(
    () => (
      <Stack
        p="$5"
        $gtMd={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* <XStack justifyContent="space-between" alignItems="center" px="$2">
          <YStack>
            <AccountSelectorTrigger num={0} />
            <AccountSelectorActiveAccount num={0} />
          </YStack>
          <WalletActionsContainer />
        </XStack> */}
        <Stack>
          <XStack mb="$1" alignItems="center">
            {/* <NetworkSelectorTrigger num={0} /> */}
            <NetworkSelectorTriggerHome num={0} />
            <AccountSelectorActiveAccountHome num={0} />
            <DeriveTypeSelectorTrigger miniMode num={0} />
          </XStack>

          <Stack mt="$1">
            <SizableText
              size="$heading4xl"
              $gtMd={{
                size: '$heading5xl',
              }}
            >
              $2,235.00
            </SizableText>
          </Stack>
        </Stack>
        <XStack space="$2" mt="$5">
          {/* <HeaderAction icon="PlusLargeOutline" label="Buy" /> */}
          <HeaderAction
            // icon="ArrowTopOutline"
            label="Send"
            onPress={handleSendPress}
          />
          <HeaderAction
            // icon="ArrowBottomOutline"
            label="Receive"
            onPress={() =>
              Dialog.confirm({
                title: 'Lighting Invoice',
                renderContent: (
                  <Stack>
                    <Form form={form}>
                      <AccountSelectorProviderMirror
                        config={{
                          sceneName: EAccountSelectorSceneName.discover,
                          sceneUrl: 'https://www.bing.com',
                        }}
                        enabledNum={[1]}
                      >
                        <NetworkSelectorTrigger key={1} num={1} />
                      </AccountSelectorProviderMirror>

                      <AccountSelectorProviderMirror
                        config={{
                          sceneName: EAccountSelectorSceneName.discover,
                          sceneUrl: 'https://www.bing.com',
                        }}
                        enabledNum={[0]}
                      >
                        <NetworkSelectorTrigger key={0} num={0} />
                      </AccountSelectorProviderMirror>

                      <AccountSelectorProviderMirror
                        config={{
                          sceneName: EAccountSelectorSceneName.home,
                        }}
                        enabledNum={[1]}
                      />
                      <Form.Field
                        label="Amount"
                        name="amount"
                        description="$0.00"
                      >
                        <Input
                          placeholder="Enter amount"
                          size="large"
                          keyboardType="number-pad"
                          addOns={[
                            {
                              label: 'sats',
                            },
                          ]}
                        />
                      </Form.Field>

                      <Form.Field
                        label="Description"
                        description="Enter a brief description for the payment. This helps the recipient identify and record the transaction."
                        name="description"
                        optional
                      >
                        <TextArea
                          size="large"
                          placeholder="e.g., Coffee purchase, Invoice #12345"
                        />
                      </Form.Field>
                    </Form>
                  </Stack>
                ),
                onConfirm: async ({ close }) => {
                  await close();
                  handleReceivePress();
                },
              })
            }
          />
          <HeaderAction
            // icon="SwitchHorOutline"
            label="Swap"
          />
          <HeaderAction icon="DotHorOutline" />
        </XStack>

        <HomeAccountSelectorInfoDemo />
      </Stack>
    ),
    [form, handleReceivePress, handleSendPress],
  );

  // useMemo(() => {
  //   navigateOnboardingModal();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);
  const headerTitle = useCallback(
    () => (
      <AccountSelectorProviderMirror
        enabledNum={[0]}
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
          {/* <YStack>
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
          <WalletActionsContainer /> */}
        </XStack>
      }
    />
  );

  return useMemo(
    () => (
      <Page>
        <Page.Header headerTitle={headerTitle} headerRight={headerRight} />
        <Page.Body>
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
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomePage />
    </AccountSelectorProviderMirror>
  );
}

export { HomePageContainer };
