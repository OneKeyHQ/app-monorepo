export interface IRequestArguments {
  id?: number | string;
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export interface IEnableResponse {
  enabled: boolean;
}

export interface IGetInfoResponse {
  node: {
    alias: string;
    pubkey: string;
    color?: string;
  };
  // Not supported by all connectors (see webln.request for more info)
  methods: string[];
}

export interface IRequestInvoiceArgs {
  amount?: string | number;
  defaultAmount?: string | number;
  minimumAmount?: string | number;
  maximumAmount?: string | number;
  defaultMemo?: string;
}

export interface ISendPaymentArgs {
  paymentRequest: string;
  networkId: string;
  accountId: string;
}

export interface ISendPaymentResponse {
  preimage: string;
}

export interface IRequestInvoiceResponse {
  paymentRequest: string;
  paymentHash: string;
}

export interface ISignMessageArgs {
  message: string;
  walletId: string;
  networkId: string;
  accountId: string;
}

export interface ISignMessageResponse {
  message: string;
  signature: string;
}

export interface IVerifyMessageArgs {
  signature: string;
  message: string;
  accountId: string;
  networkId: string;
}

export type ILNURLResponse =
  | {
      status: 'OK';
      data?: unknown;
    }
  | { status: 'ERROR'; reason: string };

export type IBalanceResponse = {
  balance: number;
  currency?: 'sats' | 'EUR' | 'USD';
};
