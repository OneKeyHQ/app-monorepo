import React, { FC, useState } from 'react';

import { Box, IconButton, Typography } from '@onekeyhq/components';

import { Token } from '../../store/typings';

import { SwapQuote } from './typings';

type ExchangeRateProps = {
  tokenA?: Token;
  tokenB?: Token;
  quote?: SwapQuote;
  independentField: 'INPUT' | 'OUTPUT';
};

const ExchangeRate: FC<ExchangeRateProps> = ({
  tokenA,
  tokenB,
  quote,
  independentField,
}) => {
  const [isSwitched, setSwitched] = useState(false);
  if (!tokenA || !tokenB || !quote) {
    return <Typography.Body2 color="text-default">---</Typography.Body2>;
  }

  const symbolA = tokenA.symbol;
  const symbolB = tokenB.symbol;
  const { price: basePrice } = quote;
  const price =
    independentField === 'INPUT' ? basePrice : 1 / Number(basePrice);
  if (!isSwitched) {
    const title = `1${symbolA} = ${Number(price).toFixed(4)}${symbolB}`;
    return (
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="flex-end"
        flex="1"
      >
        <Typography.Body2 color="text-default" textAlign="right" pl="2">
          {title}
        </Typography.Body2>
        <IconButton
          size="xs"
          type="plain"
          name="SwitchHorizontalSolid"
          onPress={() => setSwitched((v) => !v)}
        />
      </Box>
    );
  }
  const title = `1${symbolB} = ${(1 / Number(price)).toFixed(4)}${symbolA}`;
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="flex-end">
      <Typography.Body2 color="text-default" textAlign="right" pl="2">
        {title}
      </Typography.Body2>
      <IconButton
        size="xs"
        type="plain"
        name="SwitchHorizontalSolid"
        onPress={() => setSwitched((v) => !v)}
      />
    </Box>
  );
};

export default ExchangeRate;
