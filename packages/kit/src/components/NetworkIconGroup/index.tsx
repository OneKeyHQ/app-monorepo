import type { FC } from 'react';
import { useMemo } from 'react';

import { Box } from '@onekeyhq/components';
import { NetworkDarkIcon } from '@onekeyhq/components/src/Network/DarkIcon';

export const NetworkIconGroup: FC<{
  networkIds: string[];
  len?: number;
}> = ({ networkIds, len = 4 }) => {
  const data = useMemo(() => {
    if (!networkIds?.length) {
      return [];
    }
    const ns = networkIds.slice(0, len);
    if (networkIds.length > len) {
      ns.push('more');
    }
    return ns;
  }, [networkIds, len]);

  return (
    <Box flexDirection="row">
      {data.map((n, idx) => (
        <Box key={n} ml={idx === 0 ? 0 : -1}>
          <NetworkDarkIcon networkId={n} />
        </Box>
      ))}
    </Box>
  );
};
