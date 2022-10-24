import React, { FC, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  List,
  ListItem,
  Skeleton,
  Token,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { ERC721TokenAllowance } from '@onekeyhq/engine/src/managers/revoke';

import { Filter } from '../FilterBar';
import { useERC721Allowances } from '../hooks';

import { EmptyRecord } from './ERC20TokenList';
import { ERC721Allowance } from './ERC721Allowance';

export const Header = () => {
  const intl = useIntl();
  return (
    <ListItem>
      <ListItem.Column
        text={{
          label: `${intl.formatMessage({
            id: 'form__token',
          })} / ${intl.formatMessage({ id: 'form__balance' })}`,
        }}
        w="300px"
      />
      <ListItem.Column
        text={{
          label: `${intl.formatMessage({
            id: 'form__project',
          })} / ${intl.formatMessage({ id: 'form__allowance' })}`,
        }}
        flex="1"
      />
    </ListItem>
  );
};

export const ListLoading = () => (
  <>
    {new Array(5).fill(1).map((_, idx) => (
      <ListItem flex="1" key={String(idx)}>
        <ListItem.Column>
          <HStack w="300px" alignItems="center">
            <Skeleton shape="Avatar" />
            <VStack ml="2">
              <Skeleton shape="Body1" />
              <Skeleton shape="Body2" />
            </VStack>
          </HStack>
        </ListItem.Column>
        <ListItem.Column>
          <Box flex="1">
            <Skeleton shape="Body1" />
          </Box>
        </ListItem.Column>
        <ListItem.Column>
          <HStack>
            <Skeleton shape="Caption" />
            <Box ml="2">
              <Skeleton shape="Caption" />
            </Box>
          </HStack>
        </ListItem.Column>
      </ListItem>
    ))}
  </>
);

export const ERC721TokenList: FC<{
  networkId: string;
  addressOrName: string;
  filters: Filter;
}> = ({ networkId, addressOrName, filters }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  const {
    loading,
    allowances,
    address: accountAddress,
    refresh,
  } = useERC721Allowances(networkId, addressOrName);

  const data = useMemo(
    () =>
      allowances?.filter(({ balance }) => {
        if (filters.includeZeroBalancesTokens) {
          return true;
        }
        return balance !== '0';
      }) ?? [],
    [filters, allowances],
  );

  const renderListItemDesktop = useCallback(
    ({ item }: { item: ERC721TokenAllowance }) => {
      const {
        token,
        token: { symbol },
        balance,
        allowance,
      } = item;
      return (
        <ListItem flex={1}>
          <ListItem.Column>
            <Token
              token={token}
              size={8}
              showInfo
              name={symbol}
              description={intl.formatMessage(
                { id: 'content__int_items' },
                { 0: balance },
              )}
              w="300px"
              alignSelf="flex-start"
              infoBoxProps={{ flex: 1 }}
            />
          </ListItem.Column>
          <ListItem.Column>
            <VStack flex="1">
              {allowance.length === 0 ? (
                <Typography.Body2Strong>
                  {intl.formatMessage({ id: 'form__no_allowance' })}
                </Typography.Body2Strong>
              ) : (
                allowance.map((a) => (
                  <ERC721Allowance
                    key={a.spender}
                    networkId={networkId}
                    accountAddress={accountAddress}
                    spender={a.spender}
                    token={token}
                    onRevokeSuccess={refresh}
                  />
                ))
              )}
            </VStack>
          </ListItem.Column>
        </ListItem>
      );
    },
    [intl, accountAddress, networkId, refresh],
  );

  const renderListItemMobile = useCallback(
    ({ item }: { item: ERC721TokenAllowance }) => {
      const {
        token,
        token: { symbol },
        balance,
        allowance,
      } = item;
      return (
        <ListItem>
          <ListItem.Column>
            <VStack flex="1">
              <HStack mb="4">
                <Token
                  token={token}
                  size={8}
                  showInfo
                  name={symbol}
                  description={intl.formatMessage(
                    { id: 'content__int_items' },
                    { 0: balance },
                  )}
                  flex="1"
                />
              </HStack>
              <VStack flex="1">
                {allowance.length === 0 ? (
                  <Typography.Body2Strong>
                    {intl.formatMessage({ id: 'form__no_allowance' })}
                  </Typography.Body2Strong>
                ) : (
                  allowance.map((a) => (
                    <ERC721Allowance
                      key={a.spender}
                      networkId={networkId}
                      accountAddress={accountAddress}
                      spender={a.spender}
                      token={token}
                      onRevokeSuccess={refresh}
                    />
                  ))
                )}
              </VStack>
            </VStack>
          </ListItem.Column>
        </ListItem>
      );
    },
    [intl, accountAddress, networkId, refresh],
  );

  return (
    <List
      data={loading ? [] : data}
      showDivider
      ListHeaderComponent={isVertical ? undefined : () => <Header />}
      renderItem={isVertical ? renderListItemMobile : renderListItemDesktop}
      keyExtractor={({ token }) => token.id || token.tokenIdOnNetwork}
      ListEmptyComponent={loading ? <ListLoading /> : <EmptyRecord />}
    />
  );
};
