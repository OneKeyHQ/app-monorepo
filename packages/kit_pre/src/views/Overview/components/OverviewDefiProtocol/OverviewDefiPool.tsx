import type { ComponentProps, FC, ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import B from 'bignumber.js';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Text,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { TokenIcon } from '@onekeyhq/components/src/Token';

import { FormatCurrencyNumber } from '../../../../components/Format';

import type { IOverviewDeFiPortfolioItem } from '../../types';

type TokenKey = 'supplyTokens' | 'rewardTokens' | 'borrowTokens';

interface ColumnItem {
  dataIndex?: keyof IOverviewDeFiPortfolioItem;
  header: LocaleIds;
  render: (params: { pool: IOverviewDeFiPortfolioItem }) => ReactElement | null;
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
}) => {
  const isVertical = useIsVerticalLayout();
  return (
    <VStack>
      {pool?.[tokenKey]?.map((t, i) => (
        <HStack
          alignItems="center"
          mt={i > 0 ? '4px' : 0}
          key={t.tokenAddress}
          flexWrap="wrap"
        >
          <TokenIcon token={t} size={isVertical ? 5 : 4} mr="1" />
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }} mr="1">
            <FormatCurrencyNumber
              onlyNumber
              value={new B(t.balanceParsed ?? 0)}
            />
          </Text>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }} mx="1">
            {t.symbol}
          </Text>
          <Typography.Body2 color="text-subdued">
            <FormatCurrencyNumber
              value={0}
              convertValue={new B(t.value ?? 0)}
            />
          </Typography.Body2>
        </HStack>
      ))}
    </VStack>
  );
};

const getPoolColumn = (): ColumnItem => ({
  dataIndex: 'supplyTokens',
  header: 'form__pool_uppercase',
  render: (params) => <GenernalTokens {...params} tokenKey="supplyTokens" />,
  visibleOn: ({ pools }) => pools.some((p) => p.supplyTokens?.length > 0),
});

const getRewardsColumn = (): ColumnItem => ({
  dataIndex: 'rewardTokens',
  header: 'form__rewards_uppercase',
  visibleOn: ({ pools }) => pools.some((p) => p.rewardTokens?.length > 0),
  render: (params) => <GenernalTokens {...params} tokenKey="rewardTokens" />,
});

const getBorrowedColumn = (): ColumnItem => ({
  dataIndex: 'borrowTokens',
  header: 'form__borrowed_uppercase',
  visibleOn: ({ pools }) => pools.some((p) => p.borrowTokens?.length > 0),
  render: (params) => <GenernalTokens {...params} tokenKey="borrowTokens" />,
});

const getValueColumn = (): ColumnItem => ({
  dataIndex: 'poolValue',
  header: 'form__value_uppercase',
  render: ({ pool }) => (
    <Typography.Body2Strong>
      <FormatCurrencyNumber
        value={0}
        convertValue={new B(pool.poolValue ?? 0)}
      />
    </Typography.Body2Strong>
  ),
  boxProps: {
    textAlign: 'right',
    justifyContent: 'flex-end',
  },
});

const getPriceColumn = (tokenKey: TokenKey): ColumnItem => ({
  header: 'content__price',
  render: ({ pool }) => (
    <VStack>
      {pool?.[tokenKey].map((t) => (
        <Typography.Body2Strong key={t.tokenAddress}>
          <FormatCurrencyNumber value={0} convertValue={new B(t.price ?? 0)} />
        </Typography.Body2Strong>
      ))}
    </VStack>
  ),
  dataIndex: tokenKey,
});

const getAprColumn = (): ColumnItem => ({
  dataIndex: 'apr',
  header: 'form__apr_uppercase',
  visibleOn: ({ pools }) => pools.some((p) => !!p.apr),
  render: ({ pool }) => (
    <Typography.Body2Strong>
      <FormatCurrencyNumber onlyNumber value={new B(pool.apr ?? 0)} />%
    </Typography.Body2Strong>
  ),
});

const getUnlockTimeColumn = (): ColumnItem => ({
  dataIndex: 'lockedInfo',
  header: 'form__unlock_time_uppercase',
  visibleOn: ({ pools }) => pools.some((p) => !!p?.lockedInfo?.unlockTime),
  render: ({ pool }) => {
    const unlockTime = pool?.lockedInfo?.unlockTime;
    if (typeof unlockTime !== 'number') {
      return unlockTime;
    }
    return (
      <Typography.Body2Strong>
        {dayjs(unlockTime * 1000).format('YYYY/MM/DD HH:mm')}
      </Typography.Body2Strong>
    );
  },
});

export const OverviewDefiPool: FC<{
  networkId: string;
  poolType: string;
  pools: IOverviewDeFiPortfolioItem[];
}> = ({ pools }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const filterUnavailableColumn = useCallback(
    (c: ColumnItem) =>
      !c.visibleOn ||
      c.visibleOn?.({
        pools,
        isVertical,
      }),
    [isVertical, pools],
  );

  const columns = useMemo(() => {
    const defaultColumns = [
      getPoolColumn(),
      getBorrowedColumn(),
      getRewardsColumn(),
    ].filter(filterUnavailableColumn);

    const extraColumns = [
      getUnlockTimeColumn(),
      getAprColumn(),
      getValueColumn(),
    ].filter(filterUnavailableColumn);

    if (defaultColumns?.length === 1 && defaultColumns?.[0]?.dataIndex) {
      defaultColumns.push(
        getPriceColumn(defaultColumns[0].dataIndex as TokenKey),
      );
    }

    return defaultColumns.concat(extraColumns);
  }, [filterUnavailableColumn]);

  const len = useMemo(() => pools.length, [pools]);

  const verticalRender = useCallback(
    (item: IOverviewDeFiPortfolioItem, index: number) => {
      const isLast = index === len - 1;
      return (
        <VStack
          key={item.poolCode}
          mb="4"
          pb={isLast ? 0 : 4}
          borderBottomWidth={isLast ? 0 : '1px'}
          borderBottomColor="border-subdued"
          mx="4"
        >
          {columns.map((c, i) => {
            if (c.dataIndex && isEmpty(item[c.dataIndex])) {
              return null;
            }
            return (
              <VStack mt={i === 0 ? 0 : '4'} key={c.header}>
                <Typography.Subheading mb="4" color="text-subdued">
                  {intl.formatMessage({ id: c.header })}
                </Typography.Subheading>
                {c.dataIndex && !isEmpty(item[c.dataIndex])
                  ? c.render({
                      pool: item,
                    })
                  : null}
              </VStack>
            );
          })}
        </VStack>
      );
    },
    [columns, intl, len],
  );

  const desktopRender = useCallback(
    (item: IOverviewDeFiPortfolioItem, index: number) => {
      const isLast = index === pools.length - 1;
      return (
        <HStack
          alignItems="flex-start"
          borderBottomColor="border-subdued"
          borderBottomWidth={isLast ? 0 : '1px'}
          mx="6"
          py="4"
          key={item.poolCode}
        >
          {columns.map((c) => (
            <Box flex="1" {...(c.boxProps ?? {})} key={c.header}>
              {c.render({
                pool: item,
              })}
            </Box>
          ))}
        </HStack>
      );
    },
    [pools, columns],
  );

  const listHeaderRender = useMemo(() => {
    if (isVertical) {
      return null;
    }
    return (
      <HStack mx="6" py="0" flex="1">
        {columns.map((c) => (
          <Box key={c.header} flex="1" {...(c.boxProps ?? {})}>
            <Typography.Subheading color="text-subdued">
              {intl.formatMessage({ id: c.header })}
            </Typography.Subheading>
          </Box>
        ))}
      </HStack>
    );
  }, [columns, intl, isVertical]);

  if (!columns.length) {
    return null;
  }

  return (
    <Box>
      {listHeaderRender}
      {pools.map((item, index) => {
        const render = isVertical ? verticalRender : desktopRender;
        return render(item, index);
      })}
    </Box>
  );
};
