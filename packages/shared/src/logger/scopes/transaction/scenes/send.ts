import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../decorators';

export class SendScene extends BaseScene {
  @LogToServer()
  public logTokenSelectorInfo({
    address,
    network,
    tokenType,
    tokenSymbol,
    tokenAddress,
  }: {
    address: string;
    network: string;
    tokenType: string;
    tokenSymbol: string;
    tokenAddress: string;
  }) {
    return {
      address,
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
    tokenType: string;
    tokenSymbol: string;
    tokenAddress: string;
    tokenAmount: string;
    tokenValue: string;
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
    addressInputMethod: string;
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
    txnHash: string;
    network: string;
    txnType: string;
    fromAddress: string;
    toAddress: string;
    fee: string;
    interactContract: string;
    tokenType: string;
    tokenSymbol: string;
    tokenAddress: string;
    tokenAmount: string;
    tokenValue: string;
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
