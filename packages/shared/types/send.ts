export enum ESendPreCheckTimingEnum {
  BeforeTransaction = 'BeforeTransaction',
  Confirm = 'Confirm',
}
export type IParseTransactionResp = {
  accountAddress: string;
  parsedTx: {
    to: {
      address: string;
      name: string;
      labels: string[];
      isContract: boolean;
      riskLevel: number;
    };
    data: {
      name: string;
      args: string[];
      textSignature: string;
      hexSignature: string;
    };
  };
  interactionMap: {
    [key: string]: {
      lastTimestampMs: number;
    };
  };
};
