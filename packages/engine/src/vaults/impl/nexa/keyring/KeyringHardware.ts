import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type {
  DBSimpleAccount,
  DBVariantAccount,
} from '@onekeyhq/engine/src/types/account';
import type { UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { KeyringHardwareBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringHardwareBase';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  IMPL_NEXA as COIN_IMPL,
  COINTYPE_NEXA as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { type IEncodedTxNexa, NexaSignature } from '../types';
import {
  buildInputScriptBuffer,
  buildRawTx,
  buildSignatureBuffer,
  buildTxid,
  getNexaPrefix,
} from '../utils';

import type { INexaInputSignature } from '../types';

const SIGN_TYPE = 'Schnorr';

// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { indexes, names, template } = params;
    const { pathPrefix } = slicePathTemplate(template);
    const paths = indexes.map((index) => `${pathPrefix}/${index}`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const { prefix } = getAccountNameInfoByImpl(COIN_IMPL).default;
    const chainId = await this.getNetworkChainId();

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.nexaGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({
            path,
            showOnOneKey,
            prefix: getNexaPrefix(chainId),
            scheme: SIGN_TYPE,
          })),
          ...passphraseState,
        },
      );
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }
    if (!addressesResponse.success) {
      debugLogger.common.error(addressesResponse.payload);
      throw convertDeviceError(addressesResponse.payload);
    }

    const ret: DBVariantAccount[] = [];
    let index = 0;
    for (const addressInfo of addressesResponse.payload) {
      const { address, path, pub } = addressInfo;
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub,
        address: pub,
        addresses: { [this.networkId]: address },
        template,
      });
      index += 1;
    }
    return ret;
  }

  async getAddress(params: IHardwareGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const chainId = await this.getNetworkChainId();

    const response = await HardwareSDK.nexaGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      prefix: getNexaPrefix(chainId),
      scheme: SIGN_TYPE,
      ...passphraseState,
    });
    if (response.success && !!response.payload?.address) {
      return response.payload?.address;
    }
    throw convertDeviceError(response.payload);
  }

  override async batchGetAddress(
    params: IHardwareGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const chainId = await this.getNetworkChainId();

    const response = await HardwareSDK.nexaGetAddress(connectId, deviceId, {
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => ({
        path,
        showOnOneKey: !!showOnOneKey,
        prefix: getNexaPrefix(chainId),
        scheme: SIGN_TYPE,
      })),
    });

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    return response.payload.map((item) => ({
      path: item.path ?? '',
      address: item.address ?? '',
    }));
  }

  async signTransaction(unsignedTx: UnsignedTx): Promise<ISignedTxPro> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;

    const chainId = await this.getNetworkChainId();

    const { encodedTx } = unsignedTx.payload;
    const { inputSignatures, outputSignatures, signatureBuffer } =
      buildSignatureBuffer(encodedTx as IEncodedTxNexa, dbAccount);
    // const unSignTx = {
    //   version: 0,
    //   inputs: inputSignatures.map((input) => ({
    //     path: dbAccount.path,
    //     prevTxId: input.prevTxId,
    //     outputIndex: input.outputIndex,
    //     sequenceNumber: input.sequenceNumber,
    //     output: {
    //       satoshis: input.amount.toString(),
    //       script: bytesToHex(Buffer.alloc(0)),
    //     },
    //     sigOpCount: 1,
    //   })),
    //   outputs: outputSignatures.map((output) => ({
    //     satoshis: output.satoshi.toString(),
    //     script: bytesToHex(output.scriptBuffer),
    //     scriptVersion: 0,
    //   })),
    //   // packages/core/src/api/nexa/helpers/SignatureType.ts
    //   // SignatureType.SIGHASH_ALL
    //   sigHashType: 0x00,
    //   lockTime: 0,
    //   sigOpCount: 1,
    //   scheme: SIGN_TYPE,
    //   prefix: chainId,
    // };

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.nexaSignTransaction(
      connectId,
      deviceId,
      {
        ...passphraseState,
        inputPath: dbAccount.path,
        inputCount: inputSignatures.length,
        prefix: getNexaPrefix(chainId),
        message: signatureBuffer.toString('hex'),
      },
    );

    if (response.success) {
      console.log(
        'packages/engine/src/vaults/impl/nexa/keyring/KeyringHardware.ts',
        response,
      );
      const signature = Buffer.from(response.payload.message.signature, 'hex');
      const publicKey = Buffer.from(dbAccount.pub, 'hex');
      const inputSigs: INexaInputSignature[] = inputSignatures.map(
        (inputSig) => ({
          ...inputSig,
          publicKey,
          signature,
          scriptBuffer: buildInputScriptBuffer(publicKey, signature),
        }),
      );

      const txid = buildTxid(inputSigs, outputSignatures);
      const rawTx = buildRawTx(inputSigs, outputSignatures, 0, true);

      return {
        txid,
        rawTx: rawTx.toString('hex'),
        encodedTx,
      };
    }

    throw convertDeviceError(response.payload);
  }
}
