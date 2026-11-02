import { getSparkNetworkFromImpl } from '@onekeyhq/core/src/chains/spark/utils';
import { decodeLightningSparkAddress } from '@onekeyhq/core/src/secret';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
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

import { KeyringHd } from './KeyringHd';

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
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: undefined,
    imported: undefined,
    watching: undefined,
    external: undefined,
  };

  private getSparkNetwork() {
    return getSparkNetworkFromImpl(
      networkUtils.getNetworkImpl({ networkId: this.networkId }),
    );
  }

  // Like the custodial Lightning network, the account shows no address and
  // receives through invoices; API calls read the Spark address from
  // normalizedAddress.
  override buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    return Promise.resolve({
      networkId,
      normalizedAddress: account.address,
      displayAddress: '',
      address: '',
      baseAddress: '',
      isValid: !!account.address,
      allowEmptyAddress: true,
    });
  }

  override async getAccountAddress(): Promise<string> {
    return (await this.getAccount()).addressDetail.normalizedAddress;
  }

  override buildEncodedTx(_params: IBuildEncodedTxParams): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  override buildDecodedTx(_params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new NotImplemented();
  }

  override buildUnsignedTx(
    _params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new NotImplemented();
  }

  override updateUnsignedTx(
    _params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new NotImplemented();
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    try {
      decodeLightningSparkAddress({ address, network: this.getSparkNetwork() });
      return {
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      };
    } catch {
      return { isValid: false, normalizedAddress: '', displayAddress: '' };
    }
  }

  override validateXpub(_xpub: string): Promise<IXpubValidation> {
    throw new NotImplemented();
  }

  override getPrivateKeyFromImported(
    _params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    throw new NotImplemented();
  }

  override validateXprvt(_xprvt: string): Promise<IXprvtValidation> {
    throw new NotImplemented();
  }

  override validatePrivateKey(
    _privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    throw new NotImplemented();
  }

  override validateGeneralInput(
    _params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    throw new NotImplemented();
  }
}
