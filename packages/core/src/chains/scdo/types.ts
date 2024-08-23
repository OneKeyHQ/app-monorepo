export interface IEncodedTxScdo {
  Type: number;
  From: string;
  To: string;
  Amount: number;
  AccountNonce: number;
  GasPrice: number;
  GasLimit: number;
  Timestamp: number;
  Payload: string;
}
