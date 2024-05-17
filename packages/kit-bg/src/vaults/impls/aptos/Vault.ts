/* eslint-disable @typescript-eslint/no-unused-vars */
import { BCS, TxnBuilderTypes } from 'aptos';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { generateTransferCoin } from './utils';

import type { IEncodedTxAptos } from '@onekeyhq/core/src/chains/aptos/types';
import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
  IVaultSettings,
} from '../../types';

export default class VaultAptos extends VaultBase {
  override coreApi = coreChainApi.aptos.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId, externalAccountAddress } = params;
    const address = account.address || externalAccountAddress || '';
    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTx> {
    const { transfersInfo } = params;
    if (!transfersInfo || transfersInfo.length === 0 || !transfersInfo[0].to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const transferInfo = transfersInfo[0];
    const { to, amount, tokenInfo } = transferInfo;

    if (!tokenInfo) {
      throw new Error(
        'Invalid transferInfo.tokenInfo params, should not be empty',
      );
    }

    const { address: from } = await this.getAccount();
    const amountValue = new BigNumber(amount)
      .shiftedBy(tokenInfo.decimals)
      .toFixed();

    const encodedTx: IEncodedTxAptos = {
      ...generateTransferCoin(to, amountValue, tokenInfo.address),
      sender: from,
    };

    return encodedTx;
  }

  private async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxAptos,
  ): Promise<IUnsignedTxPro> {
    const newEncodedTx = encodedTx;

    const expect = BigInt(Math.floor(Date.now() / 1000) + 100);
    if (!isNil(encodedTx.bscTxn) && !isEmpty(encodedTx.bscTxn)) {
      const deserializer = new BCS.Deserializer(
        bufferUtils.hexToBytes(encodedTx.bscTxn),
      );
      const rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
      const newRawTx = new TxnBuilderTypes.RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        rawTx.max_gas_amount,
        rawTx.gas_unit_price,
        rawTx.expiration_timestamp_secs > expect
          ? rawTx.expiration_timestamp_secs
          : expect,
        rawTx.chain_id,
      );

      const serializer = new BCS.Serializer();
      newRawTx.serialize(serializer);
      newEncodedTx.bscTxn = bufferUtils.bytesToHex(serializer.getBytes());
    } else if (
      encodedTx.expiration_timestamp_secs &&
      BigInt(encodedTx.expiration_timestamp_secs) < expect
    ) {
      newEncodedTx.expiration_timestamp_secs = expect.toString();
    }

    const account = await this.getAccount();
    return Promise.resolve({
      inputs: [
        {
          address: hexUtils.stripHexPrefix(account.address),
          value: new BigNumber(0),
          publicKey: account.pub ? hexUtils.stripHexPrefix(account.pub) : '',
        },
      ],
      outputs: [],
      payload: { encodedTx: newEncodedTx },
      encodedTx: newEncodedTx,
    });
  }

  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new Error('Method not implemented.');
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxAptos);
    }
    throw new OneKeyInternalError();
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const isValid =
      hexUtils.isHexString(address) &&
      hexUtils.stripHexPrefix(address).length === 64;
    return {
      isValid,
      normalizedAddress: address,
      displayAddress: address,
    };
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return this.baseGetPrivateKeyFromImported(params);
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }
}
