import {
  DEFAULT_GAS_AMOUNT,
  DEFAULT_GAS_PRICE,
  ONE_ALPH,
  addressFromPublicKey,
  addressToBytes,
  codec,
} from '@alephium/web3';

import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { COINTYPE_ALPH } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IOneKeyError,
  IOneKeyHardwareErrorPayload,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

export type IAlphHardwareInputTestResult = {
  success: boolean;
  stage: 'prepare' | 'getAddress' | 'signTransaction';
  inputCount: number;
  rawTxBytes?: number;
  deviceType?: string;
  sdkError?: IOneKeyHardwareErrorPayload;
  appError?: Pick<
    IOneKeyError,
    'name' | 'className' | 'code' | 'message' | 'key'
  >;
};

export function buildAlphHardwareInputTestTx({
  publicKey,
  inputCount,
}: {
  publicKey: string;
  inputCount: number;
}): string {
  // This bounds only the synthetic test fixture, never production signing.
  if (!Number.isInteger(inputCount) || inputCount < 1 || inputCount > 256) {
    throw new OneKeyLocalError(
      'Test input count must be an integer from 1 to 256',
    );
  }
  if (!/^(02|03)[a-f\d]{64}$/iu.test(publicKey)) {
    throw new OneKeyLocalError('A compressed ALPH public key is required');
  }
  const output: codec.assetOutput.AssetOutput = {
    amount: ONE_ALPH,
    lockupScript: {
      kind: 'P2PKH',
      value: addressToBytes(addressFromPublicKey(publicKey)).slice(1),
    },
    lockTime: 0n,
    tokens: [],
    additionalData: new Uint8Array(),
  };
  const { hint } = codec.assetOutput.AssetOutputCodec.toFixedAssetOutput(
    new Uint8Array(32),
    output,
    0,
  );
  const inputs: codec.Input[] = Array.from(
    { length: inputCount },
    (_, index) => {
      // Distinct, fabricated output references require no funded account.
      const key = Buffer.alloc(32);
      key.write('OneKey ALPH input test');
      key.writeUInt32BE(index + 1, 28);
      return {
        hint,
        key,
        unlockScript: { kind: 'P2PKH', value: Buffer.from(publicKey, 'hex') },
      };
    },
  );
  return Buffer.from(
    codec.unsignedTxCodec.encode({
      version: 0,
      networkId: 0,
      statefulScript: { kind: 'None', value: undefined },
      gasAmount: DEFAULT_GAS_AMOUNT,
      gasPrice: DEFAULT_GAS_PRICE,
      inputs,
      fixedOutputs: [output],
    }),
  ).toString('hex');
}

export async function runAlphHardwareInputTest({
  backgroundApi,
  accountId,
  inputCount,
}: {
  backgroundApi: IBackgroundApi;
  accountId: string;
  inputCount: number;
}): Promise<IAlphHardwareInputTestResult> {
  const result: IAlphHardwareInputTestResult = {
    success: false,
    stage: 'prepare',
    inputCount,
  };
  try {
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    if (!accountUtils.isHwWallet({ walletId })) {
      throw new OneKeyLocalError('Select a OneKey hardware ALPH account first');
    }
    const account = await backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId: presetNetworksMap.alph.id,
    });
    if (!account.path.startsWith(`m/44'/${COINTYPE_ALPH}'/`)) {
      throw new OneKeyLocalError(
        'Select an ALPH account with its standard derivation path',
      );
    }
    const publicKey = checkIsDefined(account.pub);
    const rawTx = buildAlphHardwareInputTestTx({ publicKey, inputCount });
    result.rawTxBytes = rawTx.length / 2;
    const { deviceParams } =
      await backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId,
        reason: EReasonForNeedPassword.CreateTransaction,
      });
    const { dbDevice, deviceCommonParams } = checkIsDefined(deviceParams);
    if (
      (dbDevice.vendor ??
        dbDevice.settings?.vendor ??
        EHardwareVendor.onekey) !== EHardwareVendor.onekey
    ) {
      throw new OneKeyLocalError('This test requires a OneKey hardware wallet');
    }
    result.deviceType = dbDevice.deviceType;
    await backgroundApi.serviceHardwareUI.withHardwareProcessing(
      async () => {
        const { connectId, deviceId } = dbDevice;
        const sdk = await backgroundApi.serviceHardware.getSDKInstance({
          connectId,
        });
        result.stage = 'getAddress';
        const addressResponse = await sdk.alephiumGetAddress(
          connectId,
          deviceId,
          {
            ...deviceCommonParams,
            path: `${account.path}/0/0`,
            showOnOneKey: false,
            includePublicKey: true,
            group: 0,
          },
        );
        if (!addressResponse.success) {
          result.sdkError = addressResponse.payload;
          throw convertDeviceError(addressResponse.payload);
        }
        if (
          addressResponse.payload.publicKey?.toLowerCase() !==
          publicKey.toLowerCase()
        ) {
          throw new OneKeyLocalError(
            'The hardware public key does not match the selected account',
          );
        }
        result.stage = 'signTransaction';
        const response = await sdk.alephiumSignTransaction(
          connectId,
          deviceId,
          {
            ...deviceCommonParams,
            path: addressResponse.payload.derivedPath,
            rawTx,
          },
        );
        if (!response.success) {
          // Keep the SDK response before applying the normal App error mapping.
          result.sdkError = response.payload;
          throw convertDeviceError(response.payload);
        }
        if (!response.payload.signature) {
          throw new OneKeyLocalError('The hardware returned no signature');
        }
        // Discard the signature. This test never broadcasts or writes history.
        result.success = true;
      },
      { deviceParams, debugMethodName: 'dev.alphHardwareInputTest' },
    );
  } catch (error) {
    result.success = false;
    const { name, className, code, message, key } = error as IOneKeyError;
    result.appError = { name, className, code, message, key };
  }
  return result;
}
