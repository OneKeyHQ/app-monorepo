import { useEffect, useState } from 'react';

import type {
  IEncodedTx,
  IFeeInfoSelectedType,
} from '@onekeyhq/engine/src/vaults/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../hooks';

export function useSolCustomFee({
  networkId,
  accountId,
  computeUnitPrice,
  feeType,
  encodedTx,
}: {
  networkId: string;
  accountId: string;
  computeUnitPrice: string;
  feeType: IFeeInfoSelectedType;
  encodedTx?: IEncodedTx;
}) {
  const [solLimit, setSolLimit] = useState<string | undefined>();
  const [solPrice, setSolPrice] = useState<string | undefined>();
  const debounceComputeUnitPrice = useDebounce(computeUnitPrice, 300);

  useEffect(() => {
    if (encodedTx && debounceComputeUnitPrice && feeType === 'custom') {
      backgroundApiProxy.engine
        .fetchFeeInfo({
          networkId,
          accountId,
          encodedTx,
          specifiedFeeRate: debounceComputeUnitPrice,
        })
        .then((feeInfo) => {
          setSolLimit(feeInfo.limit);
          setSolPrice((feeInfo.prices as string[])[0]);
        });
    }
  }, [feeType, networkId, accountId, encodedTx, debounceComputeUnitPrice]);

  return {
    solLimit,
    solPrice,
  };
}
