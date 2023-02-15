import { useEffect, useMemo, useState } from 'react';

import type { AccountNameInfo } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks';

export type IDerivationOption = AccountNameInfo & { key: string };

export function useDerivationPath(
  walletId: string | undefined,
  networkId: string | undefined,
) {
  const { network } = useNetwork({ networkId });
  const [derivationOptions, setDerivationOptions] = useState<
    IDerivationOption[]
  >([]);

  useEffect(() => {
    backgroundApiProxy.serviceDerivationPath
      .getDerivationSelectOptions(walletId, networkId)
      .then((options) => {
        setDerivationOptions(options);
      });
  }, [walletId, networkId]);

  const isUTXOModel = useMemo(() => network?.settings.isUTXOModel, [network]);

  return {
    derivationOptions,
    isUTXOModel,
  };
}
