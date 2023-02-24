export interface XMRModule {
  lib: {
    MONERO_MAINNET: 0;
    MONERO_TESTNET: 1;
    MONERO_STAGENET: 2;
    sc_reduce32: (data: Uint8Array) => Uint8Array;
    hash_to_scalar: (data: Uint8Array) => Uint8Array;
    secret_key_to_public_key: (data: Uint8Array) => Uint8Array;
    get_subaddress_secret_key: (
      data: Uint8Array,
      major: number,
      minor: number,
    ) => Uint8Array;
    sc_add: (a: Uint8Array, b: Uint8Array) => Uint8Array;
    scalarmultKey: (a: Uint8Array, b: Uint8Array) => Uint8Array;
    pub_keys_to_address: (
      netType: number,
      derive: boolean,
      ps: Uint8Array,
      pv: Uint8Array,
    ) => string;
  };
}
