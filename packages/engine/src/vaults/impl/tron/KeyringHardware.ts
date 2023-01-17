/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import TronWeb from 'tronweb';

import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_TRON as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented, OneKeyHardwareError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type { DBSimpleAccount } from '../../../types/account';
import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type { IEncodedTxTron } from './types';
import type { TronTransactionContract } from '@onekeyfe/hd-core';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

export class KeyringHardware extends KeyringHardwareBase {
  override async signTransaction(
    unsignedTx: UnsignedTx,
    _options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const { encodedTx } = unsignedTx.payload as { encodedTx: IEncodedTxTron };
    const {
      ref_block_bytes: refBlockBytes,
      ref_block_hash: refBlockHash,
      expiration,
      timestamp,
      fee_limit: feeLimit,
    } = encodedTx.raw_data;

    let contractCall: TronTransactionContract | undefined;
    if (encodedTx.raw_data.contract[0].type === 'TransferContract') {
      const { amount, to_address: toAddressHex } =
        encodedTx.raw_data.contract[0].parameter.value;
      contractCall = {
        transferContract: {
          amount,
          toAddress: TronWeb.address.fromHex(toAddressHex),
        },
      };
    } else if (encodedTx.raw_data.contract[0].type === 'TriggerSmartContract') {
      const {
        contract_address: contractAddressHex,
        call_value: callValue,
        data,
      } = encodedTx.raw_data.contract[0].parameter.value;
      contractCall = {
        triggerSmartContract: {
          contractAddress: TronWeb.address.fromHex(contractAddressHex),
          data,
          callValue,
        },
      };
    }

    if (typeof contractCall === 'undefined') {
      throw new NotImplemented();
    }

    const dbAccount = await this.getDbAccount();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.tronSignTransaction(
      connectId,
      deviceId,
      {
        path: dbAccount.path,
        transaction: {
          refBlockBytes,
          refBlockHash,
          expiration,
          timestamp,
          feeLimit,
          contract: contractCall,
        },
        ...passphraseState,
      },
    );

    if (response.success && response.payload.signature) {
      const { signature, serialized_tx: serializedTx } = response.payload;
      return Promise.resolve({
        txid: encodedTx.txID,
        rawTx: JSON.stringify({
          ...encodedTx,
          raw_data_hex: serializedTx || encodedTx.raw_data_hex,
          signature: [signature],
        }),
      });
    }

    throw convertDeviceError(response.payload);
  }

  override signMessage(
    _messages: any[],
    _options: ISignCredentialOptions,
  ): any {
    throw new NotImplemented('Signing tron message is not supported yet.');
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.tronGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({ path, showOnOneKey })),
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

    return addressesResponse.payload
      .map(({ address, path }, index) => ({
        id: `${this.walletId}--${path}`,
        name: (names || [])[index] || `TRON #${indexes[index] + 1}`,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: '', // no public key info from hardware
        address: address ?? '',
      }))
      .filter(({ address }) => !!address);
  }

  override async getAddress(params: IGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.tronGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      ...passphraseState,
    });
    if (response.success && !!response.payload?.address) {
      return response.payload.address;
    }
    throw convertDeviceError(response.payload);
  }
}
