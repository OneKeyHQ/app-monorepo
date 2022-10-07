import React from 'react';

import { useWindowDimensions } from 'react-native';

import { Box, CheckBox, Image, Typography } from '@onekeyhq/components/src';
import { useGridBoxStyle } from '../../hooks/useMarketLayout';

type RecomendedTokenProps = {
  name?: string;
  symbol?: string;
  icon: string;
  coingeckoId: string;
  index: number;
};

const RecommendedTokenBox: React.FC<RecomendedTokenProps> = ({
  name,
  symbol,
  icon,
  coingeckoId,
  index,
}) => {
  const boxStyle = useGridBoxStyle({ index, outPadding: 32 });
  return (
    <Box
      height="64px"
      borderWidth={1}
      borderRadius="12px"
      borderColor="border-default"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
      {...boxStyle}
    >
      <Box ml="3" alignItems="center" flexDirection="row" width="100px">
        <Image borderRadius={16} src={icon} size={8} />
        <Box flexDirection="column" ml="2">
          <Typography.Body2Strong>{symbol}</Typography.Body2Strong>
          <Typography.Body2Strong color="text-subdued">
            {name}
          </Typography.Body2Strong>
        </Box>
      </Box>
      <CheckBox mr="1" value={coingeckoId} />
    </Box>
  );
};

export default RecommendedTokenBox;
