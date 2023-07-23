import type { IInvoiceConfig } from './invoice';

export type IEncodedTxLightning = {
  invoice: string;
  paymentHash: string;
  amount: string;
  expired: string;
  created: string;
  description?: string;
  fee: number;
  isExceedTransferLimit: boolean;
  config: IInvoiceConfig;
};
