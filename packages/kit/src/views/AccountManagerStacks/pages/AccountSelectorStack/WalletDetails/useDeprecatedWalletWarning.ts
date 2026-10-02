import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useUiResource } from '@onekeyhq/kit/src/hooks/uiResource';
import { resolveUsableWalletWithDevice } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails/deviceStateManagement';
import { deprecatedWalletWarningResource } from '@onekeyhq/kit/src/utils/deprecatedWalletWarningResource';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

export type IReplacementWallet = Pick<IDBWallet, 'id' | 'name'>;

export function useDeprecatedWalletWarning(
  info:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined,
) {
  const device = info?.device;
  const deviceScope = stableStringify({
    id: device?.id,
    uuid: device?.uuid,
    serialNo:
      device?.deviceStateInfo?.identity.serialNo ||
      deviceUtils.getDeviceSerialNoFromFeatures(device?.featuresInfo),
    deviceId: device?.deviceId,
    connectId: device?.connectId,
    usbConnectId: device?.usbConnectId,
    bleConnectId: device?.bleConnectId,
  });
  const scopeKey = info?.wallet.deprecated
    ? swrKeys.deprecatedWalletWarning(info.wallet.id, deviceScope)
    : undefined;
  return useUiResource<IReplacementWallet | null>(
    deprecatedWalletWarningResource,
    scopeKey,
    async () => {
      if (!info) throw new OneKeyLocalError('Missing deprecated wallet');
      const source =
        await backgroundApiProxy.serviceAccountSelector.getFocusedWalletInfo({
          focusedWallet: info.wallet.id,
        });
      if (!source?.wallet.deprecated || !source.device)
        throw new OneKeyLocalError('Deprecated wallet no longer available');
      const wallets =
        await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
          filterHiddenWallet: true,
          filterQrWallet: true,
        });
      const usable = resolveUsableWalletWithDevice(
        source,
        Object.values(wallets),
      );
      if (!usable) throw new OneKeyLocalError('Unresolved deprecated wallet');
      return usable.wallet.id === info.wallet.id
        ? null
        : { id: usable.wallet.id, name: usable.wallet.name };
    },
  );
}
