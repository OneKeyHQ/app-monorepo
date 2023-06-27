export type IPaymentBolt11Params = {
  address: string;
  invoice: string;
  amount: string;
  expired: string;
  created: number;
  nonce: number;
  signature: string;
};

export type ICheckPaymentResponse = {
  success: boolean;
  status: PaymentStatusEnum;
  data?: {
    message: string;
  };
};

export enum PaymentStatusEnum {
  NOT_FOUND_ORDER = 'NOT_FOUND_ORDER',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}
