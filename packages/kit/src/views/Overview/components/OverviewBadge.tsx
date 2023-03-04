import type { FC } from 'react';

import { Badge, Box, Tooltip, useIsVerticalLayout } from '@onekeyhq/components';

import type B from 'bignumber.js';

export const OverviewBadge: FC<{ rate: B }> = ({ rate }) => {
  const isVertical = useIsVerticalLayout();
  if (isVertical) {
    return <Badge ml="2" size="lg" title={`${rate.toFixed(2)}%`} />;
  }
  return (
    <Tooltip
      hasArrow
      _text={{ maxW: '80' }}
      label="Portfolio share"
      placement="top"
    >
      <Box>
        <Badge ml="2" size="lg" title={`${rate.toFixed(2)}%`} />
      </Box>
    </Tooltip>
  );
};
