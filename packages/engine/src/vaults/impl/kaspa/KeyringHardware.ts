import { Transaction } from '@kaspa/core-lib';
import { bytesToHex } from '@noble/hashes/utils';

import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { KeyringHardwareBase } from '@onekeyhq/engine/src/vaults/keyring/KeyringHardwareBase';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '@onekeyhq/engine/src/vaults/types';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  IMPL_KASPA as COIN_IMPL,
  COINTYPE_KASPA as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { SignType, publicKeyFromX } from './sdk';
import {
  SignatureType,
  SigningMethodType,
  toTransaction,
} from './sdk/transaction';

import type { KaspaSignTransactionParams } from '@onekeyfe/hd-core';

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
      addressesResponse = await HardwareSDK.kaspaGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({
            path,
            showOnOneKey,
            prefix: chainId,
            scheme: SignType.Schnorr,
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

    const ret: DBSimpleAccount[] = [];
    let index = 0;
    for (const addressInfo of addressesResponse.payload) {
      const { address, path } = addressInfo;
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: '',
        address,
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

    const response = await HardwareSDK.kaspaGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      prefix: chainId,
      scheme: SignType.Schnorr,
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

    const response = await HardwareSDK.kaspaGetAddress(connectId, deviceId, {
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => ({
        path,
        showOnOneKey: !!showOnOneKey,
        prefix: chainId,
        scheme: SignType.Schnorr,
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

  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const dbAccount = await this.getDbAccount();

    const chainId = await this.getNetworkChainId();

    const txn = toTransaction(unsignedTx.payload.encodedTx);

    const unSignTx: KaspaSignTransactionParams = {
      version: txn.version,
      inputs: txn.inputs.map((input) => ({
        path: dbAccount.path,
        prevTxId: input.prevTxId.toString('hex'),
        outputIndex: input.outputIndex,
        sequenceNumber: input.sequenceNumber.toString(),
        output: {
          satoshis: input?.output?.satoshis.toString() ?? '',
          script: bytesToHex(
            input?.output?.script?.toBuffer() ?? Buffer.alloc(0),
          ),
        },
        sigOpCount: input?.output?.script?.getSignatureOperationsCount() ?? 1,
      })),
      outputs: txn.outputs.map((output) => ({
        satoshis: output.satoshis.toString(),
        script: bytesToHex(output.script.toBuffer()),
        scriptVersion: 0,
      })),
      lockTime: txn.nLockTime.toString(),
      sigHashType: SignatureType.SIGHASH_ALL,
      sigOpCount: 1,
      scheme: SignType.Schnorr,
      prefix: chainId,
    };

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.kaspaSignTransaction(
      connectId,
      deviceId,
      {
        ...unSignTx,
        ...passphraseState,
      },
    );

    if (response.success) {
      const signatures = response.payload;

      for (const signature of signatures) {
        const input = txn.inputs[signature.index];
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const publicKeyBuf = input?.output?.script?.getPublicKey();
        const publicKey = publicKeyFromX(true, bytesToHex(publicKeyBuf));

        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        txn.inputs[signature.index].addSignature(
          txn,
          // @ts-expect-error
          new Transaction.Signature({
            publicKey,
            prevTxId: input.prevTxId,
            outputIndex: input.outputIndex,
            inputIndex: signature.index,
            signature: signature.signature,
            sigtype: SignatureType.SIGHASH_ALL,
          }),
          SigningMethodType.Schnorr,
        );
      }

      const rawTx = bytesToHex(txn.toBuffer());

      return {
        txid: '',
        rawTx,
      };
    }

    throw convertDeviceError(response.payload);
  }
}
