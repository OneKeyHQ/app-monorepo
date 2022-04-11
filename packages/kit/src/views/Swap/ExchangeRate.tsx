import React, { FC, useState } from 'react';

import { Box, IconButton, Typography } from '@onekeyhq/components';

type ExchangeRateProps = {
  price: string;
  inputSymbol: string;
  outputSymbol: string;
};

const ExchangeRate: FC<ExchangeRateProps> = ({
  inputSymbol,
  outputSymbol,
  price,
}) => {
  const [isSwitched, setSwitched] = useState(false);
  if (!isSwitched) {
    return (
      <Box flexDirection="row" alignItems="center">
        <Typography.Body2>{`1${inputSymbol} = ${Number(price).toFixed(
          4,
        )}${outputSymbol}`}</Typography.Body2>
        <IconButton
          type="plain"
          name="SwitchHorizontalSolid"
          onPress={() => setSwitched((v) => !v)}
        />
      </Box>
    );
  }
  return (
    <Box flexDirection="row" alignItems="center">
      <Typography.Body2>{`1${outputSymbol} = ${(1 / Number(price)).toFixed(
        4,
      )}${inputSymbol}`}</Typography.Body2>
      <IconButton
        type="plain"
        name="SwitchHorizontalSolid"
        onPress={() => setSwitched((v) => !v)}
      />
    </Box>
  );
};

export default ExchangeRate;
