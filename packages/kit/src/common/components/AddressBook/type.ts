export type IAddressItem = {
  id?: string;
  address: string;
  name: string;
  networkId: string;
  createdAt?: number;
  updatedAt?: number;
};

export type ISectionItem = {
  title: string;
  data: IAddressItem[];
};
