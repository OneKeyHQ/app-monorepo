import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class SendScene extends BaseScene {
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
