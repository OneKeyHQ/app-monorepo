import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  HARDWARE_CLOUD_SYNC_DERIVATION_VERSION,
  HARDWARE_CLOUD_SYNC_PATH,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { HardwareCloudKeyPrerequisiteError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncErrors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EHardwareCallContext,
  EHardwareVendor,
} from '@onekeyhq/shared/types/device';
import type {
  IHardwareCloudSyncKeySource,
  IKeylessCloudSyncCredential,
} from '@onekeyhq/shared/types/keylessCloudSync';

import localDb from '../../dbs/local/localDb';

import {
  deriveHardwareCloudSyncCredential,
  normalizeHardwareCloudWalletXfp,
} from './hardwareCloudSyncCredential';

import type { IHardwareCloudKeyIdentity } from './hardwareCloudSyncCredential';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';

function unlockError() {
  return new OneKeyLocalError(
    'Hardware Cloud key could not be unlocked. Check the standard wallet and try again.',
  );
}

// There are no certified model/firmware pairs yet. This gate allows local
// hardware acceptance in development builds without claiming production support.
export async function generateHardwareCloudSyncCredentialWithSdk({
  backgroundApi,
  walletId,
  isCurrent,
}: {
  backgroundApi: IBackgroundApi;
  walletId: string;
  isCurrent: () => boolean;
}): Promise<{
  credential: IKeylessCloudSyncCredential;
  source: IHardwareCloudSyncKeySource;
}> {
  if (!platformEnv.isDev || !(platformEnv.isDesktop || platformEnv.isNative)) {
    throw new HardwareCloudKeyPrerequisiteError('compatibility');
  }
  try {
    const wallet = await localDb.getWallet({ walletId });
    if (
      !isCurrent() ||
      !accountUtils.isHwWallet({ walletId }) ||
      wallet.passphraseState ||
      !wallet.associatedDevice ||
      !wallet.xfp
    ) {
      throw unlockError();
    }
    const dbDevice = await localDb.getDevice(wallet.associatedDevice);
    if (
      !isCurrent() ||
      (dbDevice.vendor && dbDevice.vendor !== EHardwareVendor.onekey) ||
      !dbDevice.connectId ||
      !dbDevice.deviceId
    ) {
      throw unlockError();
    }
    const walletXfp = wallet.xfp;
    const canonicalXfp = normalizeHardwareCloudWalletXfp(walletXfp);
    const credentialId = `hardware-cloud-v1-${Buffer.from(
      appCrypto.hash.sha256Sync(Buffer.from(canonicalXfp, 'utf8')),
    ).toString('hex')}`;
    const source: IHardwareCloudSyncKeySource = {
      type: 'hardware',
      walletId,
      walletXfp,
      credentialId,
      derivationVersion: HARDWARE_CLOUD_SYNC_DERIVATION_VERSION,
    };
    return await backgroundApi.serviceHardwareUI.runExclusiveOneKeyOperation(
      async (lease) => {
        const assertCurrent = () => {
          if (!isCurrent() || lease.signal?.aborted) {
            throw unlockError();
          }
        };
        const call = async <T>(operation: () => Promise<T>): Promise<T> => {
          assertCurrent();
          const result = await operation();
          assertCurrent();
          return result;
        };
        return backgroundApi.serviceHardware.runWithSensitiveCloudKeyOperation(
          async () => {
            const hardware = backgroundApi.serviceHardware;
            const { deviceId } = dbDevice;
            const connectId = await call(() =>
              hardware.getCompatibleConnectId({
                connectId: dbDevice.connectId,
                featuresDeviceId: deviceId,
                hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
              }),
            );
            if (!connectId) throw unlockError();
            const sdk = await call(() =>
              hardware.getSDKInstance({ connectId }),
            );
            let standardSelected = false;
            let standard:
              | Pick<IHardwareCloudKeyIdentity, 'publicKey' | 'address'>
              | undefined;
            const getIdentity =
              async (): Promise<IHardwareCloudKeyIdentity> => {
                const currentWallet = await call(() =>
                  localDb.getWallet({ walletId }),
                );
                if (
                  currentWallet.associatedDevice !== dbDevice.id ||
                  currentWallet.passphraseState ||
                  !currentWallet.xfp ||
                  normalizeHardwareCloudWalletXfp(currentWallet.xfp) !==
                    canonicalXfp
                ) {
                  throw unlockError();
                }
                const state = await call(() =>
                  hardware.getDeviceState({
                    connectId,
                    params: { scope: 'runtime' },
                    silentMode: true,
                  }),
                );
                if (
                  state.identity.deviceId !== deviceId ||
                  state.status.unlocked !== true ||
                  state.status.unlockedAttachPin !== false ||
                  !standardSelected
                ) {
                  throw unlockError();
                }
                const currentXfp = await call(() =>
                  hardware.buildHwWalletXfp({
                    connectId,
                    deviceId,
                    passphraseState: undefined,
                    throwError: true,
                    withUserInteraction: true,
                  }),
                );
                if (
                  !currentXfp ||
                  normalizeHardwareCloudWalletXfp(currentXfp) !== canonicalXfp
                ) {
                  throw unlockError();
                }
                if (!standard) {
                  const pub = await call(() =>
                    sdk.btcGetPublicKey(connectId, deviceId, {
                      path: HARDWARE_CLOUD_SYNC_PATH,
                      coin: 'Bitcoin',
                      showOnOneKey: false,
                      useEmptyPassphrase: true,
                    }),
                  );
                  if (!pub.success) throw unlockError();
                  const addr = await call(() =>
                    sdk.btcGetAddress(connectId, deviceId, {
                      path: HARDWARE_CLOUD_SYNC_PATH,
                      coin: 'Bitcoin',
                      showOnOneKey: false,
                      useEmptyPassphrase: true,
                    }),
                  );
                  if (!addr.success) throw unlockError();
                  standard = {
                    publicKey: pub.payload.node.public_key,
                    address: addr.payload.address,
                  };
                }
                return {
                  connectId,
                  deviceId,
                  walletXfp: currentXfp,
                  ...standard,
                  walletType: 'standard',
                  passphraseState: undefined,
                  unlockedAttachPin: false,
                  connected: true,
                };
              };
            const credential = await deriveHardwareCloudSyncCredential({
              credentialId,
              expectedIdentity: { connectId, deviceId, walletXfp },
              isCurrent: () => isCurrent() && !lease.signal?.aborted,
              adapter: {
                async openStandardWallet() {
                  const session = await call(() =>
                    sdk.openWalletSession(connectId, { mode: 'standard' }),
                  );
                  if (
                    !session.success ||
                    session.payload.walletType !== 'standard' ||
                    session.payload.deviceId !== deviceId ||
                    session.payload.passphraseState
                  ) {
                    throw unlockError();
                  }
                  standardSelected = true;
                  return getIdentity();
                },
                getIdentity,
                async signMessage(params) {
                  const response = await call(() =>
                    sdk.btcSignMessage(connectId, deviceId, params),
                  );
                  if (!response.success) throw unlockError();
                  return response.payload;
                },
              },
            });
            assertCurrent();
            return { credential: { ...credential, source }, source };
          },
        );
      },
      { deviceKey: dbDevice.id },
    );
  } catch (error) {
    if (error instanceof HardwareCloudKeyPrerequisiteError) {
      throw error;
    }
    throw unlockError();
  }
}
