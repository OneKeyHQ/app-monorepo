export type IAddressItem = {
  id?: string;
  address: string;
  name: string;
  networkId: string;
};

export type ISectionItem = {
  title: string;
  data: IAddressItem[];
};
