import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Empty, NumberSizeableText, Page } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAssetSelectorRoutes,
  IAssetSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import { sortTokensCommon } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { EmptySearch } from '../../../components/Empty';
import { ListItem } from '../../../components/ListItem';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAggregateTokensListMapAtom,
  useAllTokenListMapAtom,
} from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';

import type { RouteProp } from '@react-navigation/core';

function AggregateTokenListItem({
  token,
  onPress,
}: {
  token: IAccountToken;
  onPress: (token: IAccountToken) => void;
}) {
  const [allTokenListMapAtom] = useAllTokenListMapAtom();
  const [settings] = useSettingsPersistAtom();
  const tokenInfo = allTokenListMapAtom[token.$key];

  const { network } = useAccountData({
    networkId: token.networkId,
  });

  return (
    <ListItem
      key={token.$key}
      title={token.networkName}
      avatarProps={{
        src: network?.logoURI,
      }}
      onPress={() => {
        onPress(token);
      }}
    >
      <ListItem.Text
        align="right"
        primary={
          <NumberSizeableText
            size="$bodyLgMedium"
            formatter="balance"
            textAlign="right"
          >
            {tokenInfo.balanceParsed}
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
            {tokenInfo.fiatValue}
          </NumberSizeableText>
        }
      />
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
  } = route.params;

  const intl = useIntl();

  const [searchKey, setSearchKey] = useState('');
  const [allTokenListMapAtom] = useAllTokenListMapAtom();
  const navigation = useAppNavigation();

  const [aggregateTokensListMapAtom] = useAggregateTokensListMapAtom();
  const aggregateTokens =
    aggregateTokensListMapAtom[aggregateToken.$key]?.tokens;

  const handleSearchTextChange = useDebouncedCallback((text: string) => {
    setSearchKey(text);
  }, 500);

  const handleOnPressToken = useCallback(
    (token: IAccountToken) => {
      void onSelect(token);
      navigation.pop();
    },
    [onSelect, navigation],
  );

  const sortedAggregateTokens = useMemo(() => {
    return sortTokensCommon({
      tokens: aggregateTokens,
      tokenListMap: allTokenListMapAtom,
    });
  }, [aggregateTokens, allTokenListMapAtom]);

  const filteredAggregateTokens = useMemo(() => {
    if (searchKey) {
      const lowerSearchKey = searchKey.toLowerCase();

      return aggregateTokens?.filter((token) =>
        token.networkName?.toLowerCase().includes(lowerSearchKey),
      );
    }
    return sortedAggregateTokens;
  }, [searchKey, sortedAggregateTokens, aggregateTokens]);

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
    <Page>
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
    <HomeTokenListProviderMirrorWrapper accountId={accountId}>
      <AggregateTokenSelector />
    </HomeTokenListProviderMirrorWrapper>
  );
}

export default AggregateTokenSelectorWithProvider;
