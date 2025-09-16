import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAssetSelectorRoutes,
  IAssetSelectorParamList,
} from '@onekeyhq/shared/src/routes';
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
import { useAccountData } from '../../../hooks/useAccountData';
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
}: {
  token: IAccountToken;
  onPress: (token: IAccountToken) => void;
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

  const { result: accountId } = usePromiseResult(async () => {
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
        ...token,
        accountId,
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
          await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
            enabledNetworks: { [network?.id ?? '']: true },
          });
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.swap_page_toast_address_generated,
            }),
            message: intl.formatMessage({
              id: ETranslations.network_also_enabled,
            }),
          });
          onPress({
            ...token,
            accountId: createAddressResult.accounts[0]?.id,
          });
        }
      } finally {
        setLoading(false);
      }
    }
  }, [
    accountId,
    network?.id,
    onPress,
    token,
    createAddress,
    wallet?.id,
    indexedAccount?.id,
    intl,
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
  } = route.params;

  const intl = useIntl();

  const [searchKey, setSearchKey] = useState('');
  const [allTokenListMapAtom] = useAllTokenListMapAtom();
  const navigation = useAppNavigation();

  const [aggregateTokensListMapAtom] = useAggregateTokensListMapAtom();

  const aggregateTokens = useMemo(() => {
    return aggregateTokensListMapAtom[aggregateToken.$key]?.tokens ?? [];
  }, [aggregateTokensListMapAtom, aggregateToken.$key]);

  const handleSearchTextChange = useDebouncedCallback((text: string) => {
    setSearchKey(text);
  }, 500);

  const handleOnPressToken = useCallback(
    async (token: IAccountToken) => {
      void onSelect(token);
      if (closeAfterSelect) {
        navigation.pop();
      }
    },
    [onSelect, navigation, closeAfterSelect],
  );

  const sortedAggregateTokens = useMemo(() => {
    const tokens = sortTokensCommon({
      tokens: aggregateTokens,
      tokenListMap: allTokenListMapAtom,
    });

    return uniqBy(
      [
        ...tokens,
        ...sortTokensByOrder({ tokens: allAggregateTokenList ?? [] }),
      ],
      (token) => token.networkId,
    );
  }, [aggregateTokens, allTokenListMapAtom, allAggregateTokenList]);

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
      />
    ));
  }, [filteredAggregateTokens, handleOnPressToken, searchKey]);

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
