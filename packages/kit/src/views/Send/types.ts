export enum SendRoutes {
  Send = 'Send',
  SendConfirm = 'SendConfirm',
  SendEditFee = 'SendEditFee',
  SendAuthentication = 'SendAuthentication',
}

export type SendParams = {
  to: string;
  account: {
    id: string;
    name: string;
    address: string;
  };
  network: {
    id: string;
    name: string;
  };
  value: string;
  token: {
    idOnNetwork: string;
    logoURI: string;
    name: string;
    symbol: string;
  };
  gasPrice: string;
  gasLimit: string;
};

export type SendRoutesParams = {
  [SendRoutes.Send]: undefined;
  [SendRoutes.SendEditFee]: undefined;
  [SendRoutes.SendConfirm]: SendParams;
  [SendRoutes.SendAuthentication]: SendParams;
};
