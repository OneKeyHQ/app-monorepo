export type ICreateInvoiceParams = {
  amount: number;
  description?: string;
  description_hash?: string;
};

export type ICretaeInvoiceResponse = {
  expires_at: string;
  payment_hash: string;
  payment_request: string;
};

export type InvoiceType = {
  amount: number;
  custom_records: Record<string, number[]>;
  description: string;
  description_hash: string;
  destination: string;
  error_message: string;
  expires_at: string;
  fee: number;
  is_paid: boolean;
  keysend: boolean;
  payment_hash: string;
  payment_preimage: string;
  payment_request: string;
  settled_at: string;
  status: string;
  type: string;
};
