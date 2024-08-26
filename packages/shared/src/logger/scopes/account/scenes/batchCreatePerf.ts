import type { IFinalizeWalletSetupCreateWalletResult } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IBatchBuildAccountsParams } from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class BatchCreateAccountPerfScene extends BaseScene {
  @LogToConsole()
  public addDefaultNetworkAccounts(
    params: IFinalizeWalletSetupCreateWalletResult,
  ) {
    this.resetTimestamp();
    return {
      walletName: params.wallet.name,
      indexedAccountName: params.indexedAccount?.name,
    };
  }

  @LogToConsole()
  public addDefaultNetworkAccountsInService({
    walletId,
    indexedAccountId,
  }: {
    walletId: string | undefined;
    indexedAccountId: string | undefined;
  }) {
    return [walletId, indexedAccountId];
  }

  @LogToConsole()
  public batchBuildAccountsStart(params: IBatchBuildAccountsParams) {
    return [
      params.walletId,
      params.networkId,
      params.deriveType,
      params.indexes.toString(),
    ];
  }

  @LogToConsole()
  public emitBatchCreateDoneEvents(params: { walletId: string }) {
    return [params];
  }

  @LogToConsole()
  public cancelDevice(params: { walletId: string }) {
    return [params];
  }

  @LogToConsole()
  public batchCreateForAllNetworkDone(params: {
    walletId: string;
    addedAccountsCount: number;
  }) {
    return [params];
  }

  // prepareHdOrHwAccounts
  @LogToConsole()
  public prepareHdOrHwAccounts() {
    return [true];
  }

  @LogToConsole()
  public prepareHdOrHwAccountsDone() {
    return [true];
  }

  // buildAccountAddressDetail
  @LogToConsole()
  public buildAccountAddressDetail() {
    return [true];
  }

  @LogToConsole()
  public processAccountForCreate() {
    return [true];
  }

  @LogToConsole()
  public processAccountForCreateDone() {
    return [true];
  }
}
