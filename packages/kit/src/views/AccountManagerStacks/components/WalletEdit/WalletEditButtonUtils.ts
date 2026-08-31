import { resolveHardwarePassphraseEnabled } from '@onekeyhq/shared/src/hardware/deviceStateUtils';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  EHardwareVendor,
  IOneKeyDeviceFeatures,
  IOneKeyDeviceState,
} from '@onekeyhq/shared/types/device';

export function resolveWalletPassphraseProtection({
  deviceState,
  features,
}: {
  deviceState?: IOneKeyDeviceState;
  features?: IOneKeyDeviceFeatures;
}): boolean {
  const canonicalValue = deviceState?.status.passphraseProtection;
  if (typeof canonicalValue === 'boolean') {
    return canonicalValue;
  }
  return features ? resolveHardwarePassphraseEnabled({ features }) : false;
}

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

export function shouldShowBulkCopyAddressesButtonForWallet({
  isPrimeAvailable,
  walletId,
  deprecated,
  backuped,
}: {
  isPrimeAvailable: boolean;
  walletId?: string;
  deprecated?: boolean;
  backuped?: boolean;
}): boolean {
  if (!isPrimeAvailable) {
    return false;
  }
  if (deprecated || !backuped) {
    return false;
  }
  return (
    accountUtils.isHdWallet({ walletId }) ||
    accountUtils.isHwWallet({ walletId })
  );
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
