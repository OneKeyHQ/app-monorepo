import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

type ISendMode = 'public' | 'private';
type IPrivateSendQuoteStatus = 'success' | 'failed';
type IPrivateSendFinalStatus = 'done' | 'failed';

interface ISendModeSwitchParams {
  fromMode: ISendMode;
  toMode: ISendMode;
  network: string | undefined;
  tokenSymbol: string | undefined;
}

interface ISendPrivateQuoteParams {
  status: IPrivateSendQuoteStatus;
  provider: string | undefined;
  network: string | undefined;
  tokenSymbol: string | undefined;
  receivedTokenSymbol: string | undefined;
  sendAmount: string | undefined;
  estimatedReceived: string | undefined;
  arrivalEta: string | number | undefined;
  message: string | undefined;
}

interface ISendPrivateValueDropWarningParams {
  dropPercent: number | undefined;
  provider: string | undefined;
  network: string | undefined;
  tokenSymbol: string | undefined;
  receivedTokenSymbol: string | undefined;
}

interface ISendPrivateCreateOrderParams {
  walletType: string | undefined;
  provider: string | undefined;
  network: string | undefined;
  tokenSymbol: string | undefined;
  receivedTokenSymbol: string | undefined;
  sendAmount: string | undefined;
  sendValue: string | undefined;
  estimatedReceived: string | undefined;
}

interface ISendPrivateOrderFinalStatusParams {
  orderId: string | undefined;
  finalStatus: IPrivateSendFinalStatus;
  failedReason: string | undefined;
  provider: string | undefined;
  network: string | undefined;
  tokenSymbol: string | undefined;
  receivedTokenSymbol: string | undefined;
  sendAmount: string | undefined;
  receivedAmount: string | undefined;
  duration: number | undefined;
}

export class SendScene extends BaseScene {
  private _sendFlowId: string | undefined;

  private _addressInputMethod: string | undefined;

  get sendFlowId() {
    return this._sendFlowId;
  }

  startNewFlow() {
    this._sendFlowId = generateUUID();
    this._addressInputMethod = undefined;
    return this._sendFlowId;
  }

  clearFlow() {
    this._sendFlowId = undefined;
    this._addressInputMethod = undefined;
  }

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
    this.startNewFlow();
    return {
      sendFlowId: this._sendFlowId,
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
      sendFlowId: this._sendFlowId,
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
    this._addressInputMethod = addressInputMethod;
    return {
      sendFlowId: this._sendFlowId,
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
    feeToken,
    feeFiatValue,
    txnParseType,
    txnOrigin,
    addressInputMethod,
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
    txnParseType: string | undefined;
    txnOrigin: string | undefined;
    interactContract: string | undefined;
    tokenType: string | undefined;
    tokenSymbol: string | undefined;
    tokenAddress: string | undefined;
    feeToken: string | undefined;
    feeFiatValue: string | undefined;
    addressInputMethod?: string | undefined;
    tronIsResourceRentalNeeded: boolean | undefined;
    tronIsResourceRentalEnabled: boolean | undefined;
    tronIsSwapTrxEnabled: boolean | undefined;
    tronPayCoinCode: string | undefined;
    tronUseCredit: boolean | undefined;
    tronUseRedemptionCode: boolean | undefined;
    tronIsCreditAutoClaimed: boolean | undefined;
  }) {
    const result = {
      sendFlowId: this._sendFlowId,
      network,
      txnType,
      txnParseType,
      txnOrigin,
      interactContract,
      tokenType,
      tokenSymbol,
      tokenAddress,
      feeToken,
      feeFiatValue,
      addressInputMethod: addressInputMethod ?? this._addressInputMethod,
      tronIsResourceRentalNeeded,
      tronIsResourceRentalEnabled,
      tronIsSwapTrxEnabled,
      tronPayCoinCode,
      tronUseCredit,
      tronUseRedemptionCode,
      tronIsCreditAutoClaimed,
    };
    this.clearFlow();
    return result;
  }

  @LogToServer()
  @LogToLocal()
  public quickSelectTap({
    network,
    tab,
    recipientType,
    isSearchMode,
    searchKeyLength,
    matchCount,
  }: {
    network: string | undefined;
    tab: 'recent' | 'account' | 'addressBook';
    recipientType: 'walletAccount' | 'addressBook' | 'recentRecipient';
    isSearchMode: boolean;
    searchKeyLength: number;
    matchCount: number;
  }) {
    return {
      sendFlowId: this._sendFlowId,
      network,
      tab,
      recipientType,
      isSearchMode,
      searchKeyLength,
      matchCount,
    };
  }

  @LogToServer()
  @LogToLocal()
  public quickSelectNavigation({
    network,
    tab,
    skippedToAmount,
  }: {
    network: string | undefined;
    tab: 'recent' | 'account' | 'addressBook';
    skippedToAmount: boolean;
  }) {
    return {
      sendFlowId: this._sendFlowId,
      network,
      tab,
      skippedToAmount,
    };
  }

  @LogToServer()
  @LogToLocal()
  public quickSelectTabSwitch({
    network,
    fromTab,
    toTab,
    isAutoSwitch,
  }: {
    network: string | undefined;
    fromTab: 'recent' | 'account' | 'addressBook';
    toTab: 'recent' | 'account' | 'addressBook';
    isAutoSwitch: boolean;
  }) {
    return {
      sendFlowId: this._sendFlowId,
      network,
      fromTab,
      toTab,
      isAutoSwitch,
    };
  }

  @LogToServer()
  public sendModeSwitch(params: ISendModeSwitchParams) {
    return params;
  }

  @LogToServer()
  public sendPrivateQuote(params: ISendPrivateQuoteParams) {
    return params;
  }

  @LogToServer()
  public sendPrivateValueDropWarning(
    params: ISendPrivateValueDropWarningParams,
  ) {
    return params;
  }

  @LogToServer()
  public sendPrivateCreateOrder(params: ISendPrivateCreateOrderParams) {
    return params;
  }

  @LogToServer()
  public sendPrivateOrderFinalStatus(
    params: ISendPrivateOrderFinalStatusParams,
  ) {
    return params;
  }

  @LogToServer()
  @LogToLocal()
  public quickSelectSearchNoResult({
    network,
    searchKeyLength,
  }: {
    network: string | undefined;
    searchKeyLength: number;
  }) {
    return {
      sendFlowId: this._sendFlowId,
      network,
      searchKeyLength,
    };
  }

  @LogToServer()
  public insufficientFeeOnConfirm({
    network,
    tokenSymbol,
    fillUpAmount,
    feeType,
  }: {
    network: string | undefined;
    tokenSymbol: string | undefined;
    fillUpAmount: string | undefined;
    feeType: 'native' | 'token';
  }) {
    return {
      sendFlowId: this._sendFlowId,
      network,
      tokenSymbol,
      fillUpAmount,
      feeType,
    };
  }

  @LogToLocal()
  public recentRecipientsSkipWrite({
    accountId,
    networkId,
    reason,
  }: {
    accountId: string;
    networkId: string;
    reason: 'unresolvedIdentity';
  }) {
    return {
      accountId,
      networkId,
      reason,
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
