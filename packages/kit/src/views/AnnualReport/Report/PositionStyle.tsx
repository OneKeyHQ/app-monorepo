import type { FC } from 'react';
import { useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { VStack } from '@onekeyhq/components';

import { WText } from '../components';
import PieChart from '../PieChart';

import type { PageProps } from '../types';

const PositionStyle: FC<PageProps> = ({ params: { tokens } }) => {
  const intl = useIntl();

  const processTokens = useMemo(() => {
    if (!tokens) {
      return [];
    }
    const top5 = tokens?.slice(0, 5).map((t) => ({
      symbol: t.symbol,
      value: new B(t.value),
    }));
    if (tokens?.length <= 5) {
      return top5;
    }
    const other = tokens?.slice(5).reduce(
      (t, n) => ({
        ...t,
        value: t.value.plus(n.value),
      }),
      { value: new B(0), symbol: intl.formatMessage({ id: 'content__other' }) },
    );

    return [...(top5 ?? []), other];
  }, [tokens, intl]);

  const positionStyle = useMemo(() => {
    let total = new B(0);
    let eth = new B(0);
    let usdt = new B(0);
    let usdc = new B(0);
    for (const t of processTokens) {
      if (t.symbol === 'ETH') {
        eth = t.value;
      } else if (t.symbol === 'USDC') {
        usdc = t.value;
      } else if (t.symbol === 'USDT') {
        usdt = t.value;
      }

      total = total.plus(t.value);
    }
    if (eth.div(total).isGreaterThan(1 / 2)) {
      return 'tag__hodler_uppercase';
    }
    if (
      usdc
        .plus(usdt)
        .div(total)
        .isGreaterThan(1 / 2)
    ) {
      return 'tag__stablecoin_player_uppercase';
    }
    return 'tag__adventurist_uppercase';
  }, [processTokens]);

  const tokenDesc = useMemo(() => {
    const [token0, token1, token2] = processTokens.map((t) =>
      t ? (
        <WText
          color="#34C759"
          fontWeight="600"
          fontSize="24px"
          lineHeight="34px"
          pr="16px"
        >
          {t.symbol}
        </WText>
      ) : null,
    );
    switch (processTokens.length) {
      case 0:
        return null;
      case 1:
        return (
          <WText
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            pr="16px"
            useCustomFont
          >
            {intl.formatMessage(
              { id: 'content__str_is_your_favorite_onlyone' },
              {
                0: token0,
              },
            )}
          </WText>
        );
      case 2:
        return (
          <WText
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            pr="16px"
            useCustomFont
          >
            {intl.formatMessage(
              { id: 'content__str_is_your_favorite_onlytwo' },
              {
                symbol_0: token0,
                symbol_1: token1,
              },
            )}
          </WText>
        );

      default: {
        return (
          <WText
            fontWeight="600"
            fontSize="24px"
            lineHeight="34px"
            pr="16px"
            useCustomFont
          >
            {intl.formatMessage(
              { id: 'content__str_is_your_favorite' },
              {
                symbol_0: token0,
                symbol_1: token1,
                symbol_2: token2,
              },
            )}
          </WText>
        );
      }
    }
  }, [processTokens, intl]);

  return (
    <>
      <PieChart
        title={intl.formatMessage({ id: 'content__position_distribution' })}
        data={processTokens.map((t) => ({
          key: t?.symbol ?? '',
          count: t?.value?.toNumber() ?? 0,
        }))}
        size={220}
      />
      <VStack>
        <WText
          fontWeight="600"
          fontSize="24px"
          color="#E2E2E8"
          mb="2"
          lineHeight="34px"
        >
          {intl.formatMessage({ id: 'content__your_positioning_style' })}
        </WText>
        <WText
          fontWeight="800"
          fontSize="40px"
          lineHeight="50px"
          color="#E2E2E8"
          mb="30px"
        >
          {intl.formatMessage({ id: positionStyle })}
        </WText>
        {tokenDesc}
      </VStack>
    </>
  );
};

export default PositionStyle;
