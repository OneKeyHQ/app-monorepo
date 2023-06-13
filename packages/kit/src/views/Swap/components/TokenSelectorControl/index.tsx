import type { FC } from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  HStack,
  Icon,
  Modal,
  NetImage,
  Pressable,
  Searchbar,
  Token as TokenComponent,
  Typography,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { FormatCurrency } from '../../../../components/Format';
import {
  useDebounce,
  useNavigation,
  useNetworkSimple,
} from '../../../../hooks';
import { useTokenBalance } from '../../../../hooks/useTokens';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { notifyIfRiskToken } from '../../../ManageTokens/helpers/TokenSecurityModalWrapper';
import { useTokenPrice, useTokenSearch } from '../../hooks/useSwapTokenUtils';
import { SwapRoutes } from '../../typings';
import { formatAmount, gt } from '../../utils';
import { EmptySkeleton, LoadingSkeleton } from '../TokenSkeleton';

import { TokenSelectorControlContext } from './context';
import { useContextAccountTokens } from './hooks';
import { Observer } from './Observer';

import type { ListRenderItem } from 'react-native';

const NetworkSelector: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { networkId, setNetworkId, networkOptions, otherNetworkOptions } =
    useContext(TokenSelectorControlContext);

  if (!networkOptions || networkOptions.length === 0) {
    return null;
  }

  return (
    <Box mb="4">
      <HStack space="2">
        {networkOptions.map((item) => (
          <Pressable
            key={item.name}
            onPress={() => setNetworkId?.(item.networkId)}
          >
            <Box
              px="2"
              py="1.5"
              flexDirection="row"
              alignItems="center"
              bg="surface-neutral-subdued"
              borderRadius="12"
              borderWidth={1}
              borderColor={
                item.networkId === networkId
                  ? 'interactive-default'
                  : 'border-default'
              }
            >
              {item.logoURI ? (
                <Box w="5" h="5" borderRadius="full" overflow="hidden" mr="1">
                  <NetImage width="20px" height="20px" src={item.logoURI} />
                </Box>
              ) : null}
              <Typography.Body2Strong>{item.name}</Typography.Body2Strong>
            </Box>
          </Pressable>
        ))}
        {otherNetworkOptions && otherNetworkOptions.length ? (
          <Pressable
            key="more"
            onPress={() =>
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Swap,
                params: {
                  screen: SwapRoutes.ChainSelector,
                  params: {
                    networkIds: otherNetworkOptions
                      ? otherNetworkOptions
                          ?.map((o) => o.networkId)
                          .filter((i): i is string => Boolean(i))
                      : undefined,
                    onSelect(networkIdValue) {
                      setNetworkId?.(networkIdValue);
                    },
                  },
                },
              })
            }
          >
            <Box
              px="2"
              py="1.5"
              flexDirection="row"
              alignItems="center"
              bg="surface-neutral-subdued"
              borderRadius="12"
              borderWidth={1}
              borderColor="border-default"
            >
              <Typography.Body2Strong>{`${
                otherNetworkOptions.length
              } ${intl.formatMessage({
                id: 'action__more',
              })}`}</Typography.Body2Strong>
              <Box ml="1">
                <Icon size={12} name="ChevronDownSolid" />
              </Box>
            </Box>
          </Pressable>
        ) : null}
      </HStack>
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
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'content__search_token_or_contract_address',
          defaultMessage: 'Search Tokens',
        })}
        mb="16px"
        value={keyword}
        onClear={() => onChange('')}
        onChangeText={(text) => onChange(text)}
      />
      <NetworkSelector />
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
      <Box px="2">
        <LoadingSkeleton />
      </Box>
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

type ExtraInfoProps = {
  token?: Token;
  isSearchMode?: boolean;
};

const ExtraInfo: FC<ExtraInfoProps> = ({ token, isSearchMode }) => {
  const { accountId } = useContext(TokenSelectorControlContext);
  const isCompatible = isAccountCompatibleWithNetwork(
    accountId ?? '',
    token?.networkId ?? '',
  );

  const balance = useTokenBalance({
    networkId: token?.networkId ?? '',
    accountId: accountId ?? '',
    token,
  });
  const price = useTokenPrice(token);

  if (!isSearchMode && isCompatible && gt(balance, 0)) {
    return (
      <Box alignItems="flex-end">
        <Typography.Heading fontSize={16} lineHeight={24}>
          {formatAmount(balance, 6)}
        </Typography.Heading>
        <Typography.Caption color="text-subdued" numberOfLines={2}>
          <FormatCurrency
            numbers={[price ?? 0, balance ?? 0]}
            render={(ele) => (
              <Typography.Caption ml={3} color="text-subdued">
                {price ? ele : '-'}
              </Typography.Caption>
            )}
          />
        </Typography.Caption>
      </Box>
    );
  }
  return <Icon name="ChevronRightMini" size={20} color="icon-subdued" />;
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
  const { selectedToken } = useContext(TokenSelectorControlContext);

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
      <ExtraInfo token={token} isSearchMode={isSearchMode} />
    </Pressable>
  );
};

type TokenSelectorProps = {
  excluded?: string[];
  included?: string[];
  onSelect?: (token: Token) => void;
};

const TokenSelector: FC<TokenSelectorProps> = ({ onSelect, excluded }) => {
  const intl = useIntl();
  const [keyword, setKeyword] = useState<string>('');
  const { networkId, accountId } = useContext(TokenSelectorControlContext);
  const contextAccountTokens = useContextAccountTokens(networkId, accountId);
  const searchQuery = useDebounce(keyword.trim(), 300);
  const { loading, result: searchedTokens } = useTokenSearch(
    searchQuery,
    networkId,
  );

  const isLoading = loading || keyword !== searchQuery;

  const { dataSources, renderItem } = useMemo(() => {
    const tokens = searchedTokens ?? contextAccountTokens;
    const renderFn: ListRenderItem<Token> = ({ item }) => (
      <ListRenderToken
        token={item}
        onSelect={onSelect}
        isSearchMode={!!searchedTokens}
      />
    );
    return {
      dataSources: tokens.filter(
        (i) => !excluded?.includes(i.tokenIdOnNetwork),
      ),
      renderItem: renderFn,
    };
  }, [searchedTokens, contextAccountTokens, onSelect, excluded]);

  if (!contextAccountTokens || contextAccountTokens.length === 0) {
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
      <Observer />
    </>
  );
};

export default TokenSelector;
