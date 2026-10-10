import type { IReceiveSwitchEntry } from '@onekeyhq/shared/src/routes';

// Whether the Receive page card header offers the network switch. The entry
// decides eligibility (fixed-destination entries pass no switchEntry); the
// page state decides availability (a running hardware verification or
// share-image generation disables the trigger).
export function resolveReceiveNetworkSwitchable({
  switchEntry,
  exchangeSource,
  isBtcUsedAddressVerifyMode,
  memberCount,
  isVerifying,
  isPreparingShare,
}: {
  switchEntry?: IReceiveSwitchEntry;
  exchangeSource?: string;
  isBtcUsedAddressVerifyMode?: boolean;
  memberCount: number;
  isVerifying?: boolean;
  isPreparingShare?: boolean;
}): { isSwitchable: boolean; isSwitchEnabled: boolean } {
  const isSwitchable =
    !!switchEntry &&
    !exchangeSource &&
    !isBtcUsedAddressVerifyMode &&
    (switchEntry === 'network' || memberCount >= 2);
  return {
    isSwitchable,
    isSwitchEnabled: isSwitchable && !isVerifying && !isPreparingShare,
  };
}
