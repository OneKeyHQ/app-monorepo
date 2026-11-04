import { HARDWARE_PATH_TEST_MESSAGE } from '@onekeyhq/shared/src/consts/hardwareDerivationPathTest';
import type { IHardwarePathTestRequest } from '@onekeyhq/shared/src/consts/hardwareDerivationPathTest';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { UserCancelFromOutside } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { assertNoHardwareCloudSyncSigningRequest } from '@onekeyhq/shared/src/utils/hardwareCloudSyncGuards';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

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
        /^\d+'?$/.test(part) && Number(part.replace("'", '')) <= 0x7f_ff_ff_ff,
    ) ||
    !['btcGetPublicKey', 'btcGetAddress', 'btcSignMessage'].includes(method) ||
    !['default', 'ecdsa', 'bip322-simple'].includes(signType)
  ) {
    throw new OneKeyLocalError('Select a device and enter a valid BIP32 path.');
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
        if (!connectId) throw new OneKeyLocalError('Device not found.');
        const sdk = await hardware.getSDKInstance({ connectId });
        const session = await convertDeviceResponse(() =>
          sdk.openWalletSession(connectId, { mode: 'standard' }),
        );
        assertCurrent();
        if (
          session.walletType !== 'standard' ||
          !session.deviceId ||
          session.passphraseState
        ) {
          throw new OneKeyLocalError('A standard wallet session is required.');
        }
        const state = await hardware.getDeviceState({
          connectId,
          params: { scope: 'runtime' },
        });
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
            await convertDeviceResponse(() =>
              sdk.btcGetPublicKey(connectId, session.deviceId, {
                ...params,
                showOnOneKey: false,
              }),
            );
            detail = { received: 'public key' };
            break;
          case 'btcGetAddress':
            await convertDeviceResponse(() =>
              sdk.btcGetAddress(connectId, session.deviceId, {
                ...params,
                showOnOneKey: false,
              }),
            );
            detail = { received: 'address' };
            break;
          case 'btcSignMessage': {
            const messageHex = Buffer.from(
              HARDWARE_PATH_TEST_MESSAGE,
              'utf8',
            ).toString('hex');
            assertNoHardwareCloudSyncSigningRequest(messageHex, 'hex');
            const signed = await convertDeviceResponse(() =>
              sdk.btcSignMessage(connectId, session.deviceId, {
                ...params,
                messageHex,
                ...(signType === 'default' ? {} : { dAppSignType: signType }),
              }),
            );
            detail = { signatureBytes: signed.signature.length / 2 };
            break;
          }
          default:
            throw new OneKeyLocalError('Unsupported test method.');
        }
        assertCurrent();
        return { device, method, path, signType, success: true, ...detail };
      } finally {
        onCancelChange(undefined);
      }
    },
    { deviceKey: request.connectId },
  );
  if (!result.acquired)
    throw new OneKeyLocalError(
      'Hardware is busy. Try again after the current operation.',
    );
  return result.result;
}
