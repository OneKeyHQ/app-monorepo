import type { FC } from 'react';
import { useMemo } from 'react';

import { Box } from '@onekeyhq/components';

import { DappSecurityView } from '../../Send/components/DappSecurityView';

export const TxInteractInfo: FC<{ origin: string; networkId: string }> = ({
  origin,
  networkId,
}) => {
  const parsed = useMemo(() => {
    try {
      return new URL(origin);
    } catch (error) {
      // pass
    }
  }, [origin]);
  if (!parsed) {
    return null;
  }
  return (
    <Box bg="surface-default" borderRadius={12} p={4} mb="6">
      <DappSecurityView
        hostname={parsed.hostname}
        origin={parsed.origin}
        networkId={networkId}
      />
    </Box>
  );
};
