import {
  usePerpsCommonConfigPersistAtom,
  usePerpsUserConfigPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid';

export function usePerpTabConfig() {
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const [{ perpUserConfig }] = usePerpsUserConfigPersistAtom();
  if (perpConfigCommon?.disablePerp) {
    return {
      perpDisabled: true,
    };
  }
  if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
    return {
      perpDisabled: true,
    };
  }
  if (
    perpConfigCommon?.usePerpWeb ||
    perpUserConfig.currentUserType === EPerpUserType.PERP_WEB
  ) {
    return {
      perpDisabled: false,
      perpTabShowWeb: true,
    };
  }
  return {
    perpDisabled: false,
  };
}
