import { HARDWARE_PATH_TEST_MESSAGE } from '@onekeyhq/shared/src/consts/hardwareDerivationPathTest';
import type { IHardwarePathTestRequest } from '@onekeyhq/shared/src/consts/hardwareDerivationPathTest';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  DeviceNotFound,
  UserCancelFromOutside,
} from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { assertNoHardwareCloudSyncSigningRequest } from '@onekeyhq/shared/src/utils/hardwareCloudSyncGuards';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import {
  callHardwareCloudSyncDevice,
  sanitizeHardwareCloudSyncDeviceError,
} from '../ServiceKeylessCloudSync/hardwareCloudSyncLog';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export async function runHardwareDerivationPathTest({
  backgroundApi,
  request,
  onCancelChange,
}: {
  backgroundApi: IBackgroundApi;
  request: IHardwarePathTestRequest;
  onCancelChange: (cancel: (() => void) | undefined) => void;
}) {
  const { path, method, signType } = request;
  // Only validate BIP32 encoding here: out-of-policy paths must reach firmware.
  const parts = path.split('/');
  if (
    !request.connectId ||
    parts.shift() !== 'm' ||
    !parts.length ||
    parts.length > 10 ||
    !parts.every(
      (part) =>
        /^\d+'?$/.test(part) && Number.parseInt(part, 10) <= 0x7f_ff_ff_ff,
    ) ||
    !['btcGetPublicKey', 'btcGetAddress', 'btcSignMessage'].includes(method) ||
    !['default', 'ecdsa', 'bip322-simple'].includes(signType)
  ) {
    throw new OneKeyLocalError({ key: ETranslations.dev_hw_path_input__msg });
  }
  const hardware = backgroundApi.serviceHardware;
  const ui = backgroundApi.serviceHardwareUI;
  const result = await ui.tryRunExclusiveOneKeyOperation(
    async (lease) => {
      let connectId = request.connectId;
      const assertCurrent = () => {
        if (lease.signal?.aborted) throw new UserCancelFromOutside();
      };
      onCancelChange(() => {
        ui.hardwareProcessingManager.cancelOneKeyOperation(lease);
        void hardware.cancel({
          connectId,
          oneKeyOperationLease: lease,
          immediate: true,
        });
      });
      try {
        assertCurrent();
        connectId = await hardware.getCompatibleConnectId({
          connectId,
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        });
        assertCurrent();
        if (!connectId) throw new DeviceNotFound();
        const sdk = await hardware.getSDKInstance({ connectId });
        const session = await callHardwareCloudSyncDevice(
          () => sdk.openWalletSession(connectId, { mode: 'standard' }),
          connectId,
        );
        assertCurrent();
        if (
          session.walletType !== 'standard' ||
          !session.deviceId ||
          session.passphraseState
        ) {
          throw new OneKeyLocalError({
            key: ETranslations.dev_hw_path_standard__msg,
          });
        }
        const state = await callHardwareCloudSyncDevice(
          () => sdk.getDeviceState(connectId, { scope: 'runtime' }),
          connectId,
        );
        assertCurrent();
        const device = {
          type: state.identity.deviceType,
          firmwareType: state.identity.firmwareType,
          firmware: state.versions.firmware,
          protocol: state.protocol,
        };
        const params = {
          path,
          coin: 'Bitcoin',
          useEmptyPassphrase: true,
        } as const;
        let detail: { signatureBytes: number } | { received: string };
        switch (method) {
          case 'btcGetPublicKey':
            await callHardwareCloudSyncDevice(
              () =>
                sdk.btcGetPublicKey(connectId, session.deviceId, {
                  ...params,
                  showOnOneKey: false,
                }),
              connectId,
            );
            detail = { received: 'public key' };
            break;
          case 'btcGetAddress':
            await callHardwareCloudSyncDevice(
              () =>
                sdk.btcGetAddress(connectId, session.deviceId, {
                  ...params,
                  showOnOneKey: false,
                }),
              connectId,
            );
            detail = { received: 'address' };
            break;
          case 'btcSignMessage': {
            const messageHex = Buffer.from(
              HARDWARE_PATH_TEST_MESSAGE,
              'utf8',
            ).toString('hex');
            assertNoHardwareCloudSyncSigningRequest(messageHex, 'hex');
            const signed = await callHardwareCloudSyncDevice(
              () =>
                sdk.btcSignMessage(connectId, session.deviceId, {
                  ...params,
                  messageHex,
                  ...(signType === 'default' ? {} : { dAppSignType: signType }),
                }),
              connectId,
            );
            detail = { signatureBytes: signed.signature.length / 2 };
            break;
          }
          default:
            throw new OneKeyLocalError({
              key: ETranslations.dev_hw_path_input__msg,
            });
        }
        assertCurrent();
        return { device, method, path, signType, success: true, ...detail };
      } catch (error) {
        throw sanitizeHardwareCloudSyncDeviceError(error, connectId);
      } finally {
        onCancelChange(undefined);
      }
    },
    { deviceKey: request.connectId },
  );
  if (!result.acquired)
    throw new OneKeyLocalError({
      key: ETranslations.feedback_hardware_is_busy,
    });
  return result.result;
}
