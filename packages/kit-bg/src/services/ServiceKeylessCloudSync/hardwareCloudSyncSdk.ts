import appCrypto from '@onekeyhq/shared/src/appCrypto';
import {
  HARDWARE_CLOUD_SYNC_AUTH_PATH,
  HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX,
  HARDWARE_CLOUD_SYNC_DERIVATION_VERSION,
  HARDWARE_CLOUD_SYNC_PATH,
  assertHardwareCloudSyncAuthContext,
  getHardwareCloudSyncIdentityTagFromCredentialId,
  isHardwareCloudSyncPlatformSupported,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isOneKeyHardwareError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  HardwareCloudSyncCancelledError,
  HardwareCloudSyncLocalError,
  HardwareCloudSyncUnlockError,
} from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { HardwareCloudKeyPrerequisiteError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncErrors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getDeviceAvatarImage } from '@onekeyhq/shared/src/utils/avatarUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
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
  convertHardwareCloudSyncDeviceError,
  createHardwareCloudSyncDataError,
  logHardwareCloudSyncFailure,
  sanitizeHardwareCloudSyncDeviceError,
} from './hardwareCloudSyncLog';

import type {
  IHardwareCloudKeyAdapter,
  IHardwareCloudKeyIdentity,
  IHardwareCloudKeyUnlock,
} from './hardwareCloudSyncCredential';
import type { IHardwareCloudSyncDiagnosticContext } from './hardwareCloudSyncLog';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { Success, Unsuccessful } from '@onekeyfe/hd-core';

function unlockError() {
  return new HardwareCloudSyncUnlockError();
}

function hiddenWalletError() {
  const error = new HardwareCloudSyncLocalError(
    ETranslations.cloud_sync_hardware_hidden_wallet__msg,
    "Hidden wallets can't sync. Unlock with the standard wallet PIN.",
  );
  // The Cloud page owns this refusal and shows it after the waiting dialog
  // closes, rather than relying on a toast behind that dialog.
  error.autoToast = false;
  return error;
}

function assertSdkSuccess<T>(
  response: Success<T> | Unsuccessful,
  connectId: string,
): asserts response is Success<T> {
  if (!response.success) {
    throw convertHardwareCloudSyncDeviceError(response.payload, connectId);
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
      let stage = 'Open device operation';
      let diagnostics: IHardwareCloudSyncDiagnosticContext = {};
      let validationFailure: string | undefined;
      let stageOpened = false;
      let hardwareFailure: IOneKeyError | undefined;
      const failWalletCheck = (reason: string) => {
        validationFailure = reason;
        return unlockError();
      };
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
        // Direct SDK calls must share the same error owner as wrapped
        // hardware calls, including failures before runtime state is read.
        await backgroundApi.serviceHardwareUI.deviceStageJoinBurst({
          connectId: selectedConnectId,
        });
        stageOpened = true;
        const assertCurrent = () => {
          if (!isCurrent() || lease.signal?.aborted) {
            throw new HardwareCloudSyncCancelledError();
          }
        };
        let activeConnectId = selectedConnectId;
        const call = async <T>(
          deviceStage: string,
          operation: () => Promise<T>,
        ): Promise<T> => {
          stage = deviceStage;
          assertCurrent();
          let result: T;
          try {
            result = await operation();
          } catch (error) {
            throw sanitizeHardwareCloudSyncDeviceError(error, activeConnectId);
          }
          assertCurrent();
          return result;
        };
        return await backgroundApi.serviceHardware.runWithSensitiveCloudKeyOperation(
          async () => {
            const hardware = backgroundApi.serviceHardware;
            const connectId = await call('getCompatibleConnectId', () =>
              hardware.getCompatibleConnectId({
                connectId: selectedConnectId,
                hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
              }),
            );
            if (!connectId) {
              throw failWalletCheck('Compatible connection ID unavailable');
            }
            activeConnectId = connectId;
            const sdk = await call('getSDKInstance', () =>
              hardware.getSDKInstance({ connectId }),
            );
            const session = await call('openWalletSession', () =>
              sdk.openWalletSession(connectId, { mode: 'standard' }),
            );
            assertSdkSuccess(session, connectId);
            diagnostics = {
              walletType: session.payload.walletType,
              hasPassphraseState: !!session.payload.passphraseState,
              hasDeviceId: !!session.payload.deviceId,
            };
            if (
              session.payload.walletType === 'hidden' ||
              session.payload.passphraseState
            ) {
              validationFailure =
                'Hidden wallet session returned instead of standard wallet';
              throw hiddenWalletError();
            }
            if (
              session.payload.walletType !== 'standard' ||
              session.payload.passphraseState ||
              !session.payload.deviceId
            ) {
              throw failWalletCheck('Standard wallet session invalid');
            }
            const { deviceId } = session.payload;
            const readStandardWallet = async () => {
              const state = await call('getDeviceState', () =>
                hardware.getDeviceState({
                  connectId,
                  params: { scope: 'runtime' },
                  silentMode: true,
                }),
              );
              diagnostics = {
                ...diagnostics,
                deviceType: state.identity.deviceType,
                firmwareVersion: state.versions?.firmware,
                protocol: state.protocol,
                unlocked: state.status.unlocked,
                passphraseProtection: state.status.passphraseProtection,
                attachToPinEnabled: state.status.attachToPinEnabled,
                unlockedAttachPin: state.status.unlockedAttachPin,
                deviceIdMatches: state.identity.deviceId === deviceId,
              };
              // Legacy firmware omits attach-PIN state. The explicit standard
              // session, matching device ID and unlocked state still gate access.
              if (
                state.identity.deviceId !== deviceId ||
                state.status.unlocked !== true ||
                (state.status.unlockedAttachPin ?? false) !== false
              ) {
                if (state.status.unlockedAttachPin === true) {
                  validationFailure = 'Hidden wallet unlocked with attach PIN';
                  throw hiddenWalletError();
                }
                throw failWalletCheck('Standard wallet runtime state invalid');
              }
              const walletXfp = await call('buildHwWalletXfp', () =>
                hardware.buildHwWalletXfp({
                  connectId,
                  deviceId,
                  passphraseState: undefined,
                  throwError: true,
                  withUserInteraction: true,
                }),
              );
              if (!walletXfp) {
                throw failWalletCheck(
                  'Standard wallet fingerprint unavailable',
                );
              }
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
              stage = 'Check sync wallet identity';
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
                  throw failWalletCheck('Standard wallet fingerprint changed');
                }
                if (!standard) {
                  const pub = await call('btcGetPublicKey', () =>
                    sdk.btcGetPublicKey(connectId, deviceId, {
                      path: HARDWARE_CLOUD_SYNC_PATH,
                      coin: 'Bitcoin',
                      showOnOneKey: false,
                      useEmptyPassphrase: true,
                    }),
                  );
                  assertSdkSuccess(pub, connectId);
                  const addr = await call('btcGetAddress', () =>
                    sdk.btcGetAddress(connectId, deviceId, {
                      path: HARDWARE_CLOUD_SYNC_PATH,
                      coin: 'Bitcoin',
                      showOnOneKey: false,
                      useEmptyPassphrase: true,
                    }),
                  );
                  assertSdkSuccess(addr, connectId);
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
                const response = await call('btcSignMessage.key', () =>
                  sdk.btcSignMessage(connectId, deviceId, params),
                );
                assertSdkSuccess(response, connectId);
                stage = 'Verify Cloud key signature';
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
            stage = 'Unlock Cloud data';
            const unlocked = await unlock({
              credentialId,
              source,
              signAuth: async (message, expectedContext) => {
                const identityTag =
                  getHardwareCloudSyncIdentityTagFromCredentialId(credentialId);
                if (expectedContext.identityTag !== identityTag) {
                  throw unlockError();
                }
                const expected = Object.freeze({ ...expectedContext });
                const assertChallengeCurrent = () => {
                  try {
                    assertHardwareCloudSyncAuthContext(
                      message,
                      expected,
                      systemTimeUtils.getEstimatedServerTime() ?? Date.now(),
                    );
                  } catch {
                    throw createHardwareCloudSyncDataError(
                      'Invalid Cloud sync sign-in challenge: local context or expiry mismatch',
                    );
                  }
                };
                const assertWalletUnchanged = async () => {
                  const { walletXfp } = await readStandardWallet();
                  if (
                    normalizeHardwareCloudWalletXfp(walletXfp) !== canonicalXfp
                  ) {
                    throw unlockError();
                  }
                };
                assertChallengeCurrent();
                await assertWalletUnchanged();
                assertChallengeCurrent();
                onDeviceSign?.();
                const response = await call('btcSignMessage.auth', () =>
                  sdk.btcSignMessage(connectId, deviceId, {
                    path: HARDWARE_CLOUD_SYNC_AUTH_PATH,
                    messageHex: Buffer.from(message, 'utf8').toString('hex'),
                    coin: 'Bitcoin',
                    useEmptyPassphrase: true,
                  }),
                );
                assertSdkSuccess(response, connectId);
                await assertWalletUnchanged();
                assertChallengeCurrent();
                stage = 'Cloud sign-in';
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
      } catch (error) {
        if (isOneKeyHardwareError(error)) {
          hardwareFailure = error;
        }
        logHardwareCloudSyncFailure(
          stage,
          validationFailure ??
            (typeof error === 'string' ? { name: 'Error' } : error),
          diagnostics,
        );
        throw error;
      } finally {
        onDeviceCancelChange?.(undefined);
        if (stageOpened) {
          try {
            await backgroundApi.serviceHardwareUI.deviceStageLeaveBurst({
              error: hardwareFailure
                ? toPlainErrorObject(hardwareFailure)
                : undefined,
            });
            // DeviceStage owns hardware feedback; preserve the original
            // class, code, translation and recovery payload across RPC.
            if (hardwareFailure) hardwareFailure.autoToast = false;
          } catch (stageError) {
            // Presentation failure must neither replace nor silence the
            // original hardware error. The service toast is the fallback.
            if (hardwareFailure) hardwareFailure.autoToast = true;
            logHardwareCloudSyncFailure('DeviceStage exit failed', stageError);
          }
        }
      }
    },
    { deviceKey: selectedConnectId },
  );
}
