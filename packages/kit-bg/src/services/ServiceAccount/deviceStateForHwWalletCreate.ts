import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

type IGetDeviceStateForHwWalletCreate = (
  connectId: string,
  params: { scope: 'runtime' },
) => Promise<IOneKeyDeviceState>;

export function getStandardHwWalletLabelForNameSync({
  currentWalletName,
  deviceState,
  explicitName,
  isThirdParty,
  passphraseState,
}: {
  currentWalletName: string;
  deviceState?: IOneKeyDeviceState;
  explicitName?: string;
  isThirdParty: boolean;
  passphraseState?: string;
}): string | undefined {
  const label = deviceState?.identity.label;
  if (
    deviceState?.protocol !== 'V2' ||
    isThirdParty ||
    passphraseState ||
    explicitName ||
    !label ||
    label === currentWalletName
  ) {
    return undefined;
  }
  return label;
}

export async function resolveDeviceStateForHwWalletCreate({
  existingState,
  preserveWalletSession,
  isThirdParty,
  isMocked,
  connectId,
  getDeviceState,
  onError,
}: {
  existingState?: IOneKeyDeviceState;
  preserveWalletSession?: boolean;
  isThirdParty: boolean;
  isMocked: boolean;
  connectId?: string;
  getDeviceState: IGetDeviceStateForHwWalletCreate;
  onError?: (error: unknown) => void;
}) {
  if (preserveWalletSession && existingState) {
    return existingState;
  }
  if (isThirdParty || isMocked || !connectId) {
    return existingState;
  }
  try {
    const state = await getDeviceState(connectId, { scope: 'runtime' });
    if (state.status.mode === 'normal' && !state.identity.deviceId) {
      throw new OneKeyLocalError(
        'Unable to resolve live hardware device identity',
      );
    }
    return state;
  } catch (error) {
    onError?.(error);
    throw error;
  }
}

export async function refreshDeviceStateAfterStandardWalletUnlock({
  existingState,
  connectProtocol,
  isThirdParty,
  isMocked,
  passphraseState,
  connectId,
  getDeviceState,
  onError,
}: {
  existingState?: IOneKeyDeviceState;
  connectProtocol?: 'V1' | 'V2';
  isThirdParty: boolean;
  isMocked: boolean;
  passphraseState?: string;
  connectId?: string;
  getDeviceState: IGetDeviceStateForHwWalletCreate;
  onError?: (error: unknown) => void;
}): Promise<IOneKeyDeviceState | undefined> {
  const protocol = connectProtocol ?? existingState?.protocol;
  if (
    protocol !== 'V2' ||
    isThirdParty ||
    isMocked ||
    Boolean(passphraseState) ||
    !connectId
  ) {
    return existingState;
  }

  try {
    return await getDeviceState(connectId, { scope: 'runtime' });
  } catch (error) {
    onError?.(error);
    return existingState;
  }
}
