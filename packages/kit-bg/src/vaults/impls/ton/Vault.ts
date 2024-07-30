/* eslint-disable @typescript-eslint/no-unused-vars */
import TonWeb from 'tonweb';

import { genAddressFromAddress } from '@onekeyhq/core/src/chains/ton/sdkTon';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
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
import settings from './settings';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.ton.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined, // KeyringQr,
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

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const isValid = TonWeb.Address.isValid(address);
    const addr = isValid ? await genAddressFromAddress(address) : null;
    let normalizedAddress = '';
    let displayAddress = '';
    if (addr) {
      normalizedAddress = addr.normalAddress;
      displayAddress = addr.nonBounceAddress;
    }
    return {
      isValid,
      normalizedAddress,
      displayAddress,
    };
  }

  override async validateXpub(xpub: string): Promise<IXpubValidation> {
    return {
      isValid: false,
    };
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return this.baseGetPrivateKeyFromImported(params);
  }

  override async validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return {
      isValid: false,
    };
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
    result.deriveInfoItems = Object.values(settings.accountDeriveInfo);
    return result;
  }
}
