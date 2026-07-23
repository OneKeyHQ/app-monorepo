import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyDeviceState } from '@onekeyhq/shared/types/device';

export async function resolveDeviceStateForHwWalletCreate({
  existingState,
  isThirdParty,
  isMocked,
  connectId,
  getDeviceState,
  onError,
}: {
  existingState?: IOneKeyDeviceState;
  isThirdParty: boolean;
  isMocked: boolean;
  connectId?: string;
  getDeviceState: (connectId: string) => Promise<IOneKeyDeviceState>;
  onError?: (error: unknown) => void;
}) {
  if (isThirdParty || isMocked || !connectId) {
    return existingState;
  }
  try {
    const state = await getDeviceState(connectId);
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
