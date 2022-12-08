import React, { FC, useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Empty,
  Icon,
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

import {
  useAppSelector,
  useDebounce,
  useNetworkSimple,
} from '../../../../hooks';
import { notifyIfRiskToken } from '../../../ManageTokens/helpers/TokenSecurityModalWrapper';
import {
  useSwapTokenList,
  useTokenSearch,
} from '../../hooks/useSwapTokenUtils';

import { TokenSelectorContext } from './context';
import { EmptySkeleton } from './EmptySkeleton';

type NetworkItemProp = ToggleButtonProps & { networkId?: string };

const NetworkSelector: FC = () => {
  const intl = useIntl();
  const { networkId, setNetworkId } = useContext(TokenSelectorContext);
  const tokenList = useAppSelector((s) => s.swapTransactions.tokenList);

  const buttons: NetworkItemProp[] = useMemo(() => {
    if (!tokenList) {
      return [];
    }
    return tokenList.map((item) => ({
      text:
        item.name.toLowerCase() === 'all'
          ? intl.formatMessage({ id: 'option__all' })
          : item.name,
      networkId: item.name.toLowerCase() === 'all' ? undefined : item.networkId,
      leftComponentRender: () => (
        <Box mr="1">
          <Image size={5} src={item.logoURI} />
        </Box>
      ),
    }));
  }, [tokenList, intl]);

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
        bg="background-default"
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
    <Box px="8px">
      <NetworkSelector />
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
          defaultMessage: 'Search Tokens',
        })}
        mb="16px"
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
  onSelect?: (item: Token) => void;
  isSearchMode?: boolean;
};

const ListRenderToken: FC<ListRenderTokenProps> = ({
  token,
  onSelect,
  isSearchMode,
}) => {
  const { selectedToken } = useContext(TokenSelectorContext);

  const tokenNetwork = useNetworkSimple(token.networkId);

  const onPress = useCallback(() => {
    onSelect?.(token);
    notifyIfRiskToken(token);
  }, [onSelect, token]);
  const isSelected =
    token.networkId === selectedToken?.networkId &&
    token.tokenIdOnNetwork === selectedToken?.tokenIdOnNetwork;

  let description: string = token.name;
  if (token.tokenIdOnNetwork) {
    description = shortenAddress(token.tokenIdOnNetwork);
    if (isSearchMode && tokenNetwork?.name) {
      description = `${tokenNetwork.name} · ${description}`;
    }
  } else if (tokenNetwork) {
    description = tokenNetwork?.name;
  }
  return (
    <Pressable
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      p="8px"
      borderRadius="12px"
      overflow="hidden"
      key={token.tokenIdOnNetwork}
      onPress={onPress}
      width="full"
      opacity={isSelected ? 60 : 1000}
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
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
      <Icon name="ChevronRightMini" size={20} color="icon-subdued" />
    </Pressable>
  );
};

type TokenSelectorProps = {
  excluded?: string[];
  included?: string[];
  onSelect?: (token: Token) => void;
};

const TokenSelector: FC<TokenSelectorProps> = ({ onSelect }) => {
  const intl = useIntl();
  const { networkId: activeNetworkId } = useContext(TokenSelectorContext);
  const listedTokens = useSwapTokenList(activeNetworkId);

  const [keyword, setKeyword] = useState<string>('');
  const searchQuery = useDebounce(keyword.trim(), 300);
  const { loading, result: searchedTokens } = useTokenSearch(
    searchQuery,
    activeNetworkId,
  );

  const isLoading = loading || keyword !== searchQuery;

  const { dataSources, renderItem } = useMemo(() => {
    const tokens = searchedTokens ?? listedTokens;
    const renderFn: ListRenderItem<Token> = ({ item }) => (
      <ListRenderToken
        token={item}
        onSelect={onSelect}
        isSearchMode={!!searchedTokens}
      />
    );
    return {
      dataSources: tokens,
      renderItem: renderFn,
    };
  }, [searchedTokens, listedTokens, onSelect]);

  const tokenSources = useAppSelector((s) => s.swapTransactions.tokenList);
  if (!tokenSources) {
    return (
      <Modal
        header={intl.formatMessage({ id: 'title__select_a_token' })}
        height="560px"
        footer={null}
        hidePrimaryAction
      >
        <EmptySkeleton />
      </Modal>
    );
  }

  return (
    <>
      <Modal
        header={intl.formatMessage({ id: 'title__select_a_token' })}
        height="560px"
        footer={null}
        hidePrimaryAction
        flatListProps={{
          data: dataSources,
          // @ts-ignore
          renderItem,
          keyExtractor: (item) =>
            `${(item as Token)?.tokenIdOnNetwork}:${
              (item as Token)?.networkId
            }`,
          showsVerticalScrollIndicator: false,
          ListEmptyComponent: (
            <ListEmptyComponent isLoading={isLoading} terms={searchQuery} />
          ),
          ListHeaderComponent: (
            <Header keyword={keyword} onChange={setKeyword} />
          ),
          mx: '-8px',
        }}
      />
    </>
  );
};

export default TokenSelector;
