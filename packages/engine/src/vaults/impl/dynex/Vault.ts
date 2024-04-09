/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { NotImplemented } from '../../../errors';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { AccountCredentialType } from '../../../types/account';
import type { PartialTokenInfo } from '../../../types/provider';
import type {
  IApproveInfo,
  IDecodedTx,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { EVMDecodedItem } from '../evm/decoder/types';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { ClientDynex } from './helper/ClientDynex';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  private async getClient(url?: string): Promise<ClientDynex> {
    const rpcURL = await this.getRpcUrl();
    return this.createClientFromURL(url ?? rpcURL);
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getClient(url);
    const start = performance.now();
    const latestBlock = await client.getBlockCount();
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  override createClientFromURL = memoizee(
    (rpcURL: string) => new ClientDynex(rpcURL),
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
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

  override updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  override decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx> {
    throw new NotImplemented();
  }

  override decodedTxToLegacy(decodedTx: IDecodedTx): Promise<EVMDecodedItem> {
    throw new NotImplemented();
  }

  override buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  override buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    return Promise.resolve(params.encodedTx);
  }
}
