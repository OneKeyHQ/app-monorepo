import type { IServerNetwork } from '.';
import type { IFuseResultMatch } from '../src/modules3rdParty/fuse';

export type IAddressItem = {
  id?: string; // generateUUID
  address: string;
  name: string;
  networkId: string;
  isAllowListed?: boolean;
  createdAt?: number;
  updatedAt?: number;
  memo?: string;
  note?: string;
};

export type IAddressNetworkItem = IAddressItem & {
  network: IServerNetwork;
};

export type IAddressNetworkExtendMatch = IAddressNetworkItem & {
  addressMatch?: IFuseResultMatch;
  nameMatch?: IFuseResultMatch;
};
