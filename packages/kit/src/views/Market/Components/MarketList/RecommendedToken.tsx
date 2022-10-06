import React from 'react';

import {
  Box,
  CheckBox,
  Image,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';

type RecomendedTokenProps = {
  name: string;
  symbol: string;
  icon: string;
  coingeckoId: string;
};

const RecommendedTokenBox: React.FC<RecomendedTokenProps> = ({
  name,
  symbol,
  icon,
  coingeckoId,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const width = isVerticalLayout ? '173px' : '200px';
  return (
    <Box
      width={width}
      height="64px"
      borderWidth={1}
      borderRadius="12px"
      borderColor="border-default"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Box ml="3" flexDirection="row" width="100px">
        <Image borderRadius={16} src={icon} size={8} />
        <Box flexDirection="column" ml="2">
          <Typography.Body2Strong>{symbol}</Typography.Body2Strong>
          <Typography.Body2Strong color="text-subdued">
            {name}
          </Typography.Body2Strong>
        </Box>
      </Box>
      <CheckBox mr="3" value={coingeckoId} />
    </Box>
  );
};

export default RecommendedTokenBox;
