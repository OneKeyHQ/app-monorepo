import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceResponse } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';

import localDb from '../dbs/local/localDb';

import type { IBackgroundApi } from '../apis/IBackgroundApi';

// Public, fixed diagnostics input; never use this output as a Cloud credential.
const TEST_PATH = "m/10016'/0'";
const TEST_VALUE = '000102030405060708090a0b0c0d0e0f';

export async function testHardwareCipherKeyValue(
  backgroundApi: IBackgroundApi,
  { connectId: selectedConnectId, key }: { connectId: string; key: string },
) {
  if (!selectedConnectId || !key.trim() || key.length > 512) {
    throw new OneKeyLocalError(
      'Select a device and enter 1–512 key characters.',
    );
  }
  const hardware = backgroundApi.serviceHardware;
  const dbDevice = await localDb.getDeviceByQuery({
    connectId: selectedConnectId,
  });
  return backgroundApi.serviceHardwareUI.withHardwareProcessing(
    async (lease) => {
      const assertActive = () => {
        if (lease?.signal?.aborted) {
          throw new OneKeyLocalError('CipherKeyValue test cancelled.');
        }
      };
      const connectId = await hardware.getCompatibleConnectId({
        connectId: selectedConnectId,
        hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
      });
      const features = await hardware.getFeaturesWithoutCache({ connectId });
      const sdk = await hardware.getSDKInstance({ connectId });
      assertActive();
      let sessionAcquired = false;
      try {
        const session = await convertDeviceResponse(() =>
          sdk.openWalletSession(connectId, {
            mode: 'standard',
            keepSession: true,
          }),
        );
        sessionAcquired = true;
        if (
          session.walletType !== 'standard' ||
          session.passphraseState ||
          !session.deviceId
        ) {
          throw new OneKeyLocalError('Use the standard wallet for this test.');
        }
        const durations: number[] = [];
        const call = async (value: string, encrypt: boolean) => {
          assertActive();
          const started = Date.now();
          const result = await convertDeviceResponse(() =>
            sdk.cipherKeyValue(connectId, session.deviceId, {
              path: TEST_PATH,
              key,
              value,
              encrypt,
              askOnEncrypt: true,
              askOnDecrypt: true,
              useEmptyPassphrase: true,
              keepSession: encrypt,
            }),
          );
          assertActive();
          durations.push(Date.now() - started);
          if (!/^[0-9a-f]{32}$/i.test(result.value)) {
            throw new OneKeyLocalError(
              'CipherKeyValue returned invalid test data.',
            );
          }
          return result.value.toLowerCase();
        };
        const first = await call(TEST_VALUE, true);
        const second = await call(TEST_VALUE, true);
        const decrypted = await call(first, false);
        const { firmwareVersion } = await deviceUtils.getDeviceVersion({
          device: undefined,
          features,
        });
        // Only verification results cross the background API boundary.
        return {
          deviceType: await deviceUtils.getDeviceTypeFromFeatures({ features }),
          firmwareVersion,
          path: TEST_PATH,
          deterministic: first === second,
          roundTrip: decrypted === TEST_VALUE,
          outputBytes: first.length / 2,
          encryptFirstMs: durations[0],
          encryptSecondMs: durations[1],
          decryptMs: durations[2],
        };
      } finally {
        // Setup failures must not re-enter BLE pairing without a session.
        // A fresh device may have no DB record for outer session cleanup.
        if (sessionAcquired) {
          await hardware.cancel({
            connectId,
            oneKeyOperationLease: lease,
            immediate: true,
          });
        }
      }
    },
    {
      deviceParams: dbDevice ? { dbDevice } : undefined,
      debugMethodName: 'CipherKeyValue dev test',
    },
  );
}

export type IHardwareCipherKeyValueTestResult = Awaited<
  ReturnType<typeof testHardwareCipherKeyValue>
>;
