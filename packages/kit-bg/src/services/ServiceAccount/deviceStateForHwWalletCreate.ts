import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

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
  getDeviceState: (
    connectId: string,
    params: { scope: 'settings' },
  ) => Promise<IOneKeyDeviceState>;
  onError?: (error: unknown) => void;
}) {
  if (preserveWalletSession && existingState) {
    return existingState;
  }
  if (isThirdParty || isMocked || !connectId) {
    return existingState;
  }
  try {
    const state = await getDeviceState(connectId, { scope: 'settings' });
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
