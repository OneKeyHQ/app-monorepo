import { DBNetwork, UpdateNetworkParams } from '../types/network';

interface DBAPI {
  listNetworks(): Promise<Array<DBNetwork>>;
  addNetwork(network: DBNetwork): Promise<DBNetwork>;
  getNetwork(networkId: string): Promise<DBNetwork>;
  updateNetworkList(networks: Array<[string, boolean]>): Promise<void>;
  updateNetwork(
    networkId: string,
    params: UpdateNetworkParams,
  ): Promise<DBNetwork>;
  deleteNetwork(networkId: string): Promise<void>;
}

export type { DBAPI };
