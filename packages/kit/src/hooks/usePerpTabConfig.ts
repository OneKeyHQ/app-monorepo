import { useMemo } from 'react';

import {
  usePerpsCommonConfigPersistAtom,
  usePerpsUserConfigPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid';

export function usePerpTabConfig() {
  const [{ perpConfigCommon, perpConfigLoaded }] =
    usePerpsCommonConfigPersistAtom();
  const [{ perpUserConfig }] = usePerpsUserConfigPersistAtom();
  const isPerpConfigLoaded = perpConfigLoaded ?? false;

  const disablePerp = isPerpConfigLoaded
    ? perpConfigCommon?.disablePerp
    : false;
  const usePerpWeb = perpConfigCommon?.usePerpWeb;
  const currentUserType = perpUserConfig.currentUserType;

  return useMemo(() => {
    if (disablePerp) {
      return { perpDisabled: true as const };
    }
    if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
      return { perpDisabled: true as const };
    }
    if (usePerpWeb || currentUserType === EPerpUserType.PERP_WEB) {
      return { perpDisabled: false as const, perpTabShowWeb: true as const };
    }
    return { perpDisabled: false as const };
  }, [disablePerp, usePerpWeb, currentUserType]);
}
