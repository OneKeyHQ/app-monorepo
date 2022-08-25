import React, { FC, useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { ImageSourcePropType, ListRenderItem } from 'react-native';

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
  TokenVerifiedIcon,
  Typography,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { Token } from '@onekeyhq/engine/src/types/token';
import IconSearch from '@onekeyhq/kit/assets/3d_search.png';
import SwapAllChainsLogoPNG from '@onekeyhq/kit/assets/swap_all_chains_logo.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  useAccountTokens,
  useActiveWalletAccount,
  useDebounce,
  useNetworkTokens,
} from '../../../../hooks';
import { enabledNetworkIds } from '../../config';
import {
  useEnabledSwappableNetworks,
  useRestrictedTokens,
  useSwappableNativeTokens,
} from '../../hooks/useSwap';
import { useTokenSearch } from '../../hooks/useSwapTokenUtils';

import { ReceivingTokenSelectorContext } from './context';
import { DataUpdaters } from './refresher';

type NetworkItemProps = {
  logoURI?: ImageSourcePropType;
  value?: string;
  name: string;
};
const NetworkItem: FC<NetworkItemProps> = ({ name, logoURI, value }) => {
  const { networkId, setNetworkId } = useContext(ReceivingTokenSelectorContext);
  const onPress = useCallback(() => {
    setNetworkId?.(value);
  }, [setNetworkId, value]);
  return (
    <Pressable
      mr="2"
      py="1.5"
      pl="1.5"
      pr="2.5"
      bg={
        value === networkId
          ? 'surface-neutral-hovered'
          : 'surface-neutral-subdued'
      }
      borderRadius="full"
      display="flex"
      flexDirection="row"
      mb="2"
      onPress={onPress}
    >
      {logoURI ? <Image size="5" source={logoURI} /> : null}
      <Typography.Body2Strong ml="1">{name}</Typography.Body2Strong>
    </Pressable>
  );
};

const NetworkSelector: FC = () => {
  const networks = useEnabledSwappableNetworks();
  const intl = useIntl();
  const enabledNetworks = useMemo(() => {
    const evmNetworks = networks.sort((a, b) => {
      const networkIdA = enabledNetworkIds.indexOf(a.id);
      const networkIdB = enabledNetworkIds.indexOf(b.id);
      return networkIdA < networkIdB ? -1 : 1;
    });
    return evmNetworks;
  }, [networks]);

  return platformEnv.isNative ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} mb="2">
      <NetworkItem
        name={intl.formatMessage({ id: 'option__all' })}
        logoURI={SwapAllChainsLogoPNG}
        value={undefined}
        key="option__all"
      />
      {enabledNetworks.map((item) => (
        <NetworkItem
          name={item.shortName}
          logoURI={{ uri: item.logoURI }}
          value={item.id}
          key={item.id}
        />
      ))}
    </ScrollView>
  ) : (
    <Box display="flex" flexDirection="row" mb="2" flexWrap="wrap">
      <NetworkItem
        name={intl.formatMessage({ id: 'option__all' })}
        logoURI={SwapAllChainsLogoPNG}
        value={undefined}
        key="option__all"
      />
      {enabledNetworks.map((item) => (
        <NetworkItem
          name={item.shortName}
          logoURI={{ uri: item.logoURI }}
          value={item.id}
          key={item.id}
        />
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
    />
  ) : null;
};

type ListRenderTokenProps = {
  token: Token;
  isFirst?: boolean;
  isLast?: boolean;
  onSelect?: (item: Token) => void;
};

const ListRenderToken: FC<ListRenderTokenProps> = ({
  token,
  isFirst,
  isLast,
  onSelect,
}) => {
  const { selectedToken } = useContext(ReceivingTokenSelectorContext);

  const onPress = useCallback(() => {
    onSelect?.(token);
  }, [onSelect, token]);
  const isSelected =
    token.networkId === selectedToken?.networkId &&
    token.tokenIdOnNetwork === selectedToken?.tokenIdOnNetwork;
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
          <Typography.Body2 numberOfLines={1} color="text-subdued">
            {token.name}
          </Typography.Body2>
        </Box>
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
  const { networkId: activeNetworkId } = useContext(
    ReceivingTokenSelectorContext,
  );
  const swappableNativeTokens = useSwappableNativeTokens();

  const accountsTokens = useAccountTokens(activeNetworkId, activeAccountId);
  const networkTokens = useNetworkTokens(activeNetworkId);

  const deduplicated = useMemo(() => {
    const items = [...accountsTokens, ...networkTokens];
    const result = items.reduce<Record<string, Token>>((a, b) => {
      a[b.tokenIdOnNetwork] = b;
      return a;
    }, {});
    return Object.values(result);
  }, [accountsTokens, networkTokens]);

  const tokens = useMemo(
    () => (!activeNetworkId ? swappableNativeTokens ?? [] : deduplicated),
    [deduplicated, swappableNativeTokens, activeNetworkId],
  );

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

  const renderItem: ListRenderItem<Token> = useCallback(
    ({ item, index }) => (
      <ListRenderToken
        token={item}
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
          keyExtractor: (item) =>
            `${(item as Token)?.tokenIdOnNetwork}:${
              (item as Token)?.networkId
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
