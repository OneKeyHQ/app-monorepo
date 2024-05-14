/* eslint-disable @typescript-eslint/no-unused-vars */
import { encoding } from '@starcoin/starcoin';

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  EAddressEncodings,
  type IEncodedTx,
  type ISignedTxPro,
  type IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
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

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.stc.hd;

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
    const { account, networkId } = params;

    const address = account.address || '';

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

  override buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new Error('Method not implemented.');
  }

  override buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
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
    if (address.startsWith('stc')) {
      try {
        const riv = encoding.decodeReceiptIdentifier(address);
        return {
          normalizedAddress: `0x${riv.accountAddress}`,
          displayAddress: address,
          isValid: true,
          encoding: EAddressEncodings.BECH32,
        };
      } catch (error) {
        // pass
      }
    } else {
      try {
        const normalizedAddress = address.startsWith('0x')
          ? address.toLowerCase()
          : `0x${address.toLowerCase()}`;
        const accountAddress = encoding.addressToSCS(normalizedAddress);
        // in order to check invalid address length, because the auto padding 0 at head of address
        if (encoding.addressFromSCS(accountAddress) === normalizedAddress) {
          return {
            normalizedAddress,
            displayAddress: normalizedAddress,
            isValid: true,
            encoding: EAddressEncodings.HEX,
          };
        }
      } catch (error) {
        // pass
      }
    }

    return {
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
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
    return super.baseGetPrivateKeyFromImported(params);
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
