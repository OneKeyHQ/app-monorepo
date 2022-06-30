import React, { FC, useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
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
  Searchbar,
  Spinner,
  Token as TokenImage,
  Typography,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { Network } from '@onekeyhq/engine/src/types/network';
import IconSearch from '@onekeyhq/kit/assets/3d_search.png';
import {
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import { FormatBalance, FormatCurrency } from '../../../../components/Format';
import {
  useAccountTokens,
  useAccountTokensBalance,
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
  useNetworkTokens,
  useNetworkTokensPrice,
} from '../../../../hooks';
import { TokenBalanceValue } from '../../../../store/reducers/tokens';
import { useSwftcTokens } from '../../hooks/useSwap';
import { SwapRoutes } from '../../typings';
import { enabledChainIds, getChainIdFromNetwork } from '../../utils';

import { useSearchTokens } from './hooks';

import type { Token } from '../../../../store/typings';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;

const isValidateAddr = (addr: string) => addr.length === 42;

type NetworkItemProps = {
  active: boolean;
  network: Network;
  onPress?: (network: Network) => void;
};
const NetworkItem: FC<NetworkItemProps> = ({ network, onPress, active }) => (
  <Pressable
    mr="2"
    py="1"
    pl="1"
    pr="2"
    bg={active ? 'surface-neutral-hovered' : 'surface-neutral-subdued'}
    borderRadius="full"
    display="flex"
    flexDirection="row"
    mb="2"
    onPress={() => onPress?.(network)}
  >
    <TokenImage size="5" src={network.logoURI} />
    <Typography.Body2Strong ml="1">{network.shortName}</Typography.Body2Strong>
  </Pressable>
);

type NetworkSelectorProps = {
  activeNetworkId?: string;
  onSelectNetwork?: (network: Network) => void;
};

const NetworkSelector: FC<NetworkSelectorProps> = ({
  activeNetworkId,
  onSelectNetwork,
}) => {
  const networks = useAppSelector((s) => s.runtime.networks);
  const inputTokenNetwork = useAppSelector((s) => s.swap.inputTokenNetwork);
  const enabledNetworks = useMemo(() => {
    const evmNetworks = networks.filter(
      (network) => network.impl === 'evm' && network.enabled,
    );
    return evmNetworks.filter((network) => {
      if (network === inputTokenNetwork) {
        return true;
      }
      const chainId = getChainIdFromNetwork(network);
      return enabledChainIds.includes(chainId);
    });
  }, [networks, inputTokenNetwork]);

  return (
    <Box display="flex" flexDirection="row" mb="2" flexWrap="wrap">
      {enabledNetworks.map((item) => (
        <NetworkItem
          key={item.id}
          network={item}
          active={activeNetworkId === item.id}
          onPress={onSelectNetwork}
        />
      ))}
    </Box>
  );
};

type HeaderTokensProps = {
  tokens: Token[];
  showTop50Label?: boolean;
  onPress?: (token: Token) => void;
  prices: Record<string, string>;
  balances: Record<string, TokenBalanceValue>;
};

const HeaderTokens: FC<HeaderTokensProps> = ({
  tokens,
  showTop50Label,
  onPress,
  prices,
  balances,
}) => {
  const intl = useIntl();
  return (
    <Box>
      {tokens.length ? (
        <Box>
          <Typography.Subheading color="text-subdued">
            {intl.formatMessage({
              id: 'form__my_tokens',
              defaultMessage: 'MY TOKENS',
            })}
          </Typography.Subheading>
          <Box mt="2" mb="6">
            {tokens.map((item, index) => (
              <Pressable
                key={item.tokenIdOnNetwork || item.symbol}
                borderTopRadius={index === 0 ? '12' : undefined}
                borderBottomRadius={
                  index === tokens.length - 1 ? '12' : undefined
                }
                display="flex"
                flexDirection="row"
                justifyContent="space-between"
                p="4"
                alignItems="center"
                bg="surface-default"
                borderTopColor="divider"
                borderTopWidth={index !== 0 ? '1' : undefined}
                onPress={() => onPress?.(item)}
              >
                <Box
                  display="flex"
                  alignItems="center"
                  flexDirection="row"
                  flex="1"
                >
                  <Image
                    source={{ uri: item.logoURI }}
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
                    <Text
                      maxW={56}
                      numberOfLines={2}
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                    >
                      {item.symbol}
                    </Text>
                    <Typography.Body2
                      maxW="56"
                      numberOfLines={1}
                      color="text-subdued"
                    >
                      {item.name}
                    </Typography.Body2>
                  </Box>
                </Box>
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="flex-end"
                >
                  <Typography.Body2 numberOfLines={1} color="text-default">
                    <FormatBalance
                      balance={balances[item.tokenIdOnNetwork || 'main'] ?? '0'}
                      formatOptions={{ fixed: 6 }}
                    />
                  </Typography.Body2>
                  <Typography.Body2 color="text-subdued">
                    <FormatCurrency
                      numbers={[
                        prices?.[item.tokenIdOnNetwork || 'main'],
                        balances?.[item.tokenIdOnNetwork || 'main'],
                      ]}
                      render={(ele) => (
                        <Typography.Body2Strong ml={3} color="text-subdued">
                          {prices?.[item.tokenIdOnNetwork || 'main']
                            ? ele
                            : '-'}
                        </Typography.Body2Strong>
                      )}
                    />
                  </Typography.Body2>
                </Box>
              </Pressable>
            ))}
          </Box>
        </Box>
      ) : null}
      {showTop50Label ? (
        <Typography.Subheading color="text-subdued" mb="2">
          {intl.formatMessage({
            id: 'form__top_50_tokens',
            defaultMessage: 'TOP 50 TOKENS',
          })}
        </Typography.Subheading>
      ) : null}
    </Box>
  );
};

type HeaderProps = {
  tokens: Token[];
  keyword: string;
  terms?: string;
  showTop50Label?: boolean;
  prices: Record<string, string>;
  balances: Record<string, TokenBalanceValue>;
  activeNetworkId?: string;
  showNetworkSelector?: boolean;
  onChange: (keyword: string) => void;
  onPress?: (token: Token) => void;
  onSelectNetwork?: (network: Network) => void;
};

const Header: FC<HeaderProps> = ({
  tokens,
  showTop50Label,
  keyword,
  terms,
  activeNetworkId,
  balances,
  prices,
  showNetworkSelector,
  onSelectNetwork,
  onChange,
  onPress,
}) => {
  const intl = useIntl();
  return (
    <Box>
      {showNetworkSelector ? (
        <NetworkSelector
          activeNetworkId={activeNetworkId}
          onSelectNetwork={onSelectNetwork}
        />
      ) : null}
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
      {terms ? null : (
        <HeaderTokens
          tokens={tokens}
          showTop50Label={showTop50Label}
          balances={balances}
          prices={prices}
          onPress={onPress}
        />
      )}
    </Box>
  );
};

type ListEmptyComponentProps = {
  isLoading: boolean;
  terms: string;
  networkId?: string;
};

const ListEmptyComponent: FC<ListEmptyComponentProps> = ({
  isLoading,
  terms,
  networkId,
}) => {
  const intl = useIntl();
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
        console.log('params', params);
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

type ListingTokenProps = {
  item: Token;
  borderTopRadius?: string;
  borderBottomRadius?: string;
  prices: Record<string, string>;
  balances: Record<string, TokenBalanceValue>;
  onPress?: (item: Token) => void;
};

const ListRenderToken: FC<ListingTokenProps> = ({
  item,
  borderTopRadius,
  borderBottomRadius,
  onPress,
  balances,
  prices,
}) => (
  <Pressable
    borderTopRadius={borderTopRadius}
    borderBottomRadius={borderBottomRadius}
    display="flex"
    flexDirection="row"
    justifyContent="space-between"
    p={4}
    alignItems="center"
    bg="surface-default"
    overflow="hidden"
    key={item.tokenIdOnNetwork}
    onPress={() => onPress?.(item)}
    width="full"
  >
    <Box display="flex" alignItems="center" flexDirection="row">
      <Image
        source={{ uri: item.logoURI }}
        alt="logoURI"
        size="8"
        borderRadius="full"
        fallbackElement={
          <Center w={8} h={8} rounded="full" bgColor="surface-neutral-default">
            <Icon size={20} name="QuestionMarkOutline" />
          </Center>
        }
      />
      <Box ml="3">
        <Text
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          maxW="56"
          numberOfLines={2}
          color="text-default"
        >
          {item.symbol}
        </Text>
        <Typography.Body2 numberOfLines={1} color="text-subdued">
          {item.name}
        </Typography.Body2>
      </Box>
    </Box>
    <Box display="flex" flexDirection="column" alignItems="flex-end">
      <Typography.Body1 numberOfLines={1} color="text-default">
        <FormatBalance
          balance={balances[item.tokenIdOnNetwork] ?? '0'}
          formatOptions={{ fixed: 6 }}
        />
      </Typography.Body1>
      <Typography.Body2 color="text-subdued" numberOfLines={2}>
        <FormatCurrency
          numbers={[
            prices?.[item.tokenIdOnNetwork || 'main'],
            balances?.[item.tokenIdOnNetwork || 'main'],
          ]}
          render={(ele) => (
            <Typography.Body2Strong ml={3} color="text-subdued">
              {prices?.[item.tokenIdOnNetwork || 'main'] ? ele : '-'}
            </Typography.Body2Strong>
          )}
        />
      </Typography.Body2>
    </Box>
  </Pressable>
);

type TokenSelectorProps = {
  activeNetworkId: string;
  excluded?: string[];
  included?: string[];
  showNetworkSelector?: boolean;
  onSelectToken?: (token: Token) => void;
  onSelectNetwork?: (network: Network) => void;
};

const TokenSelector: FC<TokenSelectorProps> = ({
  excluded,
  included,
  activeNetworkId,
  showNetworkSelector,
  onSelectNetwork,
  onSelectToken: onPress,
}) => {
  const intl = useIntl();
  const { accountId: activeAccountId } = useActiveWalletAccount();
  const prices = useNetworkTokensPrice(activeNetworkId);
  const balances = useAccountTokensBalance(activeNetworkId, activeAccountId);

  const preNetworkTokens = useNetworkTokens(activeNetworkId);
  const preAccountTokens = useAccountTokens(activeNetworkId, activeAccountId);

  const networkTokens = useSwftcTokens(preNetworkTokens, included, excluded);
  const accountTokens = useSwftcTokens(preAccountTokens, included, excluded);

  const listTokens = useMemo(() => {
    const set = new Set(accountTokens.map((s) => s.tokenIdOnNetwork));
    return networkTokens.filter((token) => !set.has(token.tokenIdOnNetwork));
  }, [networkTokens, accountTokens]);

  const [keyword, setKeyword] = useState<string>('');
  const terms = useDebounce(keyword, 500);

  const { loading, searchedTokens } = useSearchTokens(
    terms,
    keyword,
    activeNetworkId,
    activeAccountId,
  );

  const headerTokens = useMemo(() => {
    if (!excluded) {
      return accountTokens;
    }
    return accountTokens.filter(
      (token) => !excluded.includes(token.tokenIdOnNetwork),
    );
  }, [accountTokens, excluded]);

  const listItems = useMemo(() => {
    const tokens = terms ? searchedTokens : listTokens;
    return tokens;
  }, [terms, searchedTokens, listTokens]);

  const renderItem: ListRenderItem<Token> = useCallback(
    ({ item, index }) => (
      <ListRenderToken
        item={item}
        onPress={onPress}
        borderTopRadius={index === 0 ? '12' : undefined}
        borderBottomRadius={index === listItems.length - 1 ? '12' : undefined}
        prices={prices}
        balances={balances}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listItems.length, onPress],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({ id: 'title__select_a_token' })}
        height="560px"
        footer={null}
        hidePrimaryAction
        flatListProps={{
          data: listItems,
          // @ts-ignore
          renderItem,
          ItemSeparatorComponent: Divider,
          keyExtractor: (item) => (item as Token).tokenIdOnNetwork,
          showsVerticalScrollIndicator: false,
          ListEmptyComponent: (
            <ListEmptyComponent
              isLoading={loading}
              terms={terms}
              networkId={activeNetworkId}
            />
          ),
          ListHeaderComponent: (
            <Header
              activeNetworkId={activeNetworkId}
              showTop50Label={listTokens.length > 0}
              tokens={headerTokens}
              keyword={keyword}
              terms={terms}
              prices={prices}
              balances={balances}
              showNetworkSelector={showNetworkSelector}
              onChange={setKeyword}
              onPress={onPress}
              onSelectNetwork={onSelectNetwork}
            />
          ),
        }}
      />
    </>
  );
};

export default TokenSelector;
