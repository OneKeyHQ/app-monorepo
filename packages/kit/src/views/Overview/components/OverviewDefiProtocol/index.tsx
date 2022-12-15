import { FC, useCallback, useMemo } from 'react';

import B from 'bignumber.js';
import { groupBy, uniq } from 'lodash';
import { useAsync } from 'react-async-hook';
import { useIntl } from 'react-intl';

import {
  Collapse,
  List,
  Text,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { FormatCurrencyNumber } from '../../../../components/Format';
import { getTokenValues } from '../../../../utils/priceUtils';
import {
  IOverviewDeFiPoolTokenBalance,
  IOverviewDeFiPortfolioItem,
  ITokenInfo,
  OverviewDeFiPoolType,
  OverviewDefiRes,
} from '../../types';

import { OverviewDefiBoxHeader } from './Header';
import { OverviewDefiPool } from './OverviewDefiPool';

const PoolName: FC<{
  poolType: OverviewDeFiPoolType;
  poolName: string;
}> = ({ poolType }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Text my={3}>
      <Typography.Body2Strong
        bg="surface-highlight-default"
        borderRadius="6px"
        numberOfLines={1}
        ml={isVertical ? 4 : 6}
        color="text-default"
        px="6px"
        py="2px"
      >
        {poolType}
      </Typography.Body2Strong>
    </Text>
  );
};

export const OverviewDefiProtocol: FC<
  OverviewDefiRes & {
    networkId: string;
  }
> = ({ pools, networkId }) => {
  const intl = useIntl();
  const groupedPools = Object.entries(groupBy(pools, (p) => p.poolType));

  const { result: allTokensMap, loading: tokensLoading } = useAsync(
    async () =>
      backgroundApiProxy.serviceToken.getAllTokensMapByNetworkId(networkId),
    [networkId],
  );

  const { result: pricesMap, loading: pricesLoading } = useAsync(
    async () =>
      backgroundApiProxy.serviceToken.getPrices({
        networkId,
        tokenIds: uniq(
          pools
            .map((p) =>
              [...p.supplyTokens, ...p.rewardTokens, ...p.borrowTokens].map(
                (t) => t.tokenAddress,
              ),
            )
            .flat(),
        ),
      }),
    [pools],
  );

  const getTokenInfo = useCallback(
    (token: IOverviewDeFiPoolTokenBalance) =>
      allTokensMap?.[token.tokenAddress] ??
      ({
        logoURI: '',
        address: token.tokenAddress,
        symbol: token.symbol,
      } as Token),
    [allTokensMap],
  );

  const getTokenPrice = useCallback(
    (token: ITokenInfo) => pricesMap?.[token.tokenAddress],
    [pricesMap],
  );

  const getTokensValue = useCallback(
    (tokens: IOverviewDeFiPoolTokenBalance[]) =>
      getTokenValues({
        tokens: tokens.map((t) => getTokenInfo(t)),
        prices: pricesMap ?? {},
        balances: tokens.reduce(
          (sum, next) => ({
            ...sum,
            [next.tokenAddress]: next.balanceParsed,
          }),
          {},
        ),
      }).reduce((sum, next) => sum.plus(next), new B(0)),
    [pricesMap, getTokenInfo],
  );

  const getPoolValue = useCallback(
    (pool: IOverviewDeFiPortfolioItem) => {
      const totalTokens = [...pool.rewardTokens];
      if (pool.poolType !== OverviewDeFiPoolType.Borrowed) {
        totalTokens.push(...pool.supplyTokens);
      }
      const total = getTokensValue(totalTokens);
      const borrowedTokens = [...pool.borrowTokens];
      if (pool.poolType === OverviewDeFiPoolType.Borrowed) {
        borrowedTokens.push(...pool.supplyTokens);
      }
      const borrowed = getTokensValue(borrowedTokens);
      return total.minus(borrowed);
    },
    [getTokensValue],
  );

  const allProtocolValue = useMemo(
    () => pools.reduce((sum, next) => sum.plus(getPoolValue(next)), new B(0)),
    [getPoolValue, pools],
  );

  const allClaimableValue = useMemo(
    () =>
      pools.reduce(
        (sum, next) => sum.plus(getTokensValue(next.rewardTokens)),
        new B(0),
      ),
    [getTokensValue, pools],
  );

  if (tokensLoading || pricesLoading) {
    return null;
  }

  const protocolInfo = pools[0];

  if (!protocolInfo) {
    return null;
  }

  return (
    <Collapse
      borderRadius="12px"
      bg="surface-default"
      borderWidth="1px"
      borderColor="divider"
      mb="6"
      defaultCollapsed={false}
      renderCustomTrigger={(toggle, collapsed) => (
        <OverviewDefiBoxHeader
          name={protocolInfo.protocolName}
          desc={
            <Typography.Heading>
              <FormatCurrencyNumber value={allProtocolValue} />
            </Typography.Heading>
          }
          extra={
            allClaimableValue.isGreaterThan(0) ? (
              <Typography.Body2Strong color="text-subdued">
                {intl.formatMessage(
                  { id: 'form__claimable_str' },
                  {
                    0: <FormatCurrencyNumber value={allClaimableValue} />,
                  },
                )}
              </Typography.Body2Strong>
            ) : undefined
          }
          icon={protocolInfo.protocolIcon}
          toggle={toggle}
          collapsed={collapsed}
        />
      )}
    >
      <List
        m="0"
        w="100%"
        data={groupedPools}
        renderItem={({ item }) => (
          <VStack borderTopWidth="1px" borderTopColor="divider" pt="2" pb="4">
            <PoolName
              poolType={item[0] as OverviewDeFiPoolType}
              poolName={item[1][0].poolName}
            />
            <OverviewDefiPool
              networkId={networkId}
              poolType={item[0]}
              pools={item[1]}
              tokensMap={allTokensMap ?? {}}
              pricesMap={pricesMap ?? {}}
              getTokenInfo={getTokenInfo}
              getTokenPrice={getTokenPrice}
              getTokensValue={getTokensValue}
              getPoolValue={getPoolValue}
            />
          </VStack>
        )}
        keyExtractor={(item) => item[0]}
      />
    </Collapse>
  );
};
