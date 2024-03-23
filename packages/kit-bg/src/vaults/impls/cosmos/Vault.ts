/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  pubkeyToAddressDetail,
  validateCosmosAddress,
} from '@onekeyhq/core/src/chains/cosmos/sdkCosmos';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

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
} from '../../types';

export default class VaultCosmos extends VaultBase {
  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    throw new Error('Method not implemented.');
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkInfo, networkId, externalAccountAddress } = params;
    const { curve, addressPrefix } = networkInfo;
    // cosmos chains share same db account,
    // but address is different from sub chain,
    // so we should recalculate address of each chain

    let address = account.address || externalAccountAddress || '';

    let baseAddress = address;

    // TODO check is hd or imported
    // watching/external/hardware account does not have pub
    if (account.pub) {
      ({ address, baseAddress } = pubkeyToAddressDetail({
        curve,
        addressPrefix,
        publicKey: checkIsDefined(account.pub),
      }));
    }

    return {
      networkId,
      normalizedAddress: baseAddress,
      displayAddress: address,
      address,
      baseAddress,
      isValid: true,
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
    const { addressPrefix } = await this.getNetworkInfo();
    return validateCosmosAddress({
      address,
      addressPrefix,
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return super.baseGetPrivateKeyFromImported(params);
  }
}
