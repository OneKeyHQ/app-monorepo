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

import { EmptyRecord, Header, ListLoading } from './ERC20TokenList';
import { ERC721Allowance } from './ERC721Allowance';

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
      allowances
        ?.filter((item) => item.allowance.length > 0)
        ?.filter(({ balance }) => {
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
              showDescription={false}
              w="200px"
              alignSelf="flex-start"
              infoBoxProps={{ flex: 1 }}
            />
          </ListItem.Column>
          <ListItem.Column>
            <VStack w="100px" alignSelf="flex-start" textAlign="right">
              <Typography.Body2Strong>
                {balance === 'ERC1155'
                  ? 'N/A'
                  : intl.formatMessage(
                      { id: 'content__int_items' },
                      { 0: balance },
                    )}
              </Typography.Body2Strong>
            </VStack>
          </ListItem.Column>
          <ListItem.Column>
            <VStack
              flex="1"
              borderLeftWidth={1}
              borderLeftColor="divider"
              pl="4"
            >
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
                  showDescription={false}
                  flex="1"
                />
                <VStack alignSelf="flex-start" textAlign="right">
                  <Typography.Body1Strong>
                    {balance === 'ERC1155'
                      ? 'N/A'
                      : intl.formatMessage(
                          { id: 'content__int_items' },
                          { 0: balance },
                        )}
                  </Typography.Body1Strong>
                </VStack>
              </HStack>
              <VStack flex="1">
                {allowance.length === 0 ? (
                  <Typography.Body2Strong color="text-subdued">
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
      ListHeaderComponent={isVertical ? undefined : () => <Header />}
      renderItem={isVertical ? renderListItemMobile : renderListItemDesktop}
      keyExtractor={({ token }) => token.id || token.tokenIdOnNetwork}
      ListEmptyComponent={loading ? <ListLoading /> : <EmptyRecord />}
    />
  );
};
