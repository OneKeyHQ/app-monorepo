import React, { FC, useCallback, useContext, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Divider,
  Empty,
  Icon,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Searchbar,
  Spinner,
  Token as TokenImage,
  TokenVerifiedIcon,
  Typography,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Token } from '@onekeyhq/engine/src/types/token';
import IconSearch from '@onekeyhq/kit/assets/3d_search.png';
import {
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FormatBalance, FormatCurrency } from '../../../../components/Format';
import {
  useAccountTokens,
  useActiveWalletAccount,
  useDebounce,
  useNetwork,
  useNetworkTokens,
} from '../../../../hooks';
import { enabledNetworkIds } from '../../config';
import {
  useEnabledSwappableNetworks,
  useRestrictedTokens,
} from '../../hooks/useSwap';
import {
  useCachedBalances,
  useCachedPrices,
  useTokenSearch,
} from '../../hooks/useSwapTokenUtils';
import { SwapRoutes } from '../../typings';

import { TokenSelectorContext } from './context';
import { DataUpdaters } from './refresher';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;

const isValidateAddr = (addr: string) => addr.length === 42;

type NetworkItemProps = {
  network: Network;
};
const NetworkItem: FC<NetworkItemProps> = ({ network }) => {
  const { networkId, setNetworkId } = useContext(TokenSelectorContext);
  const onPress = useCallback(() => {
    setNetworkId?.(network.id);
  }, [setNetworkId, network]);
  return (
    <Pressable
      mr="2"
      py="1.5"
      pl="1.5"
      pr="2.5"
      bg={
        network.id === networkId
          ? 'surface-neutral-hovered'
          : 'surface-neutral-subdued'
      }
      borderRadius="full"
      display="flex"
      flexDirection="row"
      mb="2"
      onPress={onPress}
    >
      <TokenImage size="5" src={network.logoURI} />
      <Typography.Body2Strong ml="1">
        {network.shortName}
      </Typography.Body2Strong>
    </Pressable>
  );
};

const NetworkSelector: FC = () => {
  const networks = useEnabledSwappableNetworks();
  const { impl } = useContext(TokenSelectorContext);
  const enabledNetworks = useMemo(() => {
    let items = networks;
    if (impl) {
      items = items.filter((item) => item.impl === impl);
    }
    return items.sort((a, b) => {
      const networkIdA = enabledNetworkIds.indexOf(a.id);
      const networkIdB = enabledNetworkIds.indexOf(b.id);
      return networkIdA < networkIdB ? -1 : 1;
    });
  }, [networks, impl]);

  return platformEnv.isNative ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} mb="2">
      {enabledNetworks.map((item) => (
        <NetworkItem network={item} key={item.id} />
      ))}
    </ScrollView>
  ) : (
    <Box display="flex" flexDirection="row" mb="2" flexWrap="wrap">
      {enabledNetworks.map((item) => (
        <NetworkItem network={item} key={item.id} />
      ))}
    </Box>
  );
};

type HeaderProps = {
  keyword: string;
  onChange: (keyword: string) => void;
};

const Header: FC<HeaderProps> = ({ keyword, onChange }) => {
  const intl = useIntl();
  return (
    <Box>
      <NetworkSelector />
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
          defaultMessage: 'Search Tokens',
        })}
        mb="6"
        value={keyword}
        onClear={() => onChange('')}
        onChangeText={(text) => onChange(text)}
      />
    </Box>
  );
};

type ListEmptyComponentProps = {
  isLoading: boolean;
  terms: string;
};

const ListEmptyComponent: FC<ListEmptyComponentProps> = ({
  isLoading,
  terms,
}) => {
  const intl = useIntl();
  const { networkId } = useContext(TokenSelectorContext);
  const navigation = useNavigation<NavigationProps>();
  if (isLoading) {
    return (
      <Center w="full" h="20">
        <Spinner size="lg" />
      </Center>
    );
  }
  return terms.length > 0 ? (
    <Empty
      imageUrl={IconSearch}
      title={intl.formatMessage({
        id: 'content__no_results',
        defaultMessage: 'No Result',
      })}
      subTitle={intl.formatMessage({
        id: 'content__no_results_desc',
        defaultMessage: 'The token you searched for was not found',
      })}
      actionTitle={intl.formatMessage({
        id: 'action__add_custom_tokens',
        defaultMessage: 'Add Custom Token',
      })}
      handleAction={() => {
        const params: { address?: string; networkId?: string } = { networkId };
        if (isValidateAddr(terms)) {
          params.address = terms;
        }
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Swap,
          params: {
            screen: SwapRoutes.CustomToken,
            params,
          },
        });
      }}
    />
  ) : null;
};

type TokenSelectorItem = {
  token: Token;
  balance?: string | null;
  price?: string | null;
};

type ListRenderTokenProps = {
  item: TokenSelectorItem;
  isFirst?: boolean;
  isLast?: boolean;
  onSelect?: (item: Token) => void;
};

const ListRenderToken: FC<ListRenderTokenProps> = ({
  item,
  isFirst,
  isLast,
  onSelect,
}) => {
  const { token, balance, price } = item;
  const { selectedToken, networkId } = useContext(TokenSelectorContext);

  const tokenNetwork = useNetwork(token.networkId);

  const onPress = useCallback(() => {
    onSelect?.(token);
  }, [onSelect, token]);
  const isSelected =
    token.networkId === selectedToken?.networkId &&
    token.tokenIdOnNetwork === selectedToken?.tokenIdOnNetwork;

  let description: string = token.name;
  if (!networkId && tokenNetwork) {
    description = tokenNetwork?.shortName;
  } else if (token.tokenIdOnNetwork) {
    description = shortenAddress(token.tokenIdOnNetwork);
  }
  return (
    <Pressable
      borderTopRadius={isFirst ? '12' : undefined}
      borderBottomRadius={isLast ? '12' : undefined}
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      p={4}
      alignItems="center"
      bg="surface-default"
      overflow="hidden"
      key={token.tokenIdOnNetwork}
      onPress={onPress}
      width="full"
      opacity={isSelected ? 60 : 1000}
    >
      <Box flex="1">
        <Box display="flex" alignItems="center" flexDirection="row">
          <Image
            source={{ uri: token.logoURI }}
            alt="logoURI"
            size="8"
            borderRadius="full"
            fallbackElement={
              <Center
                w={8}
                h={8}
                rounded="full"
                bgColor="surface-neutral-default"
              >
                <Icon size={20} name="QuestionMarkOutline" />
              </Center>
            }
          />
          <Box ml="3">
            <Box alignItems="center" flexDirection="row">
              <Text
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                maxW="56"
                numberOfLines={2}
                color="text-default"
              >
                {token.symbol}
              </Text>
              <TokenVerifiedIcon token={token} />
            </Box>
            <Box maxW="full">
              <Typography.Body2
                numberOfLines={2}
                maxWidth="full"
                color="text-subdued"
              >
                {description}
              </Typography.Body2>
            </Box>
          </Box>
        </Box>
      </Box>
      <Box display="flex" flexDirection="column" alignItems="flex-end">
        <Typography.Body1 numberOfLines={1} color="text-default">
          <FormatBalance
            balance={balance ?? '0'}
            formatOptions={{ fixed: 6 }}
          />
        </Typography.Body1>
        <Typography.Body2 color="text-subdued" numberOfLines={2}>
          <FormatCurrency
            numbers={[price ?? 0, balance ?? 0]}
            render={(ele) => (
              <Typography.Body2Strong ml={3} color="text-subdued">
                {price ? ele : '-'}
              </Typography.Body2Strong>
            )}
          />
        </Typography.Body2>
      </Box>
    </Pressable>
  );
};

type TokenSelectorProps = {
  excluded?: string[];
  included?: string[];
  onSelect?: (token: Token) => void;
};

const TokenSelector: FC<TokenSelectorProps> = ({
  excluded,
  included,
  onSelect,
}) => {
  const intl = useIntl();
  const { accountId: activeAccountId } = useActiveWalletAccount();
  const { networkId: activeNetworkId } = useContext(TokenSelectorContext);

  const accountsTokens = useAccountTokens(activeNetworkId, activeAccountId);
  const networkTokens = useNetworkTokens(activeNetworkId);

  const balances = useCachedBalances(activeNetworkId, activeAccountId);
  const prices = useCachedPrices(activeNetworkId);

  const tokens = useMemo(() => {
    const items = [...accountsTokens, ...networkTokens];
    const result = items.reduce<Record<string, Token>>((a, b) => {
      a[b.tokenIdOnNetwork] = b;
      return a;
    }, {});
    return Object.values(result);
  }, [accountsTokens, networkTokens]);

  const restrictedTokens = useRestrictedTokens(tokens, included, excluded);

  const [keyword, setKeyword] = useState<string>('');
  const terms = useDebounce(keyword, 500);
  const { loading, result: searchedTokens } = useTokenSearch(
    terms,
    activeNetworkId,
    activeAccountId,
  );
  const isLoading = loading || keyword !== terms;

  const listItems = useMemo(
    () => (terms ? searchedTokens : restrictedTokens),
    [terms, searchedTokens, restrictedTokens],
  );

  const listRenderItems = useMemo<TokenSelectorItem[]>(() => {
    let items = listItems.map((token) => ({
      price: prices[token.tokenIdOnNetwork || 'main'],
      balance: balances[token.tokenIdOnNetwork || 'main'],
      token,
    }));
    items = items.sort((a, b) => {
      if (a.balance && a.price && b.balance && b.price) {
        const prev = new BigNumber(a.balance).multipliedBy(a.price);
        const next = new BigNumber(b.balance).multipliedBy(b.price);
        if (prev.gt(next)) {
          return -1;
        }
        if (prev.lt(next)) {
          return 1;
        }
      } else if ((a.balance && a.price) || (b.balance && b.price)) {
        if (a.balance && a.price) {
          return -1;
        }
        return 1;
      }
      return 0;
    });
    return items;
  }, [listItems, balances, prices]);

  const renderItem: ListRenderItem<TokenSelectorItem> = useCallback(
    ({ item, index }) => (
      <ListRenderToken
        item={item}
        onSelect={onSelect}
        isFirst={index === 0}
        isLast={index === listItems.length - 1}
      />
    ),
    [listItems.length, onSelect],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({ id: 'title__select_a_token' })}
        height="560px"
        footer={null}
        hidePrimaryAction
        flatListProps={{
          data: listRenderItems,
          // @ts-ignore
          renderItem,
          ItemSeparatorComponent: Divider,
          keyExtractor: (item) =>
            `${(item as TokenSelectorItem)?.token?.tokenIdOnNetwork}:${
              (item as TokenSelectorItem)?.token?.networkId
            }`,
          showsVerticalScrollIndicator: false,
          ListEmptyComponent: (
            <ListEmptyComponent isLoading={isLoading} terms={terms} />
          ),
          ListHeaderComponent: (
            <Header keyword={keyword} onChange={setKeyword} />
          ),
        }}
      />
      <DataUpdaters />
    </>
  );
};

export default TokenSelector;
