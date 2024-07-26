import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../decorators';

export class SendScene extends BaseScene {
  @LogToServer()
  public logTokenSelectorInfo({
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
  public logAmountInputInfo({
    tokenType,
    tokenSymbol,
    tokenAddress,
    tokenAmount,
    tokenValue,
  }: {
    tokenType: string | undefined;
    tokenSymbol: string | undefined;
    tokenAddress: string | undefined;
    tokenAmount: string | undefined;
    tokenValue: string | undefined;
  }) {
    return {
      tokenType,
      tokenSymbol,
      tokenAddress,
      tokenAmount,
      tokenValue,
    };
  }

  @LogToServer()
  public logAddressInputInfo({
    addressInputMethod,
  }: {
    addressInputMethod: string | undefined;
  }) {
    return {
      addressInputMethod,
    };
  }

  @LogToServer()
  public logSendTxInfo({
    txnHash,
    network,
    txnType,
    fromAddress,
    toAddress,
    fee,
    interactContract,
    tokenType,
    tokenSymbol,
    tokenAddress,
    tokenAmount,
  }: {
    txnHash: string | undefined;
    network: string | undefined;
    txnType: string | undefined;
    fromAddress: string | undefined;
    toAddress: string | undefined;
    fee: string | undefined;
    interactContract: string | undefined;
    tokenType: string | undefined;
    tokenSymbol: string | undefined;
    tokenAddress: string | undefined;
    tokenAmount: string | undefined;
    tokenValue: string | undefined;
  }) {
    return {
      txnHash,
      network,
      txnType,
      fromAddress,
      toAddress,
      fee,
      interactContract,
      tokenType,
      tokenSymbol,
      tokenAddress,
      tokenAmount,
    };
  }
}
