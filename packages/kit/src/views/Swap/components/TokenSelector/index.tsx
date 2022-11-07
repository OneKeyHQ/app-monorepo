import React, { FC, useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Divider,
  Empty,
  Image,
  Modal,
  Pressable,
  Searchbar,
  Spinner,
  ToggleButtonGroup,
  Token as TokenComponent,
} from '@onekeyhq/components';
import { ToggleButtonProps } from '@onekeyhq/components/src/ToggleButtonGroup/ToggleButtonGroup';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { Token } from '@onekeyhq/engine/src/types/token';
import SwapAllChainsLogoPNG from '@onekeyhq/kit/assets/swap_all_chains_logo.png';

import {
  useDebounce,
  useNetworkSimple,
  useNetworkTokens,
} from '../../../../hooks';
import { enabledNetworkIds } from '../../config';
import {
  useEnabledSwappableNetworks,
  useRestrictedTokens,
  useSwappableNativeTokens,
} from '../../hooks/useSwap';
import { useTokenSearch } from '../../hooks/useSwapTokenUtils';

import { TokenSelectorContext } from './context';
import { DataUpdaters } from './refresher';

type NetworkItemProp = ToggleButtonProps & { networkId?: string };

const NetworkSelector: FC = () => {
  const { networkId, setNetworkId } = useContext(TokenSelectorContext);
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

  const buttons: NetworkItemProp[] = useMemo(() => {
    const result: NetworkItemProp[] = [
      {
        text: intl.formatMessage({ id: 'option__all' }),
        networkId: undefined,
        leftComponentRender: () => (
          <Box mr="1">
            <Image size={5} source={SwapAllChainsLogoPNG} />
          </Box>
        ),
      },
    ];
    const items = enabledNetworks.map((item) => ({
      text: item.shortName,
      networkId: item.id,
      leftComponentRender: () => (
        <Box mr="1">
          <Image size={5} src={item.logoURI} />
        </Box>
      ),
    }));
    return result.concat(items);
  }, [enabledNetworks, intl]);

  const onButtonPress = useCallback(
    (index: number) => {
      const item = buttons[index];
      setNetworkId?.(item.networkId);
    },
    [buttons, setNetworkId],
  );

  const selectedIndex = useMemo(() => {
    const index = buttons.findIndex((item) => item.networkId === networkId);
    return index;
  }, [buttons, networkId]);

  return (
    <Box mb="4">
      <ToggleButtonGroup
        buttons={buttons}
        selectedIndex={selectedIndex}
        onButtonPress={onButtonPress}
        bg="surface-subdued"
      />
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
      emoji="🕐"
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
  const { selectedToken } = useContext(TokenSelectorContext);

  const tokenNetwork = useNetworkSimple(token.networkId);

  const onPress = useCallback(() => {
    onSelect?.(token);
  }, [onSelect, token]);
  const isSelected =
    token.networkId === selectedToken?.networkId &&
    token.tokenIdOnNetwork === selectedToken?.tokenIdOnNetwork;

  let description: string = token.name;
  if (token.tokenIdOnNetwork) {
    description = shortenAddress(token.tokenIdOnNetwork);
  } else if (tokenNetwork) {
    description = tokenNetwork?.name;
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
      <TokenComponent
        token={token}
        showInfo
        showNetworkIcon
        showTokenVerifiedIcon
        name={token.symbol}
        description={description}
        nameProps={{ numberOfLines: 2 }}
      />
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
  const { networkId: activeNetworkId } = useContext(TokenSelectorContext);
  const swappableNativeTokens = useSwappableNativeTokens();
  const networkTokens = useNetworkTokens(activeNetworkId);

  const list = useMemo(() => {
    const items = [...networkTokens];
    const index = items.findIndex((o) => !o.tokenIdOnNetwork);
    if (index > 0) {
      const deleted = items.splice(index, 1);
      return deleted.concat(items);
    }
    return items;
  }, [networkTokens]);

  const tokens = useMemo(
    () => (!activeNetworkId ? swappableNativeTokens ?? [] : list),
    [swappableNativeTokens, activeNetworkId, list],
  );

  const restrictedTokens = useRestrictedTokens(tokens, included, excluded);

  const [keyword, setKeyword] = useState<string>('');
  const terms = useDebounce(keyword, 500);
  const { loading, result: searchedTokens } = useTokenSearch(
    terms,
    activeNetworkId,
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
