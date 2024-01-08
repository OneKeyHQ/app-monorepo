import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { RefreshControl, useWindowDimensions } from 'react-native';
import { useMedia } from 'tamagui';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Form,
  Icon,
  IconButton,
  Image,
  Input,
  Page,
  Popover,
  Select,
  SizableText,
  Stack,
  Tab,
  TextArea,
  Toast,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { getTokens, useForm } from '@onekeyhq/components/src/hooks';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { markFPTime } from '@onekeyhq/shared/src/modules3rdParty/metrics';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccount,
  AccountSelectorProvider,
  AccountSelectorProviderMirror,
  AccountSelectorTrigger,
  AccountSelectorTriggerHome,
} from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EChainSelectorPages } from '../../ChainSelector/router/type';
import { EOnboardingPages } from '../../Onboarding/router/type';
import { ETokenPages } from '../../Token/router/type';

import { DefiListContainer } from './DefiListContainer';
import { NFTListContainer } from './NFTListContainer';
import { TokenListContainerWithProvider } from './TokenListContainer';
import { TxHistoryListContainer } from './TxHistoryContainer';
import { WalletActionsContainer } from './WalletActionsContainer';

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
      screen: EChainSelectorPages.Selector,
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
          <XStack mb="$1">
            <XStack
              alignItems="center"
              onPress={handleChainPress}
              p="$1"
              m="$-1"
              borderRadius="$2"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusable
              focusStyle={{
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              }}
              $platform-native={{
                hitSlop: {
                  top: 8,
                  bottom: 8,
                  left: 8,
                },
              }}
            >
              <Image
                w="$5"
                h="$5"
                source={{
                  uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
                }}
              />
              <SizableText
                userSelect="none"
                pl="$2"
                size="$bodyMd"
                color="$textSubdued"
              >
                Bitcoin
              </SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                color="$iconSubdued"
                size="$5"
              />
            </XStack>
            <Tooltip
              renderContent="Copy to clipboard"
              placement="top"
              renderTrigger={
                <XStack
                  alignItems="center"
                  onPress={() =>
                    Toast.success({
                      title: 'Copied',
                    })
                  }
                  p="$1"
                  px="$2"
                  my="$-1"
                  ml="$1"
                  borderRadius="$2"
                  hoverStyle={{
                    bg: '$bgHover',
                  }}
                  pressStyle={{
                    bg: '$bgActive',
                  }}
                  focusable
                  focusStyle={{
                    outlineWidth: 2,
                    outlineColor: '$focusRing',
                    outlineStyle: 'solid',
                  }}
                  $platform-native={{
                    hitSlop: {
                      top: 8,
                      right: 8,
                      bottom: 8,
                    },
                  }}
                >
                  <SizableText
                    userSelect="none"
                    size="$bodyMd"
                    color="$textSubdued"
                  >
                    37rdQk...PCTG
                  </SizableText>
                </XStack>
              }
            />
            {/* <Select
              title="Switch Type"
              value={addressType}
              onChange={setAddressType}
              floatingPanelProps={{
                width: '$80',
              }}
              items={[
                {
                  label: 'Nested SegWit',
                  value: 'nested-segWit',
                  description: "Starts with '3'. Medium network fee.",
                },
                {
                  label: 'Taproot',
                  value: 'taproot',
                  description: "Starts with 'bc1p'. Extra low network fee.",
                },
                {
                  label: 'Native SegWit',
                  value: 'native-segWit',
                  description: "Starts with with 'bc1'. Low network fee.",
                },
                {
                  label: 'Legacy',
                  value: 'legacy',
                  description: "Starts with '1'. High network fee.",
                },
              ]}
              renderTrigger={() => (
                <IconButton
                  title="Switch Type"
                  icon="RepeatOutline"
                  size="small"
                  variant="tertiary"
                  iconProps={{
                    size: '$4.5',
                  }}
                  mx="$0"
                  $platform-native={{
                    hitSlop: {
                      right: 8,
                      top: 8,
                      bottom: 8,
                    },
                  }}
                />
              )}
            /> */}
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
      </Stack>
    ),
    [form, handleChainPress, handleReceivePress],
  );

  // useMemo(() => {
  //   navigateOnboardingModal();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);
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
