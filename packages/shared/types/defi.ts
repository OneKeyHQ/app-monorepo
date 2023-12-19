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
  page?: number;
  pageSize?: number;
};
export type IFetchAccountDefiResp = {
  data: IAccountDefi[];
  page: number;
  pageSize: number;
  total: number;
};
