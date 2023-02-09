import { useEffect, useMemo, useState } from 'react';

import type { AccountNameInfo } from '@onekeyhq/engine/src/types/network';
import {
  IMPL_ADA,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_DOGE,
  IMPL_LTC,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks';

export type IDerivationOption = AccountNameInfo & { key: string };

export function useDerivationPath(networkId: string | undefined) {
  const { network } = useNetwork({ networkId });
  const [derivationOptions, setDerivationOptions] = useState<
    IDerivationOption[]
  >([]);

  useEffect(() => {
    backgroundApiProxy.serviceDerivationPath
      .getDerivationSelectOptions(networkId)
      .then((options) => {
        setDerivationOptions(options);
      });
  }, [networkId]);

  const isBTCLikeCoin = useMemo(
    () =>
      [IMPL_BTC, IMPL_TBTC, IMPL_LTC, IMPL_DOGE, IMPL_BCH, IMPL_ADA].includes(
        network?.impl ?? '',
      ),
    [network],
  );

  return {
    derivationOptions,
    isBTCLikeCoin,
  };
}
