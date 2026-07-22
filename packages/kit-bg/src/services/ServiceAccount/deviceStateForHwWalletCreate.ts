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
  if (existingState || isThirdParty || isMocked || !connectId) {
    return existingState;
  }
  try {
    return await getDeviceState(connectId);
  } catch (error) {
    onError?.(error);
    return undefined;
  }
}
