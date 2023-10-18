/* eslint-disable @typescript-eslint/no-unused-vars */
import { VaultBase } from '../../VaultBase';

import settings from './settings';

import type { AccountCredentialType } from '../../../types/account';
import type {
  PartialTokenInfo,
  TransactionStatus,
} from '../../../types/provider';
import type { KeyringBaseMock } from '../../keyring/KeyringBase';
import type {
  IDecodedTx,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { IKeyringMapKey } from '../../VaultBase';
import type { EVMDecodedItem } from '../evm/decoder/decoder';
import type BigNumber from 'bignumber.js';

const FakeClass = function () {} as any;

export default class Vault extends VaultBase {
  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx> {
    throw new Error('Method not implemented.');
  }

  override decodedTxToLegacy(decodedTx: IDecodedTx): Promise<EVMDecodedItem> {
    throw new Error('Method not implemented.');
  }

  override buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override fetchFeeInfo(
    encodedTx: IEncodedTx,
    signOnly?: boolean | undefined,
    specifiedFeeRate?: string | undefined,
    transferCount?: number | undefined,
  ): Promise<IFeeInfo> {
    throw new Error('Method not implemented.');
  }

  override broadcastTransaction(
    signedTx: ISignedTxPro,
    options?: any,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override getExportedCredential(
    password: string,
    credentialType: AccountCredentialType,
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<(PartialTokenInfo | undefined)[]> {
    throw new Error('Method not implemented.');
  }

  override validateAddress(address: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
    password?: string | undefined,
    passwordLoadedCallback?: ((isLoaded: boolean) => void) | undefined,
  ): Promise<(BigNumber | undefined)[]> {
    throw new Error('Method not implemented.');
  }

  override getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    throw new Error('Method not implemented.');
  }

  settings = settings;

  override keyringMap: Record<IKeyringMapKey, typeof KeyringBaseMock> = {
    hd: FakeClass,
    hw: FakeClass,
    imported: FakeClass,
    watching: FakeClass,
    external: FakeClass,
  };
}
