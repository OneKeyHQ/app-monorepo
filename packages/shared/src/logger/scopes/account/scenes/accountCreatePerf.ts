import type { IWithHardwareProcessingOptions } from '@onekeyhq/kit-bg/src/services/ServiceHardwareUI/ServiceHardwareUI';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class CreateAccountPerfScene extends BaseScene {
  @LogToConsole()
  public createAddressRunStart() {
    this.resetTimestamp();
    return ['>>>>>>>>>>>>', true];
  }

  @LogToConsole()
  public createAddressRunFinished() {
    return ['<<<<<<<<<<<<', true];
  }

  @LogToConsole()
  public prepareHdOrHwAccountsStart(params: {
    walletId: string | undefined;
    networkId: string | undefined;
    indexes?: Array<number>; // multiple add by indexes
    indexedAccountId: string | undefined; // single add by indexedAccountId
    deriveType: IAccountDeriveTypes;
  }) {
    return [
      '=== ↓↓↓↓↓↓↓↓↓↓↓↓↓↓',
      params.networkId,
      params.deriveType,
      params.walletId,
      params.indexes?.toString(),
      params.indexedAccountId,
    ];
  }

  @LogToConsole()
  public prepareHdOrHwAccountsEnd(params: {
    walletId: string | undefined;
    networkId: string | undefined;
    indexes?: Array<number>; // multiple add by indexes
    indexedAccountId: string | undefined; // single add by indexedAccountId
    deriveType: IAccountDeriveTypes;
  }) {
    return ['=== ↑↑↑↑↑↑', params.networkId, params.deriveType, params.walletId];
  }

  @LogToConsole()
  withHardwareProcessingStart(params: IWithHardwareProcessingOptions) {
    return [params];
  }

  @LogToConsole()
  cancelDeviceBeforeProcessing(params: { message: string }) {
    return [params];
  }

  @LogToConsole()
  cancelDeviceBeforeProcessingDone(params: { message: string }) {
    return [params];
  }

  @LogToConsole()
  withHardwareProcessingRunFn() {
    return [true];
  }

  @LogToConsole()
  withHardwareProcessingRunFnDone() {
    return [true];
  }

  @LogToConsole()
  getHardwareSDKInstance() {
    return [true];
  }

  @LogToConsole()
  getHardwareSDKInstanceDone() {
    return [true];
  }

  @LogToConsole()
  sdkBtcGetPublicKey() {
    return [true];
  }

  @LogToConsole()
  sdkBtcGetPublicKeyDone(params: {
    deriveTypeLabel: string;
    indexes: number[];
    coinName: string | undefined;
  }) {
    return [params];
  }

  @LogToConsole()
  sdkEvmGetAddress() {
    return [true];
  }

  @LogToConsole()
  sdkEvmGetAddressDone(params: {
    deriveTypeLabel: string;
    indexes: number[];
    coinName: string | undefined;
    chainId: string | undefined;
  }) {
    return [params];
  }

  @LogToConsole()
  utxoBuildAddressesInfo() {
    return [true];
  }

  @LogToConsole()
  utxoBuildAddressesInfoDone() {
    return [true];
  }

  @LogToConsole()
  buildDBUtxoAccounts() {
    return [true];
  }

  @LogToConsole()
  buildDBUtxoAccountsDone() {
    return [true];
  }

  @LogToConsole()
  public prepareAccountsStartBtc(params: {
    networkId: string;
    indexes: number[];
  }) {
    return [params.networkId, params.indexes.toString()];
  }

  // initBitcoinEcc
  @LogToConsole()
  public initBitcoinEccDone() {
    return [true];
  }

  @LogToConsole()
  public getCredentialsInfo() {
    return [true];
  }

  @LogToConsole()
  public getAddressesFromHd() {
    return [true];
  }

  @LogToConsole()
  public getAddressesFromHdBtc() {
    return [true];
  }

  @LogToConsole()
  public batchGetPublicKeysBtc() {
    return [true];
  }

  @LogToConsole()
  public batchGetPublicKeysBtcDone() {
    return [true];
  }

  @LogToConsole()
  public mnemonicFromEntropy() {
    return [true];
  }

  @LogToConsole()
  public mnemonicFromEntropyDone() {
    return [true];
  }

  @LogToConsole()
  public mnemonicToSeed() {
    return [true];
  }

  @LogToConsole()
  public mnemonicToSeedDone() {
    return [true];
  }

  @LogToConsole()
  public seedToRootBip32() {
    return [true];
  }

  @LogToConsole()
  public seedToRootBip32Done() {
    return [true];
  }

  @LogToConsole()
  public bip32DerivePath() {
    return [true];
  }

  @LogToConsole()
  public derivePathKeyPair() {
    return [true];
  }

  @LogToConsole()
  public keypairToXpub() {
    return [true];
  }

  @LogToConsole()
  public keypairToXpubDone() {
    return [true];
  }

  @LogToConsole()
  public xpubToAddress() {
    return [true];
  }

  @LogToConsole()
  public xpubToAddressDone() {
    return [true];
  }

  @LogToConsole()
  public xpubToSegwit() {
    return [true];
  }

  @LogToConsole()
  public xpubToSegwitDone() {
    return [true];
  }

  @LogToConsole()
  public getAddressesFromHdBtcDone() {
    return [true];
  }

  @LogToConsole()
  public getAddressesFromHdDone() {
    return [true];
  }
}
