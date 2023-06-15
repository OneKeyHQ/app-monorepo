import { NotImplemented } from '../../../errors';
import { VaultBase } from '../../VaultBase';

import settings from './settings';

import type { AccountCredentialType } from '../../../types/account';
import type { PartialTokenInfo } from '../../../types/provider';
import type { KeyringBaseMock } from '../../keyring/KeyringBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { IKeyringMapKey } from '../../VaultBase';

const FakeClass = class {} as any;

export default class Vault extends VaultBase {
  settings = settings;

  // eslint-disable-next-line
  // @ts-ignore
  override keyringMap: Record<IKeyringMapKey, typeof KeyringBaseMock> = {
    hd: FakeClass,
    hw: FakeClass,
    imported: FakeClass,
    watching: FakeClass,
    external: FakeClass,
  };

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  // TODO rename buildDecodedTx:
  //    - _decodeTx
  //    - fixDecodedTx
  //    - append payload to decodedTx
  override decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx> {
    throw new NotImplemented();
  }

  // override _decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx>;

  override decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    throw new NotImplemented();
  }

  override buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  // TODO move to EVM only
  override buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  // TODO move to EVM only
  override updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  override updateEncodedTx(
    encodedTx: IEncodedTx,
    // TODO merge payload to options, just like IDecodedTxAction
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  // buildEncodedTxFromNftTransfer
  // buildEncodedTxFromSwap

  // TODO return { UnsignedTx, IEncodedTx } , IEncodedTx may be modified
  override buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro> {
    throw new NotImplemented();
  }

  override fetchFeeInfo(
    encodedTx: IEncodedTx,
    signOnly?: boolean,
    specifiedFeeRate?: string,
    transferCount?: number,
  ): Promise<IFeeInfo> {
    throw new NotImplemented();
  }

  override fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }

  override getExportedCredential(
    password: string,
    credentialType: AccountCredentialType,
  ): Promise<string> {
    throw new NotImplemented();
  }
}
