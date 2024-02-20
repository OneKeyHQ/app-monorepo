export type IAccountDefi = {
  'protocolName': string;
  'projectName': string;
  'logoURI': string;
  'url': string;
  'protocolValue': string;
  'protocolAssetValue': string;
  'protocolDebtValue': string;
};

export type IFetchAccountDefiParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  cursor?: string;
  limit?: number;
};
export type IFetchAccountDefiResp = {
  data: IAccountDefi[];
  next: string;
};
