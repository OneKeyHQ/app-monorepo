export type INameResolver = {
  subtype: string;
  value: string;
  type: string;
  key: string;
  label?: string;
};

export type IResolveNameParams = {
  name: string;
  networkId: string;
};

export type IResolveNameResp = {
  name: INameResolver[];
  showSymbol: string;
};
