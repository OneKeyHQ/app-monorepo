import React, { FC, useCallback, useContext, useMemo, useState } from 'react';

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
import { Token } from '@onekeyhq/engine/src/types/token';
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
import { useSwftcTokens } from '../../hooks/useSwap';
import { SwapRoutes } from '../../typings';
import { isNetworkEnabled } from '../../utils';

import { NetworkSelectorContext } from './context';
import { useSearchTokens } from './hooks';
import { TokenSelectorListeners } from './Listeners';

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
  const { networkId, setNetworkId } = useContext(NetworkSelectorContext);
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
  const networks = useAppSelector((s) => s.runtime.networks);
  const inputTokenNetwork = useAppSelector((s) => s.swap.inputTokenNetwork);
  const enabledNetworks = useMemo(() => {
    const evmNetworks = networks.filter((network) =>
      isNetworkEnabled(
        network,
        inputTokenNetwork ? [inputTokenNetwork.id] : undefined,
      ),
    );
    return evmNetworks;
  }, [networks, inputTokenNetwork]);

  return (
    <Box display="flex" flexDirection="row" mb="2" flexWrap="wrap">
      {enabledNetworks.map((item) => (
        <NetworkItem network={item} key={item.id} />
      ))}
    </Box>
  );
};

type HeaderTokensProps = {
  tokens: Token[];
  showTop50Label?: boolean;
  onSelect?: (token: Token) => void;
};

const HeaderTokens: FC<HeaderTokensProps> = ({
  tokens,
  showTop50Label,
  onSelect,
}) => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const { networkId } = useContext(NetworkSelectorContext);
  const prices = useNetworkTokensPrice(networkId);
  const balances = useAccountTokensBalance(networkId, accountId);
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
                onPress={() => onSelect?.(item)}
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
  onChange: (keyword: string) => void;
  onSelect?: (token: Token) => void;
};

const Header: FC<HeaderProps> = ({
  tokens,
  showTop50Label,
  keyword,
  terms,
  onChange,
  onSelect,
}) => {
  const intl = useIntl();
  const { showNetworkSelector } = useContext(NetworkSelectorContext);
  return (
    <Box>
      {showNetworkSelector ? <NetworkSelector /> : null}
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
          onSelect={onSelect}
        />
      )}
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
  const { networkId } = useContext(NetworkSelectorContext);
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

type ListingTokenProps = {
  item: Token;
  isFirst?: boolean;
  isLast?: boolean;
  onSelect?: (item: Token) => void;
};

const ListRenderToken: FC<ListingTokenProps> = ({
  item,
  isFirst,
  isLast,
  onSelect,
}) => {
  const { accountId } = useActiveWalletAccount();
  const { networkId } = useContext(NetworkSelectorContext);
  const balances = useAccountTokensBalance(networkId, accountId);
  const prices = useNetworkTokensPrice(networkId);
  const onPress = useCallback(() => {
    onSelect?.(item);
  }, [onSelect, item]);
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
      key={item.tokenIdOnNetwork}
      onPress={onPress}
      width="full"
    >
      <Box display="flex" alignItems="center" flexDirection="row">
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
  const { networkId: activeNetworkId } = useContext(NetworkSelectorContext);

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
          data: listItems,
          // @ts-ignore
          renderItem,
          ItemSeparatorComponent: Divider,
          keyExtractor: (item) => (item as Token).tokenIdOnNetwork,
          showsVerticalScrollIndicator: false,
          ListEmptyComponent: (
            <ListEmptyComponent isLoading={loading} terms={terms} />
          ),
          ListHeaderComponent: (
            <Header
              showTop50Label={listTokens.length > 0}
              tokens={headerTokens}
              keyword={keyword}
              terms={terms}
              onChange={setKeyword}
              onSelect={onSelect}
            />
          ),
        }}
      />
      <TokenSelectorListeners />
    </>
  );
};

export default TokenSelector;
