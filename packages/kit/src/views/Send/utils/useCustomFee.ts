import { useCallback, useEffect, useState } from 'react';

import type { IFeeInfoUnit } from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function useCustomFee(networkId: string) {
  const [customFee, setCustomFee] = useState<IFeeInfoUnit | null | undefined>();

  const updateCustomFee = useCallback(
    (fee?: IFeeInfoUnit | null) => {
      if (fee === undefined) return;
      setCustomFee(fee);
      backgroundApiProxy.serviceNetwork.updateNetworkCustomFee(networkId, fee);
    },
    [networkId],
  );

  useEffect(() => {
    const getcustomFee = async () => {
      try {
        const fee = await backgroundApiProxy.serviceNetwork.getNetworkCustomFee(
          networkId,
        );
        if (fee) {
          setCustomFee(fee);
        } else {
          setCustomFee(null);
        }
      } catch {
        setCustomFee(null);
      }
    };
    getcustomFee();
  }, [networkId]);

  return {
    customFee,
    updateCustomFee,
  };
}

export { useCustomFee };
