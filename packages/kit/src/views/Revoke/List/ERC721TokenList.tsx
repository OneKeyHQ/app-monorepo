import React, { FC, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  List,
  ListItem,
  Token,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { ERC721TokenAllowance } from '@onekeyhq/engine/src/managers/revoke';

import { Filter } from '../FilterBar';
import { useERC721Allowances } from '../hooks';

import { EmptyRecord, ListLoading } from './ERC20TokenList';
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
        w="100px"
        text={{
          label: intl.formatMessage({
            id: 'form__value',
          }),
        }}
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

  console.log(data, loading, accountAddress, allowances);

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
            <Typography.Body2Strong w="100px">N/A</Typography.Body2Strong>
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
                  />
                ))
              )}
            </VStack>
          </ListItem.Column>
        </ListItem>
      );
    },
    [intl, accountAddress, networkId],
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
                <Typography.Body2Strong w="100px">N/A</Typography.Body2Strong>
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
                    />
                  ))
                )}
              </VStack>
            </VStack>
          </ListItem.Column>
        </ListItem>
      );
    },
    [intl, accountAddress, networkId],
  );

  return (
    <List
      data={loading ? [] : data}
      showDivider
      ListHeaderComponent={isVertical ? undefined : () => Header}
      renderItem={isVertical ? renderListItemMobile : renderListItemDesktop}
      keyExtractor={({ token }) => token.id || token.tokenIdOnNetwork}
      ListEmptyComponent={loading ? <ListLoading /> : <EmptyRecord />}
    />
  );
};
