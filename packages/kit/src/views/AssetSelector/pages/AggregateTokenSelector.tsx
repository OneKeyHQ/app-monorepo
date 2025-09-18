import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { uniqBy } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Empty,
  Icon,
  NumberSizeableText,
  Page,
  Spinner,
  Stack,
  Toast,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getListedNetworkMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAssetSelectorRoutes,
  IAssetSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';
import {
  sortTokensByOrder,
  sortTokensCommon,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useAccountSelectorCreateAddress } from '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { EmptySearch } from '../../../components/Empty';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useAggregateTokensListMapAtom,
  useAllTokenListMapAtom,
} from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';

import type { RouteProp } from '@react-navigation/core';

const listedNetworkMap = getListedNetworkMap();

function AggregateTokenListItem({
  token,
  onPress,
  allNetworksState,
  refreshAllNetworkState,
}: {
  token: IAccountToken;
  onPress: ({
    token,
    enabledInAllNetworks,
  }: {
    token: IAccountToken;
    enabledInAllNetworks?: boolean;
  }) => void;
  allNetworksState: {
    disabledNetworks: Record<string, boolean>;
    enabledNetworks: Record<string, boolean>;
  };
  refreshAllNetworkState: ({
    alwaysSetState,
  }: {
    alwaysSetState?: boolean;
  }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const intl = useIntl();

  const [allTokenListMapAtom] = useAllTokenListMapAtom();
  const [settings] = useSettingsPersistAtom();
  const tokenInfo = allTokenListMapAtom[token.$key];
  const {
    activeAccount: { wallet, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const network = listedNetworkMap[token.networkId ?? ''];

  const { createAddress } = useAccountSelectorCreateAddress();

  const { result: accountId, run } = usePromiseResult(async () => {
    if (token.accountId) {
      return token.accountId;
    }

    const deriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: token.networkId ?? '',
      });
    try {
      const account = await backgroundApiProxy.serviceAccount.getNetworkAccount(
        {
          accountId: undefined,
          indexedAccountId: indexedAccount?.id ?? '',
          networkId: token.networkId ?? '',
          deriveType,
        },
      );

      return account?.id;
    } catch {
      return undefined;
    }
  }, [indexedAccount?.id, token.networkId, token.accountId]);

  const handleOnPress = useCallback(async () => {
    if (accountId) {
      onPress({
        token: {
          ...token,
          accountId,
        },
      });
    } else {
      try {
        setLoading(true);
        const globalDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: network?.id ?? '',
          });

        const createAddressResult = await createAddress({
          account: {
            walletId: wallet?.id,
            networkId: network?.id ?? '',
            indexedAccountId: indexedAccount?.id,
            deriveType: globalDeriveType,
          },
          selectAfterCreate: false,
          num: 0,
        });
        if (createAddressResult) {
          const isEnabled =
            token.networkId &&
            isEnabledNetworksInAllNetworks({
              networkId: token.networkId,
              disabledNetworks: allNetworksState.disabledNetworks,
              enabledNetworks: allNetworksState.enabledNetworks,
              isTestnet: false,
            });

          if (!isEnabled && token.networkId) {
            await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
              enabledNetworks: { [token.networkId]: true },
            });
            void refreshAllNetworkState({ alwaysSetState: true });
          }
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.swap_page_toast_address_generated,
            }),
            message: isEnabled
              ? ''
              : intl.formatMessage({
                  id: ETranslations.network_also_enabled,
                }),
          });
          onPress({
            token: {
              ...token,
              accountId: createAddressResult.accounts[0]?.id,
            },
            enabledInAllNetworks: true,
          });
          void run();
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        }
      } finally {
        setLoading(false);
      }
    }
  }, [
    accountId,
    onPress,
    token,
    network?.id,
    createAddress,
    wallet?.id,
    indexedAccount?.id,
    allNetworksState.disabledNetworks,
    allNetworksState.enabledNetworks,
    intl,
    run,
    refreshAllNetworkState,
  ]);

  return (
    <ListItem
      key={token.$key}
      title={token.networkName || network?.name}
      avatarProps={{
        src: network?.logoURI,
      }}
      onPress={handleOnPress}
      {...(!accountId && {
        subtitle: loading
          ? intl.formatMessage({ id: ETranslations.global_creating_address })
          : intl.formatMessage({ id: ETranslations.global_create_address }),
      })}
    >
      <ListItem.Text
        align="right"
        primary={
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            textAlign="right"
          >
            {tokenInfo?.balanceParsed}
          </NumberSizeableText>
        }
        secondary={
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            textAlign="right"
          >
            {tokenInfo?.fiatValue}
          </NumberSizeableText>
        }
      />
      {loading ? (
        <Stack p="$0.5">
          <Spinner />
        </Stack>
      ) : null}
      {!accountId && !loading ? (
        <Icon name="PlusLargeOutline" color="$iconSubdued" />
      ) : null}
    </ListItem>
  );
}

function AggregateTokenSelector() {
  const route =
    useRoute<
      RouteProp<
        IAssetSelectorParamList,
        EAssetSelectorRoutes.AggregateTokenSelector
      >
    >();

  const {
    title,
    aggregateToken,
    searchPlaceholder,
    onSelect,
    closeAfterSelect,
    allAggregateTokenList,
    enableNetworkAfterSelect,
    hideZeroBalanceTokens,
  } = route.params;

  const intl = useIntl();

  const [searchKey, setSearchKey] = useState('');
  const [allTokenListMapAtom] = useAllTokenListMapAtom();
  const navigation = useAppNavigation();

  const [aggregateTokensListMapAtom] = useAggregateTokensListMapAtom();

  const aggregateTokens = useMemo(() => {
    return aggregateTokensListMapAtom[aggregateToken.$key]?.tokens ?? [];
  }, [aggregateTokensListMapAtom, aggregateToken.$key]);

  const { result: allNetworksState, run: refreshAllNetworkState } =
    usePromiseResult(
      async () => {
        return backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
      },
      [],
      {
        initResult: {
          disabledNetworks: {},
          enabledNetworks: {},
        },
      },
    );

  const handleSearchTextChange = useDebouncedCallback((text: string) => {
    setSearchKey(text);
  }, 500);

  const handleOnPressToken = useCallback(
    async ({
      token,
      enabledInAllNetworks,
    }: {
      token: IAccountToken;
      enabledInAllNetworks?: boolean;
    }) => {
      void onSelect(token);
      if (enableNetworkAfterSelect) {
        if (
          token.networkId &&
          !enabledInAllNetworks &&
          !isEnabledNetworksInAllNetworks({
            networkId: token.networkId,
            disabledNetworks: allNetworksState.disabledNetworks,
            enabledNetworks: allNetworksState.enabledNetworks,
            isTestnet: false,
          })
        ) {
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: { [token.networkId]: true },
          });
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.network_also_enabled,
            }),
          });
          void refreshAllNetworkState({ alwaysSetState: true });
        }
      }
      if (closeAfterSelect) {
        navigation.pop();
      }
    },
    [
      onSelect,
      navigation,
      closeAfterSelect,
      enableNetworkAfterSelect,
      intl,
      allNetworksState,
      refreshAllNetworkState,
    ],
  );

  const sortedAggregateTokens = useMemo(() => {
    let tokens = sortTokensCommon({
      tokens: aggregateTokens,
      tokenListMap: allTokenListMapAtom,
    });

    if (hideZeroBalanceTokens) {
      tokens = tokens.filter((token) => {
        return new BigNumber(
          allTokenListMapAtom[token.$key]?.fiatValue ?? -1,
        ).gt(0);
      });
    }

    return uniqBy(
      [
        ...tokens,
        ...sortTokensByOrder({ tokens: allAggregateTokenList ?? [] }),
      ],
      (token) => token.networkId,
    );
  }, [
    aggregateTokens,
    allTokenListMapAtom,
    allAggregateTokenList,
    hideZeroBalanceTokens,
  ]);

  const filteredAggregateTokens = useMemo(() => {
    if (searchKey) {
      const lowerSearchKey = searchKey.toLowerCase();

      return sortedAggregateTokens?.filter((token) => {
        const network = listedNetworkMap[token.networkId ?? ''];
        return (
          network?.name?.toLowerCase().includes(lowerSearchKey) ||
          network?.symbol?.toLowerCase().includes(lowerSearchKey)
        );
      });
    }
    return sortedAggregateTokens;
  }, [searchKey, sortedAggregateTokens]);

  const renderAggregateTokensList = useCallback(() => {
    if (!filteredAggregateTokens || filteredAggregateTokens.length === 0) {
      if (searchKey) {
        return <EmptySearch />;
      }
      return <Empty />;
    }

    return filteredAggregateTokens.map((token) => (
      <AggregateTokenListItem
        key={token.$key}
        token={token}
        onPress={handleOnPressToken}
        allNetworksState={allNetworksState}
        refreshAllNetworkState={refreshAllNetworkState}
      />
    ));
  }, [
    filteredAggregateTokens,
    handleOnPressToken,
    searchKey,
    allNetworksState,
    refreshAllNetworkState,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={
          title ||
          intl.formatMessage({
            id: ETranslations.global_select_network,
          })
        }
        headerSearchBarOptions={{
          onSearchTextChange: handleSearchTextChange,
          placeholder:
            searchPlaceholder ||
            intl.formatMessage({
              id: ETranslations.form_search_network_placeholder,
            }),
        }}
      />
      <Page.Body>{renderAggregateTokensList()}</Page.Body>
    </Page>
  );
}

function AggregateTokenSelectorWithProvider() {
  const route =
    useRoute<
      RouteProp<
        IAssetSelectorParamList,
        EAssetSelectorRoutes.AggregateTokenSelector
      >
    >();

  const { accountId } = route.params;
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomeTokenListProviderMirrorWrapper accountId={accountId}>
        <AggregateTokenSelector />
      </HomeTokenListProviderMirrorWrapper>
    </AccountSelectorProviderMirror>
  );
}

export default AggregateTokenSelectorWithProvider;
