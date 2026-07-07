import { useMemo } from 'react';

import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function usePerpTabConfig() {
  const [{ perpConfigCommon, perpConfigLoaded }] =
    usePerpsCommonConfigPersistAtom();
  const isPerpConfigLoaded = perpConfigLoaded ?? false;

  const disablePerp = isPerpConfigLoaded
    ? perpConfigCommon?.disablePerp
    : false;
  const usePerpWeb = perpConfigCommon?.usePerpWeb;

  return useMemo(() => {
    if (disablePerp) {
      return { perpDisabled: true as const };
    }
    if (usePerpWeb) {
      return { perpDisabled: false as const, perpTabShowWeb: true as const };
    }
    return { perpDisabled: false as const };
  }, [disablePerp, usePerpWeb]);
}
