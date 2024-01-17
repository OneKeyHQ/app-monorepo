export type INameResolver = {
  subtype: string;
  value: string;
};

export type IResolveNameParams = {
  name: string;
  networkId: string;
};

export type IResolveNameResp = {
  names: INameResolver[];
  showSymbol: string;
};
