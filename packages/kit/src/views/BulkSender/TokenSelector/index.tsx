import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  Icon,
  Modal,
  Pressable,
  Searchbar,
  Text,
  Token as TokenComponent,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { useDebounce, useNetwork } from '@onekeyhq/kit/src/hooks';
import { useTokenBalance } from '@onekeyhq/kit/src/hooks/useTokens';

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
          id: 'form__search_tokens',
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
  accountId: string;
  networkId: string;
  token: Token;
  onSelect?: (item: Token) => void;
};

const ListRenderToken: FC<ListRenderTokenProps> = ({
  accountId,
  networkId,
  token,
  onSelect,
}) => {
  const balance = useTokenBalance({
    accountId,
    networkId,
    token,
    fallback: '0',
  });
  const intl = useIntl();
  const closeModal = useModalClose();
  const onPress = useCallback(() => {
    onSelect?.(token);
    closeModal();
  }, [onSelect, closeModal, token]);

  return (
    <Pressable
      width="full"
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      overflow="hidden"
      flexDirection="row"
      key={token.tokenIdOnNetwork}
      px={4}
      py={2}
      borderRadius={12}
      onPress={onPress}
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
    >
      <TokenComponent
        size={8}
        showInfo
        showTokenVerifiedIcon={false}
        token={token}
        name={token.name}
        showExtra={false}
        description={intl.formatMessage(
          { id: 'content__balance_str' },
          {
            0: balance,
          },
        )}
      />
      <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
    </Pressable>
  );
};

function TokenSelector() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const {
    accountId,
    networkId,
    tokens: listedTokens,
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
              token.name.toLowerCase().includes(searchQuery) ||
              token.tokenIdOnNetwork.toLowerCase().includes(searchQuery),
          )
        : listedTokens;
    const renderFn: ListRenderItem<Token> = ({ item }) => (
      <ListRenderToken
        accountId={accountId}
        networkId={networkId}
        token={item}
        onSelect={onTokenSelected}
      />
    );
    return {
      dataSources: tokens,
      renderItem: renderFn,
    };
  }, [searchQuery, listedTokens, accountId, networkId, onTokenSelected]);

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
