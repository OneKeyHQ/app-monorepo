export interface RequestArguments {
  id?: number | string;
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export interface EnableResponse {
  enabled: boolean;
}

export interface GetInfoResponse {
  node: {
    alias: string;
    pubkey: string;
    color?: string;
  };
  // Not supported by all connectors (see webln.request for more info)
  methods: string[];
}

export interface RequestInvoiceArgs {
  amount?: string | number;
  defaultAmount?: string | number;
  minimumAmount?: string | number;
  maximumAmount?: string | number;
  defaultMemo?: string;
}

export interface SendPaymentArgs {
  paymentRequest: string;
  networkId: string;
  accountId: string;
}

export interface SendPaymentResponse {
  preimage: string;
}

export interface RequestInvoiceResponse {
  paymentRequest: string;
  paymentHash: string;
}

export interface SignMessageArgs {
  message: string;
  walletId: string;
  networkId: string;
  accountId: string;
}

export interface SignMessageResponse {
  message: string;
  signature: string;
}

export interface VerifyMessageArgs {
  signature: string;
  message: string;
  accountId: string;
  networkId: string;
}

export type LNURLResponse =
  | {
      status: 'OK';
      data?: unknown;
    }
  | { status: 'ERROR'; reason: string };

export type BalanceResponse = {
  balance: number;
  currency?: 'sats' | 'EUR' | 'USD';
};
