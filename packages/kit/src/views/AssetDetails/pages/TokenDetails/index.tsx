/* eslint-disable react/no-unstable-nested-components */
import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IActionListSection,
  IListViewProps,
  ISectionListProps,
  IStackProps,
} from '@onekeyhq/components';
import {
  ActionList,
  Badge,
  Button,
  Icon,
  IconButton,
  Page,
  Popover,
  SizableText,
  Spinner,
  Stack,
  Tabs,
  XStack,
  YStack,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type {
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';

import {
  TokenDetailsContext,
  useTokenDetailsContext,
} from './TokenDetailsContext';
import TokenDetailsFooter from './TokenDetailsFooter';
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

  const { updateTokenMetadata } = useTokenDetailsContext();

  const {
    accountId,
    networkId,
    walletId,
    tokens,
    isAllNetworks,
    indexedAccountId,
    isAggregateToken,
  } = route.params;

  const { gtMd } = useMedia();

  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const { vaultSettings, network } = useAccountData({ networkId });

  const renderAggregateTokens = useCallback(
    ({ closePopover }: { closePopover: () => void }) => {
      return (
        <YStack
          gap="$3"
          px="$5"
          pt="$2"
          pb="$5"
          $gtMd={{
            px: '$3',
            py: '$2.5',
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
              gap="$2"
              justifyContent="space-between"
            >
              <XStack
                gap="$2"
                alignItems="center"
                flex={1}
                justifyContent="space-between"
              >
                <XStack gap="$2" alignItems="center">
                  <NetworkAvatar
                    networkId={token.networkId}
                    size={gtMd ? '$4' : '$5'}
                  />
                  <SizableText size="$bodyMd" numberOfLines={1}>
                    {token.networkName}
                  </SizableText>
                </XStack>
              </XStack>
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
                        size="$bodyMd"
                        color="$textSubdued"
                      >
                        {accountUtils.shortenAddress({
                          address: token.address,
                          leadingLength: 6,
                          trailingLength: 4,
                        })}
                      </SizableText>
                      <Icon
                        name="Copy3Outline"
                        size="$4"
                        color="$iconSubdued"
                      />
                    </XStack>
                  </Button>
                  {/* <IconButton
                    title={intl.formatMessage({
                      id: ETranslations.global_copy,
                    })}
                    variant="tertiary"
                    icon="Copy3Outline"
                    iconColor="$iconSubdued"
                    size="small"
                    onPress={() => copyText(token.address)}
                  /> */}
                  <IconButton
                    title={intl.formatMessage({
                      id: ETranslations.global_view_in_blockchain_explorer,
                    })}
                    iconSize="$4"
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
        </YStack>
      );
    },
    [intl, tokens, gtMd, copyText],
  );

  const headerRight = useCallback(() => {
    const sections: IActionListSection[] = [];

    if (isAggregateToken && tokens.length > 1) {
      return (
        <Popover
          title={intl.formatMessage({
            id: ETranslations.global_contract_address,
          })}
          renderTrigger={<HeaderIconButton icon="InfoCircleOutline" />}
          renderContent={renderAggregateTokens}
          floatingPanelProps={{
            width: 320,
          }}
        />
      );
    }

    if (!tokens[0]?.isNative) {
      sections.push({
        items: [
          {
            label: intl.formatMessage({
              id: ETranslations.global_copy_token_contract,
            }),
            icon: 'Copy3Outline',
            onPress: () => copyText(tokens[0]?.address ?? ''),
          },
        ],
      });

      if (tokens[0]?.address) {
        sections[0].items.push({
          label: intl.formatMessage({
            id: ETranslations.global_view_in_blockchain_explorer,
          }),
          icon: 'OpenOutline',
          onPress: () =>
            openTokenDetailsUrl({
              networkId: tokens[0].networkId ?? '',
              tokenAddress: tokens[0]?.address,
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
  }, [isAggregateToken, tokens, intl, renderAggregateTokens, copyText]);

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (
        !tokens[0].networkId ||
        !indexedAccountId ||
        !vaultSettings?.mergeDeriveAssetsEnabled
      )
        return;
      const r =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId: tokens[0].networkId ?? '',
            indexedAccountId,
          },
        );
      await waitAsync(600);
      return r;
    },
    [indexedAccountId, tokens, vaultSettings?.mergeDeriveAssetsEnabled],
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
              networkId={tokens[0].networkId ?? ''}
              walletId={walletId}
              deriveInfo={item.deriveInfo}
              deriveType={item.deriveType}
              tokenInfo={tokens[0]}
              isAllNetworks={isAllNetworks}
              listViewContentContainerStyle={listViewContentContainerStyle}
              indexedAccountId={indexedAccountId}
            />
          </Tabs.Tab>
        ));
      }

      return [
        <Tabs.Tab key={String(tokens[0].$key)} name="">
          <TokenDetailsViews
            accountId={tokens[0].accountId ?? ''}
            networkId={tokens[0].networkId ?? ''}
            walletId={walletId}
            tokenInfo={tokens[0]}
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
    vaultSettings?.mergeDeriveAssetsEnabled,
    isAllNetworks,
    listViewContentContainerStyle,
    indexedAccountId,
    result?.networkAccounts,
    intl,
  ]);

  const tokenDetailsViewElement = useMemo(() => {
    if (isLoading)
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
            onIndexChange={(index) => {
              setActiveTabIndex(index);
            }}
            renderTabBar={(props) => <Tabs.TabBar {...props} scrollable />}
          >
            {tabs}
          </Tabs.Container>
        );
      }
      return null;
    }

    return (
      <TokenDetailsViews
        accountId={tokens[0].accountId ?? accountId}
        networkId={tokens[0].networkId ?? networkId}
        walletId={walletId}
        tokenInfo={tokens[0]}
        isAllNetworks={isAllNetworks}
        indexedAccountId={indexedAccountId}
        listViewContentContainerStyle={listViewContentContainerStyle}
      />
    );
  }, [
    isLoading,
    walletId,
    accountId,
    tokens,
    networkId,
    isAllNetworks,
    indexedAccountId,
    listViewContentContainerStyle,
    tabs,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  const headerTitle = useCallback(() => {
    return (
      <XStack alignItems="center" gap="$2">
        <Token
          size="sm"
          tokenImageUri={tokens[0].logoURI}
          networkImageUri={
            tokens.length <= 1 && !gtMd ? network?.logoURI : undefined
          }
          networkId={networkId}
        />
        <SizableText size="$headingLg" numberOfLines={1}>
          {tokens[0].commonSymbol ?? tokens[0].symbol ?? tokens[0].name ?? ''}
        </SizableText>
        {tokens.length <= 1 && gtMd ? (
          <Badge badgeSize="sm">
            <Badge.Text>{tokens[0].networkName ?? ''}</Badge.Text>
          </Badge>
        ) : null}
      </XStack>
    );
  }, [tokens, gtMd, network?.logoURI, networkId]);

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

  // Context value
  const contextValue = useMemo(
    () => ({
      tokenMetadata,
      updateTokenMetadata,
      isLoadingTokenDetails,
      updateIsLoadingTokenDetails,
      tokenDetails,
      updateTokenDetails,
    }),
    [
      tokenMetadata,
      updateTokenMetadata,
      isLoadingTokenDetails,
      updateIsLoadingTokenDetails,
      tokenDetails,
      updateTokenDetails,
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
