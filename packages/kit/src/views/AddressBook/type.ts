import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
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

export type IAddressNetworkExtendMatch = IAddressNetworkItem & {
  addressMatch?: IFuseResultMatch;
  nameMatch?: IFuseResultMatch;
};
