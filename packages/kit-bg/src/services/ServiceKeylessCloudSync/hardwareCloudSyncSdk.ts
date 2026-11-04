import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  HARDWARE_CLOUD_SYNC_AUTH_PATH,
  HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX,
  HARDWARE_CLOUD_SYNC_DERIVATION_VERSION,
  HARDWARE_CLOUD_SYNC_PATH,
  isHardwareCloudSyncPlatformSupported,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  HardwareCloudSyncCancelledError,
  HardwareCloudSyncUnlockError,
} from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { HardwareCloudKeyPrerequisiteError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncErrors';
import { getDeviceAvatarImage } from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';
import type {
  IHardwareCloudSyncKeySource,
  IKeylessCloudSyncCredential,
} from '@onekeyhq/shared/types/keylessCloudSync';

import {
  deriveHardwareCloudSyncKek,
  normalizeHardwareCloudWalletXfp,
} from './hardwareCloudSyncCredential';
import {
  assertHardwareCloudSyncAuthTemplate,
  sanitizeHardwareCloudSyncDeviceError,
} from './hardwareCloudSyncLog';

import type {
  IHardwareCloudKeyAdapter,
  IHardwareCloudKeyIdentity,
  IHardwareCloudKeyUnlock,
} from './hardwareCloudSyncCredential';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { Success, Unsuccessful } from '@onekeyfe/hd-core';

function unlockError() {
  return new HardwareCloudSyncUnlockError();
}

function assertSdkSuccess<T>(
  response: Success<T> | Unsuccessful,
): asserts response is Success<T> {
  if (!response.success) {
    throw sanitizeHardwareCloudSyncDeviceError(
      convertDeviceError(response.payload),
    );
  }
}

// The device, not a wallet record in the App, defines the standard wallet:
// its identity is read live and only its hash is kept.
export async function generateHardwareCloudSyncCredentialWithSdk({
  backgroundApi,
  connectId: selectedConnectId,
  expectedCredentialId,
  isCurrent,
  onDeviceCancelChange,
  onDeviceSign,
  unlock,
}: {
  backgroundApi: IBackgroundApi;
  // From the device the user picked on the Cloud sync page.
  connectId: string;
  // Set when the selected key already encrypts records; another recovery
  // phrase is rejected before the device is asked to sign.
  expectedCredentialId?: string;
  isCurrent: () => boolean;
  // Receives a canceller once the hardware lease is held, then undefined.
  onDeviceCancelChange?: (cancel: (() => void) | undefined) => void;
  // Called right before each signature the user confirms on the device.
  onDeviceSign?: () => void;
  // Runs while the device session is open: sign in, read the envelope, then
  // derive its KEK.
  unlock: IHardwareCloudKeyUnlock;
}): Promise<{
  credential: IKeylessCloudSyncCredential;
  source: IHardwareCloudSyncKeySource;
}> {
  if (!isHardwareCloudSyncPlatformSupported()) {
    throw new HardwareCloudKeyPrerequisiteError('compatibility');
  }
  if (!isCurrent()) {
    throw new HardwareCloudSyncCancelledError();
  }
  if (!selectedConnectId) throw unlockError();
  return await backgroundApi.serviceHardwareUI.runExclusiveOneKeyOperation(
    async (lease) => {
      // Same path as closing a device prompt: abort the lease and cancel the
      // in-flight SDK request so the device and the hardware lock are freed.
      onDeviceCancelChange?.(() => {
        backgroundApi.serviceHardwareUI.hardwareProcessingManager.cancelOneKeyOperation(
          lease,
        );
        void backgroundApi.serviceHardware.cancel({
          connectId: selectedConnectId,
          oneKeyOperationLease: lease,
          immediate: true,
        });
      });
      try {
        const assertCurrent = () => {
          if (!isCurrent() || lease.signal?.aborted) {
            throw new HardwareCloudSyncCancelledError();
          }
        };
        const call = async <T>(operation: () => Promise<T>): Promise<T> => {
          assertCurrent();
          let result: T;
          try {
            result = await operation();
          } catch (error) {
            throw sanitizeHardwareCloudSyncDeviceError(error);
          }
          assertCurrent();
          return result;
        };
        return await backgroundApi.serviceHardware.runWithSensitiveCloudKeyOperation(
          async () => {
            const hardware = backgroundApi.serviceHardware;
            const connectId = await call(() =>
              hardware.getCompatibleConnectId({
                connectId: selectedConnectId,
                hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
              }),
            );
            if (!connectId) throw unlockError();
            const sdk = await call(() =>
              hardware.getSDKInstance({ connectId }),
            );
            const session = await call(() =>
              sdk.openWalletSession(connectId, { mode: 'standard' }),
            );
            assertSdkSuccess(session);
            if (
              session.payload.walletType !== 'standard' ||
              session.payload.passphraseState ||
              !session.payload.deviceId
            ) {
              throw unlockError();
            }
            const { deviceId } = session.payload;
            const readStandardWallet = async () => {
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
                state.status.unlockedAttachPin !== false
              ) {
                throw unlockError();
              }
              const walletXfp = await call(() =>
                hardware.buildHwWalletXfp({
                  connectId,
                  deviceId,
                  passphraseState: undefined,
                  throwError: true,
                  withUserInteraction: true,
                }),
              );
              if (!walletXfp) throw unlockError();
              return { state, walletXfp };
            };

            const opened = await readStandardWallet();
            const canonicalXfp = normalizeHardwareCloudWalletXfp(
              opened.walletXfp,
            );
            const credentialId = `${HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX}${Buffer.from(
              appCrypto.hash.sha256Sync(Buffer.from(canonicalXfp, 'utf8')),
            ).toString('hex')}`;
            if (expectedCredentialId && credentialId !== expectedCredentialId) {
              throw new HardwareCloudKeyPrerequisiteError('walletMismatch', {
                targetCredentialId: credentialId,
              });
            }

            let standard:
              | Pick<IHardwareCloudKeyIdentity, 'publicKey' | 'address'>
              | undefined;
            const getIdentity =
              async (): Promise<IHardwareCloudKeyIdentity> => {
                const { walletXfp } = await readStandardWallet();
                if (
                  normalizeHardwareCloudWalletXfp(walletXfp) !== canonicalXfp
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
                  assertSdkSuccess(pub);
                  const addr = await call(() =>
                    sdk.btcGetAddress(connectId, deviceId, {
                      path: HARDWARE_CLOUD_SYNC_PATH,
                      coin: 'Bitcoin',
                      showOnOneKey: false,
                      useEmptyPassphrase: true,
                    }),
                  );
                  assertSdkSuccess(addr);
                  standard = {
                    publicKey: pub.payload.node.public_key,
                    address: addr.payload.address,
                  };
                }
                return {
                  connectId,
                  deviceId,
                  walletXfp,
                  ...standard,
                  walletType: 'standard',
                  passphraseState: undefined,
                  unlockedAttachPin: false,
                  connected: true,
                };
              };
            const expectedIdentity = {
              connectId,
              deviceId,
              walletXfp: opened.walletXfp,
            };
            const adapter = {
              // The standard session is already open; re-read it live.
              openStandardWallet: getIdentity,
              getIdentity,
              async signMessage(
                params: Parameters<IHardwareCloudKeyAdapter['signMessage']>[0],
              ) {
                onDeviceSign?.();
                const response = await call(() =>
                  sdk.btcSignMessage(connectId, deviceId, params),
                );
                assertSdkSuccess(response);
                return response.payload;
              },
            };
            const source: IHardwareCloudSyncKeySource = {
              type: 'hardware',
              credentialId,
              derivationVersion: HARDWARE_CLOUD_SYNC_DERIVATION_VERSION,
              deviceName: deviceUtils.getDeviceDisplayName({
                state: opened.state,
              }),
              deviceType: opened.state.identity.deviceType,
              // The image only; the serial number is not kept.
              deviceAvatar: getDeviceAvatarImage(
                opened.state.identity.deviceType,
                opened.state.identity.serialNo,
              ),
            };
            const unlocked = await unlock({
              credentialId,
              source,
              signAuth: async (message) => {
                assertHardwareCloudSyncAuthTemplate(message);
                onDeviceSign?.();
                const response = await call(() =>
                  sdk.btcSignMessage(connectId, deviceId, {
                    path: HARDWARE_CLOUD_SYNC_AUTH_PATH,
                    messageHex: Buffer.from(message, 'utf8').toString('hex'),
                    coin: 'Bitcoin',
                    useEmptyPassphrase: true,
                  }),
                );
                assertSdkSuccess(response);
                return Buffer.from(response.payload.signature, 'hex').toString(
                  'base64',
                );
              },
              deriveKek: (kekSalt) =>
                deriveHardwareCloudSyncKek({
                  credentialId,
                  expectedIdentity,
                  isCurrent: () => isCurrent() && !lease.signal?.aborted,
                  adapter,
                  kekSalt,
                }),
            });
            assertCurrent();
            return { credential: { ...unlocked, source }, source };
          },
        );
      } finally {
        onDeviceCancelChange?.(undefined);
      }
    },
    { deviceKey: selectedConnectId },
  );
}
