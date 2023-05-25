export type NearAccessKey = {
  type: 'FullAccess' | 'FunctionCall';
  pubkey: string;
  pubkeyHex: string;
  nonce: number;
  functionCall?: {
    allowance: string;
    receiverId: string;
    methodNames: string[];
  };
};
