/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringQr } from './KeyringQr';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

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
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    qr: KeyringQr,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const { address } = account;
    return Promise.resolve({
      networkId,
      isValid: true,
      baseAddress: address,
      normalizedAddress: address,
      displayAddress: address,
      address,
      allowEmptyAddress: false,
    });
  }

  override buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new NotImplemented();
  }

  override buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new NotImplemented();
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new NotImplemented();
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    throw new NotImplemented();
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    throw new NotImplemented();
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    throw new NotImplemented();
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    throw new NotImplemented();
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    throw new NotImplemented();
  }

  override validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    throw new NotImplemented();
  }

  encrypt(params: {
    pubkey: string;
    plaintext: string;
    password: string;
    deviceParams: IDeviceSharedCallParams | undefined;
  }) {
    return (this.keyring as KeyringHd).encrypt(params);
  }

  decrypt(params: {
    pubkey: string;
    ciphertext: string;
    password: string;
    deviceParams: IDeviceSharedCallParams | undefined;
  }) {
    return (this.keyring as KeyringHd).decrypt(params);
  }
}
