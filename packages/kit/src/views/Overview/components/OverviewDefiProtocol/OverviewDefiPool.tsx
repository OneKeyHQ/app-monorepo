import type { ComponentProps, FC, ReactElement } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  List,
  ListItem,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { TokenIcon } from '@onekeyhq/components/src/Token';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { OverviewDeFiPoolType } from '../../types';

import type { IOverviewDeFiPortfolioItem } from '../../types';
import type { ListRenderItem } from 'react-native';

type TokenKey = 'supplyTokens' | 'rewardTokens' | 'borrowTokens';

interface ColumnItem {
  header: LocaleIds;
  render: (params: { pool: IOverviewDeFiPortfolioItem }) => ReactElement;
  visibleOn?: (params: {
    isVertical: boolean;
    pools: IOverviewDeFiPortfolioItem[];
  }) => boolean;
  boxProps?: ComponentProps<typeof VStack>;
}

const GenernalTokens = ({
  pool,
  tokenKey,
}: {
  pool: IOverviewDeFiPortfolioItem;
  tokenKey: 'supplyTokens' | 'rewardTokens' | 'borrowTokens';
}) => (
  <VStack flex="1">
    {pool?.[tokenKey]?.map((t, i) => (
      <HStack alignItems="center" mt={i > 0 ? '4px' : 0} key={t.tokenAddress}>
        <TokenIcon token={t} size={4} mr="1" />
        <Typography.Body2Strong mr="1">
          <FormatCurrencyNumber
            onlyNumber
            value={new B(t.balanceParsed ?? 0)}
          />
        </Typography.Body2Strong>
        <Typography.Body2Strong mx="1">{t.symbol}</Typography.Body2Strong>
        <Typography.Body2 color="text-subdued">
          <FormatCurrencyNumber value={new B(t.value ?? 0)} />
        </Typography.Body2>
      </HStack>
    ))}
  </VStack>
);

const getPoolColumn = (tokenKey: TokenKey): ColumnItem => ({
  header: 'form__pool_uppercase',
  render: (params) => <GenernalTokens {...params} tokenKey={tokenKey} />,
  boxProps: { minW: '300px' },
});

const getRewardsColumn = (): ColumnItem => ({
  header: 'form__rewards_uppercase',
  visibleOn: ({ pools }) => pools.some((p) => p.rewardTokens?.length > 0),
  render: (params) => <GenernalTokens {...params} tokenKey="rewardTokens" />,
});

const getValueColumn = (): ColumnItem => ({
  header: 'form__value_uppercase',
  render: ({ pool }) => (
    <Typography.Body2Strong flex="1">
      <FormatCurrencyNumber value={new B(pool.poolValue ?? 0)} />
    </Typography.Body2Strong>
  ),
  boxProps: {
    textAlign: 'right',
    maxW: '200px',
  },
});

const getPriceColumn = (tokenKey: TokenKey): ColumnItem => ({
  header: 'content__price',
  render: ({ pool }) => (
    <VStack>
      {pool?.[tokenKey].map((t) => (
        <Typography.Body2Strong>
          <FormatCurrencyNumber value={new B(t.price ?? 0)} />
        </Typography.Body2Strong>
      ))}
    </VStack>
  ),
  boxProps: {
    maxW: '200px',
  },
});

const getAprColumn = (): ColumnItem => ({
  header: 'form__apr_uppercase',
  visibleOn: ({ pools }) => pools.some((p) => typeof p.apr !== 'undefined'),
  render: ({ pool }) => (
    <Typography.Body2Strong>
      <FormatCurrencyNumber onlyNumber value={new B(pool.apr ?? 0)} />%
    </Typography.Body2Strong>
  ),
  boxProps: {
    maxW: '100px',
  },
});

const getUnlockTimeColumn = (): ColumnItem => ({
  header: 'form__unlock_time_uppercase',
  visibleOn: ({ pools }) => pools.some((p) => !!p?.lockedInfo?.unlockTime),
  render: ({ pool }) => (
    <Typography.Body2Strong>
      {pool.lockedInfo.unlockTime}
    </Typography.Body2Strong>
  ),
});

export const OverviewDefiPool: FC<{
  networkId: string;
  poolType: string;
  pools: IOverviewDeFiPortfolioItem[];
}> = ({ pools, poolType }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const columns = useMemo(() => {
    let cols: ColumnItem[] = [];
    switch (poolType) {
      case OverviewDeFiPoolType.Liquidity:
        cols = [
          getPoolColumn('supplyTokens'),
          getRewardsColumn(),
          getValueColumn(),
        ];
        break;
      case OverviewDeFiPoolType.Rewards:
        cols = [
          getPoolColumn('supplyTokens'),
          getPriceColumn('supplyTokens'),
          getAprColumn(),
          getValueColumn(),
        ];
        break;
      case OverviewDeFiPoolType.Lending:
        cols = [
          getPoolColumn('supplyTokens'),
          getPoolColumn('borrowTokens'),
          getPoolColumn('rewardTokens'),
          getValueColumn(),
        ];
        break;
      case OverviewDeFiPoolType.Borrowed:
        cols = [
          getPoolColumn('supplyTokens'),
          getPriceColumn('supplyTokens'),
          getAprColumn(),
          getValueColumn(),
        ];
        break;
      case OverviewDeFiPoolType.Farming:
        cols = [
          getPoolColumn('supplyTokens'),
          getRewardsColumn(),
          getAprColumn(),
          getValueColumn(),
        ];
        break;
      case OverviewDeFiPoolType.Locked:
        cols = [
          getPoolColumn('supplyTokens'),
          getUnlockTimeColumn(),
          getValueColumn(),
        ];
        break;
      case OverviewDeFiPoolType.Staked:
        cols = [
          getPoolColumn('supplyTokens'),
          getRewardsColumn(),
          getValueColumn(),
        ];
        break;
      case OverviewDeFiPoolType.Deposited:
        cols = [
          getPoolColumn('supplyTokens'),
          getRewardsColumn(),
          getPriceColumn('supplyTokens'),
          getAprColumn(),
          getValueColumn(),
        ];
        break;
      case OverviewDeFiPoolType.Vesting:
        cols = [getPoolColumn('supplyTokens'), getValueColumn()];
        break;
      default:
        cols = [];
    }
    return cols.filter(
      (c) =>
        !c.visibleOn ||
        c.visibleOn?.({
          pools,
          isVertical,
        }),
    );
  }, [poolType, pools, isVertical]);

  const len = columns.length;

  const verticalRender: ListRenderItem<IOverviewDeFiPortfolioItem> = ({
    item,
  }) => (
    <ListItem>
      <ListItem.Column>
        <VStack pl="4">
          {columns.map((c, i) => (
            <VStack mt={i === 0 ? 0 : '4'}>
              <Typography.Subheading mb="4">
                {intl.formatMessage({ id: c.header })}
              </Typography.Subheading>
              {c.render({
                pool: item,
              })}
            </VStack>
          ))}
        </VStack>
      </ListItem.Column>
    </ListItem>
  );

  const desktopRender: ListRenderItem<IOverviewDeFiPortfolioItem> = ({
    item,
  }) => (
    <ListItem alignItems="flex-start">
      {columns.map((c, i) => (
        <ListItem.Column key={c.header}>
          <Box
            flex="1"
            pl={i === 0 ? '6' : 0}
            pr={i === len - 1 ? '6' : 0}
            {...(c.boxProps ?? {})}
          >
            {c.render({
              pool: item,
            })}
          </Box>
        </ListItem.Column>
      ))}
    </ListItem>
  );

  const listHeaderRender = useMemo(() => {
    if (isVertical) {
      return undefined;
    }
    // eslint-disable-next-line
    return () => (
      <ListItem borderBottomWidth="1px" borderBottomColor="divider">
        {columns.map((c, i) => (
          <Box
            key={c.header}
            flex="1"
            pl={i === 0 ? '6' : 0}
            pr={i === len - 1 ? '6' : 0}
            {...(c.boxProps ?? {})}
          >
            <ListItem.Column
              text={{
                label: intl.formatMessage({ id: c.header }),
              }}
            />
          </Box>
        ))}
      </ListItem>
    );
  }, [columns, intl, isVertical, len]);

  if (!columns.length) {
    return null;
  }

  return (
    <List
      data={pools}
      keyExtractor={(item) => item.poolCode}
      showDivider
      ListHeaderComponent={listHeaderRender}
      renderItem={isVertical ? verticalRender : desktopRender}
    />
  );
};
