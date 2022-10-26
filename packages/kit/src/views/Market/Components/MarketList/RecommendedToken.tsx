import React from 'react';

import {
  Box,
  CheckBox,
  Image,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';

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
  const isVertical = useIsVerticalLayout();
  const boxStyle = useGridBoxStyle({ index, outPadding: isVertical ? 32 : 48 });
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
      <Box ml="3" alignItems="center" flexDirection="row" flex={1}>
        <Image borderRadius={16} src={icon} size={8} />
        <Box flexDirection="column" ml="2" flex={1}>
          <Typography.Body2Strong>{symbol}</Typography.Body2Strong>
          <Typography.Body2Strong numberOfLines={1} color="text-subdued">
            {name}
          </Typography.Body2Strong>
        </Box>
      </Box>
      <Box
        size={5}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        mr={1}
      >
        <CheckBox value={coingeckoId} />
      </Box>
    </Box>
  );
};

export default RecommendedTokenBox;
