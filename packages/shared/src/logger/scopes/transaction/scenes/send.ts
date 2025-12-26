import type { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class SendScene extends BaseScene {
  @LogToLocal()
  public coinControlSelected({
    network,
    selectedUtxoCount,
    totalUtxoCount,
    selectedUtxoKeys,
  }: {
    network: string | undefined;
    selectedUtxoCount: number;
    totalUtxoCount: number;
    selectedUtxoKeys: string[];
  }) {
    return {
      network,
      selectedUtxoCount,
      totalUtxoCount,
      selectedUtxoKeys,
    };
  }

  @LogToLocal()
  public coinControlResult({
    network,
    inputCount,
    outputCount,
    fee,
    txSize,
    strategy,
  }: {
    network: string | undefined;
    inputCount: number | undefined;
    outputCount: number | undefined;
    fee: string | number | undefined;
    txSize: number | undefined;
    strategy: EUtxoSelectionStrategy | undefined;
  }) {
    return {
      network,
      inputCount,
      outputCount,
      fee,
      txSize,
      strategy,
    };
  }

  @LogToServer()
  public sendSelect({
    network,
    tokenType,
    tokenSymbol,
    tokenAddress,
  }: {
    network: string | undefined;
    tokenType: string | undefined;
    tokenSymbol: string | undefined;
    tokenAddress: string | undefined;
  }) {
    return {
      network,
      tokenType,
      tokenSymbol,
      tokenAddress,
    };
  }

  @LogToServer()
  public amountInput({
    tokenType,
    tokenSymbol,
    tokenAddress,
  }: {
    tokenType: string | undefined;
    tokenSymbol: string | undefined;
    tokenAddress: string | undefined;
  }) {
    return {
      tokenType,
      tokenSymbol,
      tokenAddress,
    };
  }

  @LogToServer()
  public addressInput({
    addressInputMethod,
  }: {
    addressInputMethod: string | undefined;
  }) {
    return {
      addressInputMethod,
    };
  }

  @LogToServer()
  public sendConfirm({
    network,
    txnType,
    interactContract,
    tokenType,
    tokenSymbol,
    tokenAddress,
    tronIsResourceRentalNeeded,
    tronIsResourceRentalEnabled,
    tronIsSwapTrxEnabled,
    tronPayCoinCode,
    tronUseCredit,
    tronUseRedemptionCode,
    tronIsCreditAutoClaimed,
  }: {
    network: string | undefined;
    txnType: string | undefined;
    interactContract: string | undefined;
    tokenType: string | undefined;
    tokenSymbol: string | undefined;
    tokenAddress: string | undefined;
    tronIsResourceRentalNeeded: boolean | undefined;
    tronIsResourceRentalEnabled: boolean | undefined;
    tronIsSwapTrxEnabled: boolean | undefined;
    tronPayCoinCode: string | undefined;
    tronUseCredit: boolean | undefined;
    tronUseRedemptionCode: boolean | undefined;
    tronIsCreditAutoClaimed: boolean | undefined;
  }) {
    return {
      network,
      txnType,
      interactContract,
      tokenType,
      tokenSymbol,
      tokenAddress,
      tronIsResourceRentalNeeded,
      tronIsResourceRentalEnabled,
      tronIsSwapTrxEnabled,
      tronPayCoinCode,
      tronUseCredit,
      tronUseRedemptionCode,
      tronIsCreditAutoClaimed,
    };
  }

  @LogToLocal()
  public rawTxFetchFailed({
    network,
    txids,
    error,
    attemptNumber,
    retriesLeft,
  }: {
    network: string | undefined;
    txids: string[];
    error: string;
    attemptNumber: number;
    retriesLeft: number;
  }) {
    return {
      network,
      txids,
      error,
      attemptNumber,
      retriesLeft,
    };
  }
}
