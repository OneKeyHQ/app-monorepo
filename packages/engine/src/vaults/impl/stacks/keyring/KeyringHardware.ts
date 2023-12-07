import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { DBUTXOAccount } from '@onekeyhq/engine/src/types/account';
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

import { type IEncodedTxNexa } from '../types';
import {
  buildInputScriptBuffer,
  buildRawTx,
  buildSignatureBuffer,
  buildTxid,
  getNexaPrefix,
} from '../utils';

import type { INexaInputSignature } from '../types';
import type { NexaAddress, Success, Unsuccessful } from '@onekeyfe/hd-core';

const SIGN_TYPE = 'Schnorr';

// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBUTXOAccount>> {
    const { indexes, names, template } = params;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const paths = indexes.map(
      (index) =>
        // When the first digit is 0, it represents a receiving account,
        // and when it is 0, it indicates a change account.
        `${pathPrefix}/${pathSuffix.replace('{index}', index.toString())}`,
    );
    const idPaths = indexes.map((index) => `${pathPrefix}/${index}'`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const { prefix } = getAccountNameInfoByImpl(COIN_IMPL).default;
    const chainId = await this.getNetworkChainId();

    let addressesResponse: Unsuccessful | Success<NexaAddress[]>;
    try {
      addressesResponse = await HardwareSDK.nexaGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({
            path,
            showOnOneKey,
            prefix: getNexaPrefix(chainId),
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

    const ret: DBUTXOAccount[] = [];
    return addressesResponse.payload.map((addressInfo, index) => {
      const { path, pub } = addressInfo;
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      ret.push();
      return {
        id: `${this.walletId}--${idPaths[index]}`,
        name,
        type: AccountType.UTXO,
        path,
        coinType: COIN_TYPE,
        xpub: '',
        address: pub,
        addresses: { [this.networkId]: pub },
        template,
      };
    });
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
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    const chainId = await this.getNetworkChainId();

    const { encodedTx } = unsignedTx.payload;
    const { inputSignatures, outputSignatures, signatureBuffer } =
      buildSignatureBuffer(
        encodedTx as IEncodedTxNexa,
        await this.vault.getDisplayAddress(dbAccount.address),
      );
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.nexaSignTransaction(
      connectId,
      deviceId,
      {
        ...passphraseState,
        inputs: [
          {
            path: dbAccount.path,
            prefix: getNexaPrefix(chainId),
            message: signatureBuffer.toString('hex'),
          },
        ],
      },
    );

    if (response.success) {
      const nexaSignatures = response.payload;
      const publicKey = Buffer.from(dbAccount.address, 'hex');
      const defaultSignature = Buffer.from(nexaSignatures[0].signature, 'hex');
      const inputSigs: INexaInputSignature[] = inputSignatures.map(
        (inputSig) => ({
          ...inputSig,
          publicKey,
          signature: defaultSignature,
          scriptBuffer: buildInputScriptBuffer(publicKey, defaultSignature),
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
