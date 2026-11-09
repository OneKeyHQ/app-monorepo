export type IParsedAccountInfo = {
  data: { parsed: { info: { mint: string; owner: string } } };
};

export type IAssociatedTokenInfo = {
  mint: string;
  owner: string;
};

// Metaplex DAS (Digital Asset Standard) `getAsset` response, trimmed to the
// fields the vault reads. Proxied through the backend RPC route.
export type IDasAsset = {
  id: string;
  interface: string;
  burnt?: boolean;
  compression?: {
    compressed: boolean;
    data_hash: string;
    creator_hash: string;
    asset_hash: string;
    tree: string;
    seq: number;
    leaf_id: number;
  };
  ownership?: {
    owner: string;
    delegate: string | null;
    delegated: boolean;
    frozen: boolean;
    ownership_model: string;
  };
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
    };
    links?: {
      image?: string;
    };
  };
};

// DAS `getAssetProof` response.
export type IDasAssetProof = {
  root: string;
  proof: string[];
  node_index: number;
  leaf: string;
  tree_id: string;
};
