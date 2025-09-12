export const BLOCK_HASH_NOT_FOUND_ERROR_CODE = 40_028;

export const SYSTEM_PROGRAM_IDS = new Set<string>([
  // Loaders
  'NativeLoader1111111111111111111111111111111',
  'BPFLoader1111111111111111111111111111111111',
  'BPFLoader2111111111111111111111111111111111',
  'BPFLoaderUpgradeab1e11111111111111111111111',
  'LoaderV411111111111111111111111111111111111',

  // Precompiled signature verifiers
  'Ed25519SigVerify111111111111111111111111111',
  'KeccakSecp256k11111111111111111111111111111',
  'Secp256r1SigVerify1111111111111111111111111',

  // Core programs
  '11111111111111111111111111111111', // System
  'Vote111111111111111111111111111111111111111', // Vote
  'Stake11111111111111111111111111111111111111', // Stake
  'Config1111111111111111111111111111111111111', // Config
  'ComputeBudget111111111111111111111111111111', // Compute Budget
  'AddressLookupTab1e1111111111111111111111111', // Address Lookup Table
  'ZkE1Gama1Proof11111111111111111111111111111', // ZK ElGamal Proof
]);

export const SPL_PROGRAM_IDS = new Set<string>([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token (original)
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022 (Token Extensions)
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Account
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', // Memo v2
]);

export const METAPLEX_PROGRAM_IDS = new Set<string>([
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', // Token Metadata Program
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg', // Token Auth Rules Program (pNFT)

  'cndyAnrLdpA9dQdo1GZZ4vtske8Whrw7S2tZ6tvuJkJ', // Candy Machine v2
  'CndyV3gYhBUs7WawCjz6Mgj7QJsZCxpyxUahb17KH1s', // Candy Machine v3

  'hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk', // Auction House Program
  'MPLxToknSwap111111111111111111111111111111', // Token Entangler / Token Swap

  'BGumzjBrGv4hZPuFfbA7tZW1p42fBhm1zEGmfC4p4cXj', // Bubblegum (Compressed NFTs)
  'mplBndng11111111111111111111111111111111111', // Token Bonding

  'MPLxNmeSrv111111111111111111111111111111111', // Name Service
]);
