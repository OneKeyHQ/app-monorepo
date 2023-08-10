import type { FC } from 'react';

import { Box } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { EthereumTopYields } from './EthereumTopYields';
import { LidoMaticYields } from './LidoMaticYields';
import { LidoStTokenYields } from './LidoStTokenYields';

export const StakingWidgets: FC<{ token?: Token }> = ({ token }) => (
  <Box>
    <EthereumTopYields token={token} />
    <LidoMaticYields token={token} />
    <LidoStTokenYields token={token} />
  </Box>
);
