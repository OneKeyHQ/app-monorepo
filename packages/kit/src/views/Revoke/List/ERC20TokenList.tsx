import type { FC } from 'react';
import { useCallback } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  HStack,
  List,
  ListItem,
  Skeleton,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';
import type { ERC20TokenAllowance } from '@onekeyhq/engine/src/managers/revoke';
import { toFloat } from '@onekeyhq/engine/src/managers/revoke';

import { FormatCurrencyNumber } from '../../../components/Format';
import { useIsVerticalOrMiddleLayout } from '../hooks';
import { AssetType } from '../types';

import { ERC20Allowance } from './ERC20Allowance';

export const EmptyRecord = () => {
  const intl = useIntl();

  return (
    <Empty
      emoji="👀"
      title={intl.formatMessage({ id: 'title__no_record_found' })}
    />
  );
};

export const Header = ({ assetType }: { assetType: AssetType }) => {
  const intl = useIntl();
  return (
    <ListItem>
      <ListItem.Column
        text={{
          label: intl.formatMessage({
            id: assetType === AssetType.tokens ? 'form__token' : 'form__nft',
          }),
        }}
        w="200px"
      />
      <ListItem.Column
        w="200px"
        text={{
          label: intl.formatMessage({
            id: 'form__balance',
          }),
        }}
        textAlign="right"
      />
      <ListItem.Column
        text={{
          label: intl.formatMessage({
            id: 'form__project',
          }),
        }}
        flex="1"
      />
      <ListItem.Column
        text={{
          label: intl.formatMessage({ id: 'form__allowance' }),
        }}
        w="260px"
        textAlign="left"
      />
    </ListItem>
  );
};

export const TokensHeader = () => <Header assetType={AssetType.tokens} />;

export const NftsHeader = () => <Header assetType={AssetType.nfts} />;

export const ListLoading = () => {
  const isVertical = useIsVerticalOrMiddleLayout();
  if (isVertical) {
    return (
      <>
        {new Array(5).fill(1).map((_, idx) => (
          <VStack flex="1" key={String(idx)} mb="4" px="2">
            <HStack mb="4">
              <HStack flex="1" alignItems="center">
                <Skeleton shape="Avatar" />
                <VStack ml="2">
                  <Skeleton shape="Body1" />
                </VStack>
              </HStack>
              <VStack>
                <Skeleton shape="Body1" />
                <Skeleton shape="Body2" />
              </VStack>
            </HStack>
            <HStack flex="1" alignItems="center">
              <VStack flex="1" mr="4">
                <Skeleton shape="Body2" />
                <Skeleton shape="Body2" />
              </VStack>
              <Skeleton shape="Caption" />
              <Box ml="2">
                <Skeleton shape="Caption" />
              </Box>
            </HStack>
          </VStack>
        ))}
      </>
    );
  }
  return (
    <>
      {new Array(5).fill(1).map((_, idx) => (
        <ListItem flex="1" key={String(idx)}>
          <ListItem.Column>
            <HStack w="200px" alignItems="center">
              <Skeleton shape="Avatar" />
              <VStack ml="2">
                <Skeleton shape="Body1" />
              </VStack>
            </HStack>
          </ListItem.Column>
          <ListItem.Column>
            <HStack w="200px" justifyContent="flex-end">
              <Skeleton shape="Body1" />
            </HStack>
          </ListItem.Column>
          <ListItem.Column>
            <Box flex="1">
              <Skeleton shape="Body1" />
            </Box>
          </ListItem.Column>
          <ListItem.Column>
            <HStack w="260px">
              <VStack flex="1">
                <Skeleton shape="Body2" />
                <Skeleton shape="Body2" />
              </VStack>
              <HStack>
                <Skeleton shape="Caption" />
                <Box ml="2">
                  <Skeleton shape="Caption" />
                </Box>
              </HStack>
            </HStack>
          </ListItem.Column>
        </ListItem>
      ))}
    </>
  );
};

export const ERC20TokenList: FC<{
  loading: boolean;
  allowances: ERC20TokenAllowance[];
  address?: string;
  prices: Record<string, number | undefined>;
  networkId: string;
}> = ({ loading, allowances: data, prices, address, networkId }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalOrMiddleLayout();

  const renderListItemDesktop = useCallback(
    ({ item }: { item: ERC20TokenAllowance }) => {
      const {
        token,
        token: { symbol, decimals },
        balance,
        allowance,
        totalSupply,
      } = item;
      // @ts-ignore
      const price = prices[token.address?.toLowerCase?.() ?? ''];
      const balanceBN = new B(balance).div(10 ** decimals);
      const priceMulBalance =
        typeof price === 'undefined' ? null : balanceBN.multipliedBy(price);
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
              nameProps={{
                fontSize: 16,
              }}
            />
          </ListItem.Column>
          <ListItem.Column>
            <VStack w="200px" alignSelf="flex-start" textAlign="right">
              <Typography.Body2Strong>
                {`${toFloat(Number(balance), decimals)} ${symbol}`}
              </Typography.Body2Strong>
              <Typography.Body2>
                {priceMulBalance ? (
                  <FormatCurrencyNumber value={priceMulBalance.toNumber()} />
                ) : (
                  'N/A'
                )}
              </Typography.Body2>
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
                  <ERC20Allowance
                    key={a.spender}
                    networkId={networkId}
                    accountAddress={address ?? ''}
                    totalSupply={totalSupply}
                    allowance={a.allowance}
                    spender={a.spender}
                    balance={balanceBN}
                    price={price}
                    token={token}
                  />
                ))
              )}
            </VStack>
          </ListItem.Column>
        </ListItem>
      );
    },
    [networkId, prices, intl, address],
  );

  const renderListItemMobile = useCallback(
    ({ item }: { item: ERC20TokenAllowance }) => {
      const {
        token,
        token: { symbol, decimals },
        balance,
        allowance,
        totalSupply,
      } = item;
      // @ts-ignore
      const price = prices[token.address?.toLowerCase?.() ?? ''];
      const balanceBN = new B(balance).div(10 ** decimals);
      const priceMulBalance =
        typeof price === 'undefined' ? null : balanceBN.multipliedBy(price);
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
                  infoBoxProps={{ flex: 1 }}
                  nameProps={{ fontSize: 16 }}
                />
                <VStack
                  alignSelf="flex-start"
                  textAlign="right"
                  alignItems="flex-end"
                >
                  <Typography.Body2Strong>
                    {`${toFloat(Number(balance), decimals)} ${symbol}`}
                  </Typography.Body2Strong>
                  <Typography.Body2>
                    {priceMulBalance ? (
                      <FormatCurrencyNumber
                        value={priceMulBalance.toNumber()}
                      />
                    ) : (
                      'N/A'
                    )}
                  </Typography.Body2>
                </VStack>
              </HStack>
              <VStack flex="1">
                {allowance.length === 0 ? (
                  <Typography.Body2Strong color="text-subdued">
                    {intl.formatMessage({ id: 'form__no_allowance' })}
                  </Typography.Body2Strong>
                ) : (
                  allowance.map((a) => (
                    <ERC20Allowance
                      key={a.spender}
                      networkId={networkId}
                      accountAddress={address ?? ''}
                      totalSupply={totalSupply}
                      allowance={a.allowance}
                      spender={a.spender}
                      balance={balanceBN}
                      price={price}
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
    [networkId, prices, intl, address],
  );

  return (
    <List
      data={loading ? [] : data}
      showDivider
      ListHeaderComponent={isVertical ? undefined : TokensHeader}
      renderItem={isVertical ? renderListItemMobile : renderListItemDesktop}
      keyExtractor={({ token }) => token.id ?? token.tokenIdOnNetwork}
      ListEmptyComponent={loading ? <ListLoading /> : <EmptyRecord />}
    />
  );
};
