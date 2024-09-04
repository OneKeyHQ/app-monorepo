import { useCallback } from 'react';

import {
  Icon,
  IconButton,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerAddressSingle } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EDAppConnectionModal,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { useShouldUpdateConnectedAccount } from '../../../Discovery/hooks/useDAppNotifyChanges';
import useActiveTabDAppInfo from '../../hooks/useActiveTabDAppInfo';
import {
  type IHandleAccountChangedParams,
  useHandleDiscoveryAccountChanged,
} from '../../hooks/useHandleAccountChanged';

function SingleAccountAddressSelectorTrigger({
  origin,
  num,
  account,
  afterChangeAccount,
}: {
  origin: string;
  num: number;
  account: IConnectionAccountInfoWithNum;
  afterChangeAccount: () => void;
}) {
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  const handleAccountChanged = useCallback(
    async (accountChangedParams: IHandleAccountChangedParams) => {
      await handleAccountInfoChanged({
        origin,
        accountSelectorNum: num,
        prevAccountInfo: account,
        accountChangedParams,
        storageType: account.storageType,
        afterUpdate: afterChangeAccount,
      });
    },
    [num, account, afterChangeAccount, handleAccountInfoChanged, origin],
  );

  useHandleDiscoveryAccountChanged({
    num,
    handleAccountChanged,
  });
  return <AccountSelectorTriggerAddressSingle num={num} />;
}

export default function DAppConnectExtensionFloatingTrigger() {
  // const intl = useIntl();
  const { result, refreshConnectionInfo } = useActiveTabDAppInfo();
  // const [activeTabId, setActiveTabId] = useState<number | null>(null);
  // const { result, run } = usePromiseResult(
  //   () =>
  //     new Promise<{
  //       url: string;
  //       origin: string;
  //       showFloatingButton: boolean;
  //       connectedAccountsInfo: IConnectionAccountInfoWithNum[] | null;
  //       faviconUrl: string | undefined;
  //       originFaviconUrl: string | undefined;
  //       connectLabel: string;
  //       networkIcons: string[];
  //       addressLabel: string;
  //     } | null>((resolve) => {
  //       chrome.tabs.query(
  //         { active: true, currentWindow: true },
  //         async (tabs) => {
  //           if (tabs[0]) {
  //             try {
  //               const currentOrigin = new URL(tabs[0]?.url ?? '').origin;
  //               const hostName = new URL(currentOrigin).hostname;
  //               const connectLabel = intl.formatMessage(
  //                 { id: ETranslations.dapp_connect_connect_to_website },
  //                 { url: hostName },
  //               );
  //               const connectedAccountsInfo =
  //                 (await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
  //                   currentOrigin,
  //                 )) ?? [];
  //               const networkIcons = await Promise.all(
  //                 connectedAccountsInfo.map(async (accountInfo) => {
  //                   const network =
  //                     await backgroundApiProxy.serviceNetwork.getNetwork({
  //                       networkId: accountInfo.networkId,
  //                     });
  //                   return network.logoURI ?? '';
  //                 }),
  //               );
  //               let addressLabel = '';
  //               if (connectedAccountsInfo.length > 0) {
  //                 if (connectedAccountsInfo.length === 1) {
  //                   addressLabel = accountUtils.shortenAddress({
  //                     address: connectedAccountsInfo[0].address,
  //                   });
  //                 } else {
  //                   addressLabel = intl.formatMessage(
  //                     { id: ETranslations.global_count_addresses },
  //                     { count: connectedAccountsInfo.length },
  //                   );
  //                 }
  //               }
  //               const faviconUrl =
  //                 await backgroundApiProxy.serviceDiscovery.buildWebsiteIconUrl(
  //                   currentOrigin,
  //                   40,
  //                 );
  //               resolve({
  //                 url: tabs[0].url ?? '',
  //                 origin: currentOrigin,
  //                 showFloatingButton: (connectedAccountsInfo ?? []).length > 0,
  //                 connectedAccountsInfo,
  //                 faviconUrl,
  //                 originFaviconUrl: tabs[0].favIconUrl,
  //                 connectLabel,
  //                 networkIcons,
  //                 addressLabel,
  //               });
  //               return;
  //             } catch (error) {
  //               console.error('DappConnectExtensionPanel error:', error);
  //               resolve(null);
  //               return;
  //             }
  //           }
  //           resolve(null);
  //         },
  //       );
  //     }),
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  //   [activeTabId],
  //   {
  //     checkIsFocused: false,
  //   },
  // );

  // useEffect(() => {
  //   const handleTabChange = (
  //     tabId: number,
  //     changeInfo: chrome.tabs.TabChangeInfo,
  //     tab: chrome.tabs.Tab,
  //   ) => {
  //     if (changeInfo.status === 'complete' && tab.active) {
  //       setActiveTabId(tabId);
  //     }
  //   };

  //   const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
  //     setActiveTabId(activeInfo.tabId);
  //   };

  //   chrome.tabs.onUpdated.addListener(handleTabChange);
  //   chrome.tabs.onActivated.addListener(handleTabActivated);

  //   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  //     if (tabs[0]) {
  //       setActiveTabId(tabs[0].id ?? null);
  //     }
  //   });

  //   return () => {
  //     chrome.tabs.onUpdated.removeListener(handleTabChange);
  //     chrome.tabs.onActivated.removeListener(handleTabActivated);
  //   };
  // }, []);

  // useEffect(() => {
  //   appEventBus.on(EAppEventBusNames.DAppConnectUpdate, run);
  //   return () => {
  //     appEventBus.off(EAppEventBusNames.DAppConnectUpdate, run);
  //   };
  // }, [run]);

  const navigation = useAppNavigation();
  const handlePressFloatingButton = useCallback(() => {
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.CurrentConnectionModal,
      params: {
        origin: result?.origin ?? '',
        faviconUrl: result?.faviconUrl ?? '',
      },
    });
  }, [result, navigation]);

  const onDisconnect = useCallback(async () => {
    if (result?.connectedAccountsInfo?.[0].storageType) {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin: result?.origin ?? '',
        storageType: result?.connectedAccountsInfo?.[0].storageType,
      });
      void refreshConnectionInfo();
    }
  }, [result?.origin, result?.connectedAccountsInfo, refreshConnectionInfo]);

  if (!result?.showFloatingPanel) {
    return null;
  }

  return (
    <Stack
      position="absolute"
      bottom="0"
      right="0"
      left="0"
      h="$16"
      w="100%"
      py="$3"
      px="$5"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      bg="$bgApp"
      borderTopWidth="$px"
      borderBottomWidth="0"
      borderLeftWidth="0"
      borderRightWidth="0"
      borderColor="$border"
      onPress={handlePressFloatingButton}
    >
      <XStack alignItems="center" gap="$3">
        <Stack position="relative">
          <Image size="$9" borderRadius="$2">
            <Image.Source
              src={result?.faviconUrl || result?.originFaviconUrl}
            />
            <Image.Fallback>
              <Icon size="$10" name="GlobusOutline" />
            </Image.Fallback>
            <Image.Loading>
              <Skeleton width="100%" height="100%" />
            </Image.Loading>
          </Image>
          <Stack
            position="absolute"
            bottom={-2}
            right={-2}
            justifyContent="center"
            alignItems="center"
            w="$3"
            h="$3"
            borderRadius="$full"
            bg="$bg"
            zIndex="$1"
          >
            <Stack w="$2" h="$2" bg="$iconSuccess" borderRadius="$full" />
          </Stack>
        </Stack>
        <YStack maxWidth={276}>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {result?.connectLabel}
          </SizableText>
          {result?.connectedAccountsInfo?.length === 1 ? (
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.discover,
                sceneUrl: result?.origin ?? '',
              }}
              enabledNum={result?.connectedAccountsInfo?.map(
                (account) => account.num,
              )}
              availableNetworksMap={result?.connectedAccountsInfo?.reduce(
                (acc, account) => {
                  if (Array.isArray(account.availableNetworkIds)) {
                    acc[account.num] = {
                      networkIds: account.availableNetworkIds,
                    };
                  }
                  return acc;
                },
                {} as Record<number, { networkIds: string[] }>,
              )}
            >
              <SingleAccountAddressSelectorTrigger
                origin={result?.origin ?? ''}
                num={result?.connectedAccountsInfo?.[0]?.num}
                account={result?.connectedAccountsInfo?.[0]}
                afterChangeAccount={() => {
                  void refreshConnectionInfo();
                }}
              />
            </AccountSelectorProviderMirror>
          ) : (
            <XStack
              alignItems="center"
              borderRadius="$2"
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusable
              focusVisibleStyle={{
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              }}
              onPress={() => {}}
            >
              {result?.networkIcons.slice(0, 2).map((icon, index) => (
                <Token
                  key={icon}
                  size="xs"
                  tokenImageUri={icon}
                  ml={index === 1 ? '$-2' : undefined}
                  borderColor={index === 1 ? '$bgApp' : undefined}
                  borderWidth={index === 1 ? 2 : undefined}
                  borderStyle={index === 1 ? 'solid' : undefined}
                  // @ts-expect-error
                  style={index === 1 ? { boxSizing: 'content-box' } : undefined}
                />
              ))}
              <SizableText pl="$1" size="$bodySm" numberOfLines={1}>
                {result?.addressLabel}
              </SizableText>
              <Icon
                size="$4"
                color="$iconSubdued"
                name="ChevronRightSmallOutline"
              />
            </XStack>
          )}
        </YStack>
      </XStack>
      <IconButton
        icon="BrokenLinkOutline"
        size="medium"
        variant="tertiary"
        onPress={onDisconnect}
      />
    </Stack>
  );
}
