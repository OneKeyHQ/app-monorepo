import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function shouldShowAddHiddenWalletButtonForWallet(params: {
  isKeyless?: boolean;
  isHiddenWallet: boolean;
  isHwOrQrWallet: boolean;
  vendor?: EHardwareVendor;
}) {
  const { isKeyless, isHiddenWallet, isHwOrQrWallet, vendor } = params;
  if (isKeyless) return false;
  const profile = getVendorProfile(vendor);
  if (
    !profile.supportsPassphraseSetting ||
    !profile.supportsHiddenWalletCreation
  ) {
    return false;
  }
  return !isHiddenWallet && isHwOrQrWallet;
}

export function shouldShowDeviceManagementButtonForWallet(params: {
  isKeyless?: boolean;
  isHiddenWallet: boolean;
  isHwOrQrWallet: boolean;
  vendor?: EHardwareVendor;
}) {
  const { isKeyless, isHiddenWallet, isHwOrQrWallet, vendor } = params;
  if (isKeyless || isHiddenWallet || !isHwOrQrWallet) return false;
  return getVendorProfile(vendor).supportsDeviceManagementDetails;
}

export function shouldShowCreateHiddenWalletSidebarButtonForWallet(params: {
  isEditableRouteParams: boolean;
  showAddHiddenInWalletSidebar?: boolean;
  isDeprecated?: boolean;
  isHiddenWallet: boolean;
  isHwOrQrWallet: boolean;
  isHwWallet: boolean;
  isQrWallet: boolean;
  hasPassphraseProtection?: boolean;
  hiddenWalletsLength?: number;
  vendor?: EHardwareVendor;
}) {
  const {
    isEditableRouteParams,
    showAddHiddenInWalletSidebar,
    isDeprecated,
    isHiddenWallet,
    isHwOrQrWallet,
    isHwWallet,
    isQrWallet,
    hasPassphraseProtection,
    hiddenWalletsLength = 0,
    vendor,
  } = params;
  if (
    !isEditableRouteParams ||
    !showAddHiddenInWalletSidebar ||
    isDeprecated ||
    !shouldShowAddHiddenWalletButtonForWallet({
      isHiddenWallet,
      isHwOrQrWallet,
      vendor,
    })
  ) {
    return false;
  }

  if (isHwWallet && !isQrWallet) {
    return hasPassphraseProtection === true || hiddenWalletsLength > 0;
  }

  if (isQrWallet && !isHwWallet) {
    return hiddenWalletsLength > 0;
  }

  return false;
}
