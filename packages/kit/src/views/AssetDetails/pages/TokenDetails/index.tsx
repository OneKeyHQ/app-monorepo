/* eslint-disable react/no-unstable-nested-components */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { isEmpty, uniqBy } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IActionListSection,
  IListViewProps,
  ISectionListProps,
  IStackProps,
  ITabContainerRef,
} from '@onekeyhq/components';
import {
  ActionList,
  Badge,
  Button,
  Icon,
  IconButton,
  Page,
  Popover,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  Tabs,
  Toast,
  XStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { openTokenDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import {
  buildTokenListMapKey,
  sortTokensCommon,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type {
  IAccountToken,
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';

import {
  TokenDetailsContext,
  useTokenDetailsContext,
} from './TokenDetailsContext';
import TokenDetailsFooter from './TokenDetailsFooter';
import TokenDetailsTabToolbar from './TokenDetailsTabToolbar';
import TokenDetailsViews from './TokenDetailsView';

import type { ITokenDetailsContextValue } from './TokenDetailsContext';
import type { RouteProp } from '@react-navigation/core';

const num = 0;

export type IProps = {
  accountId: string;
  networkId: string;
  walletId: string;
  tokenInfo: IToken;
  isBlocked?: boolean;
  riskyTokens?: string[];
  isAllNetworks?: boolean;
  isTabView?: boolean;
  listViewContentContainerStyle?: IListViewProps<IAccountHistoryTx>['contentContainerStyle'];
  indexedAccountId?: string;
  inTabList?: boolean;
  ListHeaderComponent?: ISectionListProps<any>['ListHeaderComponent'];
  deriveInfo?: IAccountDeriveInfo;
  deriveType?: IAccountDeriveTypes;
  allNetworksState?: {
    disabledNetworks: Record<string, boolean>;
    enabledNetworks: Record<string, boolean>;
  };
  refreshAllNetworkState?: () => void;
} & IStackProps;
function TokenDetailsView() {
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.TokenDetails
      >
    >();

  const { copyText } = useClipboard();

  const { updateTokenMetadata, batchUpdateTokenDetails } =
    useTokenDetailsContext();

  const {
    accountId,
    networkId,
    walletId,
    tokenInfo,
    isAllNetworks,
    indexedAccountId,
    tokenMap,
    aggregateTokens: aggregateTokensParam,
    accountAddress,
  } = route.params;

  const { gtMd } = useMedia();

  const tabsRef = useRef<ITabContainerRef | null>(null);

  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const { vaultSettings, network } = useAccountData({ networkId });

  const { result: tokens, isLoading: isLoadingTokens } = usePromiseResult(
    async () => {
      if (tokenInfo.isAggregateToken) {
        const { allAggregateTokenMap } =
          await backgroundApiProxy.serviceToken.getAllAggregateTokenInfo();
        const aggregateTokens: IAccountToken[] = [];

        const { unavailableItems } =
          await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
            { accountId, walletId },
          );

        let tokenAccountId;
        let tokenAccountAddress;

        if (accountUtils.isOthersWallet({ walletId })) {
          tokenAccountId = accountId;
          tokenAccountAddress = accountAddress;
        }

        for (const aggregateToken of allAggregateTokenMap?.[tokenInfo.$key]
          ?.tokens ?? []) {
          if (
            aggregateToken.networkId &&
            !unavailableItems.find(
              (item) => item.id === aggregateToken.networkId,
            )
          ) {
            const [deriveType, tokenNetwork] = await Promise.all([
              backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
                networkId: aggregateToken.networkId ?? '',
              }),
              backgroundApiProxy.serviceNetwork.getNetworkSafe({
                networkId: aggregateToken.networkId ?? '',
              }),
            ]);
            if (!accountUtils.isOthersWallet({ walletId })) {
              try {
                const { accounts } =
                  await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts(
                    {
                      indexedAccountIds: [indexedAccountId ?? ''],
                      networkId: aggregateToken.networkId ?? '',
                      deriveType: deriveType ?? 'default',
                    },
                  );
                tokenAccountId = accounts[0]?.id ?? '';
                tokenAccountAddress = accounts[0]?.address ?? '';
              } catch {
                tokenAccountId = undefined;
                tokenAccountAddress = undefined;
              }
            }

            const originalToken = aggregateTokensParam?.find(
              (t) =>
                t.address === aggregateToken.address &&
                t.networkId === aggregateToken.networkId,
            );

            if (originalToken) {
              aggregateTokens.push({
                ...originalToken,
                accountId: originalToken.accountId ?? tokenAccountId ?? '',
              });
            } else {
              aggregateTokens.push({
                ...aggregateToken,
                accountId: tokenAccountId ?? '',
                networkName: tokenNetwork?.name ?? '',
                $key: buildTokenListMapKey({
                  networkId: aggregateToken.networkId ?? '',
                  accountAddress: tokenAccountAddress ?? '',
                  tokenAddress: aggregateToken.address ?? '',
                }),
              });
            }
          }
        }

        return uniqBy(
          sortTokensCommon({
            tokens: aggregateTokens,
            tokenListMap: tokenMap ?? {},
          }),
          (token) => token.$key,
        );
      }

      return [tokenInfo];
    },
    [
      tokenInfo,
      accountId,
      walletId,
      tokenMap,
      aggregateTokensParam,
      indexedAccountId,
      accountAddress,
    ],
    {
      watchLoading: true,
      initResult: [],
    },
  );

  const { result: allNetworksState, run: refreshAllNetworkState } =
    usePromiseResult(
      async () => {
        if (isAllNetworks) {
          return backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
        }
        return {
          disabledNetworks: {},
          enabledNetworks: {},
        };
      },
      [isAllNetworks],
      {
        initResult: {
          disabledNetworks: {},
          enabledNetworks: {},
        },
      },
    );

  const renderAggregateTokens = useCallback(
    ({ closePopover }: { closePopover: () => void }) => {
      return (
        <ScrollView
          contentContainerStyle={{
            gap: '$5',
            px: '$5',
            pt: '$2',
            pb: '$5',
            $gtMd: {
              px: '$3',
              py: '$2.5',
              gap: '$3',
            },
          }}
        >
          <SizableText
            $md={{
              display: 'none',
            }}
            size="$headingSm"
          >
            {intl.formatMessage({
              id: ETranslations.global_contract_address,
            })}
          </SizableText>
          {tokens.map((token) => (
            <XStack
              key={token.$key}
              alignItems="center"
              gap="$3"
              $gtMd={{
                gap: '$2',
              }}
            >
              <NetworkAvatar
                networkId={token.networkId}
                size={gtMd ? '$4' : '$6'}
              />
              <SizableText
                size="$bodyLg"
                flex={1}
                numberOfLines={1}
                $gtMd={{
                  size: '$bodyMd',
                }}
              >
                {token.networkName}
              </SizableText>
              {!token.address ? null : (
                <XStack gap="$3" alignItems="center">
                  <Button
                    size="small"
                    variant="tertiary"
                    onPress={() => copyText(token.address)}
                  >
                    <XStack alignItems="center" gap="$2">
                      <SizableText
                        fontFamily="$monoRegular"
                        size="$bodyLg"
                        $gtMd={{
                          size: '$bodyMd',
                        }}
                        color="$textSubdued"
                      >
                        {accountUtils.shortenAddress({
                          address: token.address,
                          leadingLength: gtMd ? 6 : 4,
                          trailingLength: 4,
                        })}
                      </SizableText>
                      <Icon
                        name="Copy3Outline"
                        size="$5"
                        color="$iconSubdued"
                        $gtMd={{
                          size: '$4',
                        }}
                      />
                    </XStack>
                  </Button>
                  <IconButton
                    title={intl.formatMessage({
                      id: ETranslations.global_view_in_blockchain_explorer,
                    })}
                    iconSize={gtMd ? '$4' : '$5'}
                    variant="tertiary"
                    icon="OpenOutline"
                    iconColor="$iconSubdued"
                    size="small"
                    onPress={() => {
                      closePopover();
                      void openTokenDetailsUrl({
                        networkId: token.networkId ?? '',
                        tokenAddress: token.address,
                      });
                    }}
                  />
                </XStack>
              )}
            </XStack>
          ))}
        </ScrollView>
      );
    },
    [intl, tokens, gtMd, copyText],
  );

  const headerRight = useCallback(() => {
    const sections: IActionListSection[] = [];

    if (
      tokenInfo.isAggregateToken &&
      tokens.length > 1 &&
      !tokenInfo.isNative
    ) {
      return (
        <Popover
          title={intl.formatMessage({
            id: ETranslations.global_contract_address,
          })}
          sheetProps={{
            snapPoints: [92],
            snapPointsMode: 'percent',
          }}
          renderTrigger={<HeaderIconButton icon="InfoCircleOutline" />}
          renderContent={renderAggregateTokens}
          floatingPanelProps={{
            width: 320,
            maxHeight: 372,
          }}
        />
      );
    }

    if (!tokenInfo?.isNative) {
      sections.push({
        items: [
          {
            label: intl.formatMessage({
              id: ETranslations.global_copy_token_contract,
            }),
            icon: 'Copy3Outline',
            onPress: () => copyText(tokenInfo?.address ?? ''),
          },
        ],
      });

      if (tokenInfo?.address) {
        sections[0].items.push({
          label: intl.formatMessage({
            id: ETranslations.global_view_in_blockchain_explorer,
          }),
          icon: 'OpenOutline',
          onPress: () =>
            openTokenDetailsUrl({
              networkId: tokenInfo.networkId ?? '',
              tokenAddress: tokenInfo?.address,
            }),
        });
      }
    }

    return isEmpty(sections) ? null : (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.global_more })}
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
        sections={sections}
      />
    );
  }, [
    tokenInfo.isAggregateToken,
    tokenInfo?.isNative,
    tokenInfo?.address,
    tokenInfo.networkId,
    tokens.length,
    intl,
    renderAggregateTokens,
    copyText,
  ]);

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (
        !tokenInfo.networkId ||
        !indexedAccountId ||
        !vaultSettings?.mergeDeriveAssetsEnabled
      )
        return;
      const r =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId: tokenInfo.networkId ?? '',
            indexedAccountId,
          },
        );
      await waitAsync(600);
      return r;
    },
    [indexedAccountId, tokenInfo, vaultSettings?.mergeDeriveAssetsEnabled],
    {
      watchLoading: true,
    },
  );

  usePromiseResult(async () => {
    const activeToken = tokens[activeTabIndex] ?? tokens[0];
    if (!activeToken) return;

    const resp = await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
      networkId: activeToken.networkId ?? '',
      tokenAddress: activeToken.address,
    });
    updateTokenMetadata({
      price: resp?.price ?? 0,
      priceChange24h: resp?.price24h ?? 0,
      coingeckoId: resp?.info?.coingeckoId ?? '',
    });
  }, [activeTabIndex, tokens, updateTokenMetadata]);

  const listViewContentContainerStyle = useMemo(() => ({ pt: '$5' }), []);
  const tabs = useMemo(() => {
    if (tokens.length > 1) {
      return tokens.map((token) => (
        <Tabs.Tab key={token.$key} name={token.networkName ?? ''}>
          <TokenDetailsViews
            inTabList
            isTabView
            accountId={token.accountId ?? ''}
            networkId={token.networkId ?? ''}
            walletId={walletId}
            tokenInfo={token}
            isAllNetworks={isAllNetworks}
            listViewContentContainerStyle={listViewContentContainerStyle}
            indexedAccountId={indexedAccountId}
            allNetworksState={allNetworksState}
            refreshAllNetworkState={refreshAllNetworkState}
          />
        </Tabs.Tab>
      ));
    }

    if (networkId && walletId) {
      if (vaultSettings?.mergeDeriveAssetsEnabled) {
        return result?.networkAccounts.map((item, index) => (
          <Tabs.Tab
            key={String(index)}
            name={
              item.deriveInfo.labelKey
                ? intl.formatMessage({ id: item.deriveInfo.labelKey })
                : item.deriveInfo.label ?? String(index)
            }
          >
            <TokenDetailsViews
              inTabList
              isTabView
              accountId={item.account?.id ?? ''}
              networkId={tokenInfo.networkId ?? ''}
              walletId={walletId}
              deriveInfo={item.deriveInfo}
              deriveType={item.deriveType}
              tokenInfo={tokenInfo}
              isAllNetworks={isAllNetworks}
              listViewContentContainerStyle={listViewContentContainerStyle}
              indexedAccountId={indexedAccountId}
            />
          </Tabs.Tab>
        ));
      }

      return [
        <Tabs.Tab key={String(tokenInfo.$key)} name="">
          <TokenDetailsViews
            accountId={tokenInfo.accountId ?? ''}
            networkId={tokenInfo.networkId ?? ''}
            walletId={walletId}
            tokenInfo={tokenInfo}
            isAllNetworks={isAllNetworks}
            listViewContentContainerStyle={listViewContentContainerStyle}
            indexedAccountId={indexedAccountId}
          />
        </Tabs.Tab>,
      ];
    }

    return [];
  }, [
    tokens,
    networkId,
    walletId,
    isAllNetworks,
    listViewContentContainerStyle,
    indexedAccountId,
    allNetworksState,
    refreshAllNetworkState,
    vaultSettings?.mergeDeriveAssetsEnabled,
    tokenInfo,
    result?.networkAccounts,
    intl,
  ]);

  const handleTabIndexChange = useCallback(
    async (index: number) => {
      setActiveTabIndex(index);
      if (isAllNetworks && tokens.length > 1 && tokens[index]) {
        const activeToken = tokens[index];

        if (
          activeToken.accountId &&
          activeToken.networkId &&
          !isEnabledNetworksInAllNetworks({
            networkId: activeToken.networkId,
            disabledNetworks: allNetworksState.disabledNetworks,
            enabledNetworks: allNetworksState.enabledNetworks,
            isTestnet: false,
          })
        ) {
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: { [activeToken.networkId]: true },
          });
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.network_also_enabled,
            }),
          });
          void refreshAllNetworkState();
        }
      }
    },
    [
      tokens,
      allNetworksState.disabledNetworks,
      allNetworksState.enabledNetworks,
      intl,
      refreshAllNetworkState,
      isAllNetworks,
    ],
  );

  const tokenDetailsViewElement = useMemo(() => {
    if (isLoading || isLoadingTokens)
      return (
        <Stack
          flex={1}
          height="100%"
          alignItems="center"
          justifyContent="center"
        >
          <Spinner size="large" />
        </Stack>
      );
    if (
      (!accountUtils.isOthersWallet({ walletId }) &&
        vaultSettings?.mergeDeriveAssetsEnabled) ||
      tokens.length > 1
    ) {
      if (tabs && !isEmpty(tabs) && tabs.length > 1) {
        return (
          <Tabs.Container
            ref={tabsRef as any}
            onIndexChange={handleTabIndexChange}
            renderTabBar={(props) => (
              <Tabs.TabBar
                {...props}
                scrollable
                renderToolbar={() => (
                  <TokenDetailsTabToolbar
                    tokens={tokens}
                    onSelected={(token) => {
                      tabsRef.current?.jumpToTab(token.networkName ?? '');
                    }}
                  />
                )}
              />
            )}
          >
            {tabs}
          </Tabs.Container>
        );
      }
      return null;
    }

    return (
      <TokenDetailsViews
        accountId={tokenInfo.accountId ?? accountId}
        networkId={tokenInfo.networkId ?? networkId}
        walletId={walletId}
        tokenInfo={tokenInfo}
        isAllNetworks={isAllNetworks}
        indexedAccountId={indexedAccountId}
        listViewContentContainerStyle={listViewContentContainerStyle}
      />
    );
  }, [
    isLoading,
    isLoadingTokens,
    walletId,
    vaultSettings?.mergeDeriveAssetsEnabled,
    tokens,
    tokenInfo,
    accountId,
    networkId,
    isAllNetworks,
    indexedAccountId,
    listViewContentContainerStyle,
    tabs,
    handleTabIndexChange,
  ]);

  const headerTitle = useCallback(() => {
    return (
      <XStack alignItems="center" gap="$2">
        <Token
          size="sm"
          tokenImageUri={tokenInfo.logoURI}
          networkImageUri={
            tokens.length <= 1 && !gtMd ? network?.logoURI : undefined
          }
          networkId={networkId}
        />
        <SizableText size="$headingLg" numberOfLines={1}>
          {tokenInfo.commonSymbol ?? tokenInfo.symbol ?? tokenInfo.name ?? ''}
        </SizableText>
        {!isLoadingTokens &&
        !isLoading &&
        (tokens?.length <= 1 || !tokenInfo.isAggregateToken) &&
        gtMd ? (
          <Badge badgeSize="sm">
            <Badge.Text>{tokenInfo.networkName ?? ''}</Badge.Text>
          </Badge>
        ) : null}
      </XStack>
    );
  }, [
    tokenInfo.logoURI,
    tokenInfo.commonSymbol,
    tokenInfo.symbol,
    tokenInfo.name,
    tokenInfo.isAggregateToken,
    tokenInfo.networkName,
    tokens.length,
    gtMd,
    network?.logoURI,
    networkId,
    isLoadingTokens,
    isLoading,
  ]);

  useEffect(() => {
    if (tokens?.length > 0 && tokenMap) {
      const details = tokens
        .map((token) => {
          const tokenFiat = tokenMap[token.$key];
          if (tokenFiat) {
            return {
              accountId: token.accountId ?? accountId,
              networkId: token.networkId ?? networkId,
              isInit: true,
              data: {
                info: token,
                ...tokenFiat,
              },
            };
          }
          return undefined;
        })
        .filter((detail) => detail !== undefined);
      batchUpdateTokenDetails(details);
    }
  }, [tokens, tokenMap, accountId, networkId, batchUpdateTokenDetails]);

  return (
    <Page lazyLoad safeAreaEnabled={false}>
      <Page.Header headerRight={headerRight} headerTitle={headerTitle} />
      <Page.Body>{tokenDetailsViewElement}</Page.Body>
      <TokenDetailsFooter networkId={networkId} />
    </Page>
  );
}

const TokenDetails = memo(TokenDetailsView);

export default function TokenDetailsModal() {
  // Context state
  const [tokenMetadata, setTokenMetadata] =
    useState<ITokenDetailsContextValue['tokenMetadata']>();

  const [tokenDetails, setTokenDetails] = useState<
    ITokenDetailsContextValue['tokenDetails']
  >({});

  const [tokenAccountMap, setTokenAccountMap] = useState<
    Record<string, string>
  >({});

  const [isLoadingTokenDetails, setIsLoadingTokenDetails] = useState<
    ITokenDetailsContextValue['isLoadingTokenDetails']
  >({});

  const updateTokenMetadata = useCallback(
    (data: Partial<ITokenDetailsContextValue['tokenMetadata']>) => {
      setTokenMetadata((prev) => ({
        ...prev,
        ...data,
      }));
    },
    [],
  );

  const updateIsLoadingTokenDetails = useCallback(
    ({ accountId, isLoading }: { accountId: string; isLoading: boolean }) => {
      setIsLoadingTokenDetails((prev) => ({
        ...prev,
        [accountId]: isLoading,
      }));
    },
    [],
  );

  const updateTokenDetails = useCallback(
    ({
      accountId,
      networkId,
      isInit,
      data,
    }: {
      accountId: string;
      networkId: string;
      isInit: boolean;
      data: IFetchTokenDetailItem;
    }) => {
      setTokenDetails((prev) => ({
        ...prev,
        [`${accountId}_${networkId}`]: { init: isInit, data },
      }));
    },
    [],
  );

  const batchUpdateTokenDetails = useCallback(
    (
      details: {
        accountId: string;
        networkId: string;
        isInit: boolean;
        data: IFetchTokenDetailItem;
      }[],
    ) => {
      const dataToUpdate = details.reduce(
        (acc, detail) => ({
          ...acc,
          [`${detail.accountId}_${detail.networkId}`]: {
            init: detail.isInit,
            data: detail.data,
          },
        }),
        {} as Record<string, { init: boolean; data?: IFetchTokenDetailItem }>,
      );

      setTokenDetails((prev) => ({
        ...prev,
        ...dataToUpdate,
      }));
    },
    [],
  );

  // Context value
  const contextValue = useMemo(
    () => ({
      tokenMetadata,
      updateTokenMetadata,
      isLoadingTokenDetails,
      updateIsLoadingTokenDetails,
      tokenDetails,
      updateTokenDetails,
      batchUpdateTokenDetails,
      tokenAccountMap,
      setTokenAccountMap,
    }),
    [
      tokenMetadata,
      updateTokenMetadata,
      isLoadingTokenDetails,
      updateIsLoadingTokenDetails,
      tokenDetails,
      updateTokenDetails,
      batchUpdateTokenDetails,
      tokenAccountMap,
      setTokenAccountMap,
    ],
  );
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[num]}
    >
      <TokenDetailsContext.Provider value={contextValue}>
        <TokenDetails />
      </TokenDetailsContext.Provider>
    </AccountSelectorProviderMirror>
  );
}
