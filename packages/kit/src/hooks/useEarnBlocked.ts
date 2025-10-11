import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IStakeBlockRegionResponse } from '@onekeyhq/shared/types/staking';

export type IEarnBlockedStatusData = Extract<
  IStakeBlockRegionResponse,
  { isBlockedRegion: true }
>;

export enum EEarnStatus {
  Loading = 'loading',
  Available = 'available',
  Blocked = 'blocked',
}

export const useEarnBlocked = () => {
  const [status, setStatus] = useState<EEarnStatus>(EEarnStatus.Loading);
  const [blockData, setBlockData] = useState<IEarnBlockedStatusData | null>(
    null,
  );

  useEffect(() => {
    const checkBlockRegion = async () => {
      const blockRegion =
        await backgroundApiProxy.serviceStaking.getBlockRegion();

      if (blockRegion.isBlockedRegion) {
        setBlockData(blockRegion as IEarnBlockedStatusData);
        setStatus(EEarnStatus.Blocked);
      } else {
        setStatus(EEarnStatus.Available);
      }
    };

    void checkBlockRegion();
  }, []);

  return { status, blockData };
};
