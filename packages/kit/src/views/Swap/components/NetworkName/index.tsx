import type { FC } from 'react';

import { Typography } from '@onekeyhq/components';

import { useNetwork } from '../../../../hooks';

type NetworkNameProps = {
  networkId?: string;
};

export const NetworkName: FC<NetworkNameProps> = ({ networkId }) => {
  const { network } = useNetwork({ networkId });
  return (
    <Typography.Body2 color="text-subdued">
      {network?.name ?? '-'}
    </Typography.Body2>
  );
};
