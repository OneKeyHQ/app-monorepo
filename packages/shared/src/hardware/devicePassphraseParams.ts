import type { IDevicePassphraseParams } from '@onekeyhq/shared/types/device';

export function devicePassphraseParamsFromWallet(
  passphraseState?: string,
): IDevicePassphraseParams {
  if (passphraseState) {
    return { passphraseState };
  }
  return { useEmptyPassphrase: true };
}
