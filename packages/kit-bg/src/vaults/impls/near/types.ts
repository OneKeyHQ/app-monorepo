export type INearAccessKey = {
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

export type IGasCostConfig = {
  send_sir: number;
  send_not_sir: number;
  execution: number;
};

export type INearAccountStorageBalance = {
  total?: string;
  available?: string;
};
