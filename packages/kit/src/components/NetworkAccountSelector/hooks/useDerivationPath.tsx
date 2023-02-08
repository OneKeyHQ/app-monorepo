import { useMemo } from 'react';

import { omit } from 'lodash';

import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_LTC,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { useNetwork } from '../../../hooks';

export function useDerivationPath(networkId: string | undefined) {
  const { network } = useNetwork({ networkId });

  const derivationOptions = useMemo(() => {
    if (!network?.impl) return [];
    let accountNameInfo = getAccountNameInfoByImpl(network.impl);
    if (network.impl === IMPL_EVM && network.symbol !== 'ETC') {
      accountNameInfo = omit(accountNameInfo, 'etcNative');
    }
    return Object.entries(accountNameInfo).map(([k, v]) => ({ ...v, key: k }));
  }, [network]);

  const isBTCLikeCoin = useMemo(
    () => [IMPL_BTC, IMPL_TBTC, IMPL_LTC].includes(network?.impl ?? ''),
    [network],
  );

  return {
    derivationOptions,
    isBTCLikeCoin,
  };
}
