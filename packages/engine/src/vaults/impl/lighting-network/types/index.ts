export type IEncodedTxLighting = {
  invoice: string;
  amount: string;
  expired: string;
  created: string;
  nonce: number;
  description?: string;
  fee: number;
};
