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
      scope: 'settings';
    };
  }) => Promise<IOneKeyDeviceState>;
  getDeviceStateWithUnlock: (params: {
    connectId: string;
    pinType?: DeviceSessionPinType;
    params: {
      connectProtocol?: HardwareConnectProtocol;
      scope: 'runtime' | 'settings';
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
  const isProtocolV2 = connectProtocol === 'V2';
  const unlockedState = await serviceHardware.getDeviceStateWithUnlock({
    connectId,
    ...(isProtocolV2 ? { pinType: DeviceSessionPinType.Any } : {}),
    params: {
      connectProtocol,
      scope: isProtocolV2 ? 'runtime' : 'settings',
    },
  });

  // Protocol V1 has no scoped state and returns the full state in one call.
  if (!isProtocolV2) {
    return unlockedState;
  }

  // Protocol V2 settings reads are rejected while locked, so read them only
  // after the runtime-scoped unlock flow completes.
  return serviceHardware.getDeviceState({
    connectId,
    params: { connectProtocol, scope: 'settings' },
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
