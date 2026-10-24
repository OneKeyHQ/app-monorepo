// Public data only. Never add local IDs, device sessions, pairing data, or credentials.
export type ICloudPublicAccountSnapshot = {
  schema: 'onekey-public-account';
  version: 1;
  capabilities: string[];
  wallet: {
    kind: 'hardware' | 'hd';
    xfp: string;
    hidden: boolean;
  };
  account: {
    impl: 'btc' | 'evm' | 'sol';
    type: 'simple' | 'utxo';
    networkId: string;
    coinType: string;
    path: string;
    pathIndex: number;
    template: string;
    idSuffix?: string;
    name: string;
    address: string;
    pub: string;
    xpub?: string;
    xpubSegwit?: string;
    relPath?: string;
    addresses?: Record<string, string>;
    networks?: string[];
    createAtNetwork?: string;
  };
};

export type ICloudPublicAccountSnapshotResult = {
  appliedSnapshotIds: string[];
  added: number;
  unchanged: number;
  pending: number;
  conflicts: number;
  rejected: number;
  cancelled: boolean;
};
