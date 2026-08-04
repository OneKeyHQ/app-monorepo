import { DeviceSessionPinType } from '@onekeyfe/hd-transport';

import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

import type { HardwareConnectProtocol } from '@onekeyfe/hd-shared';

export enum EHardwareWalletCreationMode {
  Standard = 'standard',
  Hidden = 'hidden',
}

type IWalletCreationHardwareService = {
  getDeviceState: (params: {
    connectId: string;
    params: {
      connectProtocol?: HardwareConnectProtocol;
      scope: 'runtime';
    };
  }) => Promise<IOneKeyDeviceState>;
  getDeviceStateWithUnlock: (params: {
    connectId: string;
    pinType?: DeviceSessionPinType;
    params: {
      connectProtocol?: HardwareConnectProtocol;
      scope: 'runtime';
    };
  }) => Promise<IOneKeyDeviceState>;
};

export async function getWalletCreationDeviceState({
  serviceHardware,
  connectId,
  connectProtocol,
}: {
  serviceHardware: IWalletCreationHardwareService;
  connectId: string;
  connectProtocol?: HardwareConnectProtocol;
}): Promise<IOneKeyDeviceState> {
  const params = {
    connectProtocol,
    scope: 'runtime' as const,
  };
  return serviceHardware.getDeviceStateWithUnlock({
    connectId,
    ...(connectProtocol === 'V2' ? { pinType: DeviceSessionPinType.Any } : {}),
    params,
  });
}

export function shouldCheckExistingStandardWallet(
  state: IOneKeyDeviceState,
): boolean {
  return (
    state.status.unlocked === true && state.status.unlockedAttachPin !== true
  );
}

export function resolveAutomaticWalletCreationMode({
  state,
  existsStandardWallet,
}: {
  state: IOneKeyDeviceState;
  existsStandardWallet: boolean;
}): EHardwareWalletCreationMode | undefined {
  const { passphraseProtection, unlocked, unlockedAttachPin } = state.status;

  if (unlocked !== true) {
    return undefined;
  }

  if (unlockedAttachPin === true) {
    return EHardwareWalletCreationMode.Hidden;
  }

  if (existsStandardWallet) {
    return passphraseProtection === true
      ? EHardwareWalletCreationMode.Hidden
      : EHardwareWalletCreationMode.Standard;
  }

  if (passphraseProtection !== true) {
    return EHardwareWalletCreationMode.Standard;
  }

  return undefined;
}
