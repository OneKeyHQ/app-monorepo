import { FC, memo, useMemo } from 'react';

import { Box, useUserDevice } from '@onekeyhq/components';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';

import { useActiveWalletAccount } from '../../../hooks';
import { OverviewDefiList } from '../../Overview/components/OverviewDefiList';

const DefiListComp: FC = () => {
  const { size } = useUserDevice();
  const padding = useMemo(() => {
    if (['NORMAL', 'LARGE'].includes(size)) return 32;
    return 16;
  }, [size]);
  const { account, networkId } = useActiveWalletAccount();
  return (
    <Box maxW={MAX_PAGE_CONTAINER_WIDTH} marginX="auto" px={`${padding}px`}>
      <OverviewDefiList
        networkId={networkId}
        address={account?.address ?? ''}
      />
    </Box>
  );
};

export const DefiList = memo(DefiListComp);
