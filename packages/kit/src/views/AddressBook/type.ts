import type { IServerNetwork } from '@onekeyhq/shared/types';

export type IAddressItem = {
  id?: string;
  address: string;
  name: string;
  networkId: string;
  createdAt?: number;
  updatedAt?: number;
};

export type IAddressNetworkItem = IAddressItem & {
  network: IServerNetwork;
};
