import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  HStack,
  Icon,
  Modal,
  Pressable,
  Searchbar,
  Text,
  Token as TokenComponent,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { useDebounce, useNetwork } from '@onekeyhq/kit/src/hooks';

import type { BulkSenderRoutes, BulkSenderRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { ListRenderItem } from 'react-native';

type RouteProps = RouteProp<
  BulkSenderRoutesParams,
  BulkSenderRoutes.TokenSelector
>;

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
        })}
        mb="16px"
        value={keyword}
        onClear={() => onChange('')}
        onChangeText={(text) => onChange(text)}
      />
    </Box>
  );
};

const ListEmptyComponent = () => {
  const intl = useIntl();
  return (
    <Empty
      emoji="🕐"
      title={intl.formatMessage({
        id: 'content__no_results',
      })}
      subTitle={intl.formatMessage({
        id: 'content__no_results_desc',
      })}
    />
  );
};

type ListRenderTokenProps = {
  token: Token;
  balance: string | undefined;
  onSelect?: (item: Token) => void;
};

const ListRenderToken: FC<ListRenderTokenProps> = ({
  token,
  balance,
  onSelect,
}) => {
  const intl = useIntl();
  const onPress = useCallback(() => {
    onSelect?.(token);
  }, [onSelect, token]);

  return (
    <Pressable.Item px={4} py={2} borderRadius={12} onPress={onPress}>
      <HStack alignItems="center">
        <TokenComponent
          flex={1}
          size={8}
          showInfo
          showTokenVerifiedIcon={false}
          token={token}
          name={token.symbol}
          showExtra={false}
          description={intl.formatMessage(
            { id: 'content__balance_str' },
            {
              0: balance,
            },
          )}
        />
        <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
      </HStack>
    </Pressable.Item>
  );
};

function TokenSelector() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const {
    networkId,
    tokens: listedTokens,
    balances,
    onTokenSelected,
  } = route.params;
  const { network } = useNetwork({ networkId });

  const [keyword, setKeyword] = useState<string>('');
  const searchQuery = useDebounce(keyword.trim().toLowerCase(), 300);

  const { dataSources, renderItem } = useMemo(() => {
    const tokens =
      searchQuery.length > 0
        ? listedTokens.filter(
            (token) =>
              token.symbol.toLowerCase().includes(searchQuery) ||
              token.tokenIdOnNetwork.includes(searchQuery),
          )
        : listedTokens;
    const renderFn: ListRenderItem<Token> = ({ item }) => (
      <ListRenderToken
        token={item}
        balance={balances[item.tokenIdOnNetwork || 'main']}
        onSelect={onTokenSelected}
      />
    );
    return {
      dataSources: tokens,
      renderItem: renderFn,
    };
  }, [searchQuery, listedTokens, balances, onTokenSelected]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__select_a_token' })}
      headerDescription={
        <Text typography="Caption" color="text-subdued">
          {network?.name || network?.shortName || undefined}
        </Text>
      }
      height="587px"
      footer={null}
      hidePrimaryAction
      flatListProps={{
        data: dataSources,
        // @ts-ignore
        renderItem,
        keyExtractor: (item) =>
          `${(item as Token)?.tokenIdOnNetwork}:${(item as Token)?.networkId}`,
        showsVerticalScrollIndicator: false,
        ListEmptyComponent: <ListEmptyComponent />,
        ListHeaderComponent: <Header keyword={keyword} onChange={setKeyword} />,
      }}
    />
  );
}

export { TokenSelector };
