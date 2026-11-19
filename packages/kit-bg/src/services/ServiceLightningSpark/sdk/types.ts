// cspell:ignore uniffi Msat
import type { ILightningSparkNetwork } from '@onekeyhq/core/src/secret';

import type { InputType, SendPaymentMethod } from '@breeztech/breez-sdk-spark';

// What the app uses of the Breez SDK Spark, written in the shapes of the web
// (wasm) build, which satisfies these types as it is. The native build
// (uniffi) has other shapes and is adapted to these in
// breezSdkNativeAdapter.ts. Members are declared as methods on purpose: the
// wasm build takes wider requests than the ones listed here.

export type ISparkSdkConfig = {
  apiKey?: string;
  privateEnabledDefault: boolean;
  lnurlDomain?: string;
  useDefaultExternalInputParsers: boolean;
  realTimeSyncServerUrl?: string;
};

export type ISparkHtlcDetails = {
  paymentHash: string;
  preimage?: string;
};

export type ISparkPaymentDetails =
  | {
      type: 'lightning';
      invoice: string;
      description?: string;
      destinationPubkey: string;
      htlcDetails: ISparkHtlcDetails;
    }
  | { type: 'spark'; htlcDetails?: ISparkHtlcDetails }
  | { type: 'token' | 'withdraw' | 'deposit' };

export type ISparkPayment = {
  id: string;
  paymentType: 'send' | 'receive';
  status: 'completed' | 'pending' | 'failed';
  amount: bigint;
  fees: bigint;
  timestamp: number;
  method: 'lightning' | 'spark' | 'token' | 'deposit' | 'withdraw' | 'unknown';
  details?: ISparkPaymentDetails;
};

export type ISparkSdkEvent =
  | {
      type:
        | 'paymentSucceeded'
        | 'paymentPending'
        | 'paymentFailed'
        | 'paymentMetadataUpdated';
      payment: ISparkPayment;
    }
  | {
      type:
        | 'synced'
        | 'unclaimedDeposits'
        | 'claimedDeposits'
        | 'autoOptimization'
        | 'lightningAddressChanged'
        | 'newDeposits'
        | 'unilateralExitStateChanged';
    };

export type ISparkParsedInput =
  | {
      type: 'bolt11Invoice';
      paymentHash: string;
      timestamp: number;
      expiry: number;
    }
  | { type: Exclude<InputType['type'], 'bolt11Invoice'> };

export type ISparkPreparedPayment = {
  paymentMethod:
    | {
        type: 'bolt11Invoice';
        invoiceDetails: {
          invoice: { bolt11: string };
          paymentHash: string;
          amountMsat?: number;
        };
        lightningFeeSats: number;
        sparkTransferFeeSats?: number;
      }
    | { type: Exclude<SendPaymentMethod['type'], 'bolt11Invoice'> };
  amount: bigint;
  feePolicy: 'feesExcluded' | 'feesIncluded';
  tokenIdentifier?: string;
  conversionEstimate?: unknown;
};

export type ISparkReceivePaymentMethod =
  | { type: 'bolt11Invoice'; description: string; amountSats?: number }
  | { type: 'sparkAddress' };

export type ISparkListPaymentsRequest = {
  typeFilter?: ISparkPayment['paymentType'][];
  limit?: number;
  offset?: number;
};

export interface ISparkSdk {
  getInfo(request: {
    ensureSynced?: boolean;
  }): Promise<{ identityPubkey: string; balanceSats: number }>;
  getUserSettings(): Promise<{ sparkPrivateModeEnabled: boolean }>;
  updateUserSettings(request: {
    sparkPrivateModeEnabled?: boolean;
  }): Promise<void>;
  syncWallet(request: Record<string, never>): Promise<unknown>;
  receivePayment(request: {
    paymentMethod: ISparkReceivePaymentMethod;
  }): Promise<{ paymentRequest: string }>;
  parse(input: string): Promise<ISparkParsedInput>;
  listPayments(
    request: ISparkListPaymentsRequest,
  ): Promise<{ payments: ISparkPayment[] }>;
  prepareSendPayment(request: {
    paymentRequest: { type: 'input'; input: string };
    amount?: bigint;
  }): Promise<ISparkPreparedPayment>;
  // Takes the object prepareSendPayment returned, unchanged. The app sends
  // BOLT11 payments only.
  sendPayment(request: {
    prepareResponse: ISparkPreparedPayment;
    options?:
      | {
          type: 'bolt11Invoice';
          preferSpark: boolean;
          completionTimeoutSecs?: number;
        }
      | { type: 'bitcoinAddress' | 'sparkAddress' };
  }): Promise<{ payment: ISparkPayment }>;
  addEventListener(listener: {
    onEvent: (event: ISparkSdkEvent) => void;
  }): Promise<string>;
  disconnect(): Promise<void>;
}

export interface IBreezSdkSparkModule {
  defaultConfig(network: ILightningSparkNetwork): ISparkSdkConfig;
  connect(request: {
    config: ISparkSdkConfig;
    // The app connects with a mnemonic only.
    seed: { type: 'mnemonic'; mnemonic: string } | { type: 'entropy' };
    storageDir: string;
  }): Promise<ISparkSdk>;
}
