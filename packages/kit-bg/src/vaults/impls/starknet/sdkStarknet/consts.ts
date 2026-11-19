import type { IStrk20PrivacyNetworkConfig } from '@onekeyhq/shared/types/starknetPrivacy';

import type { IStarknetPresetToken } from './types';

/**
 * Built-in STRK20 privacy config, as Zcash and Monero ship their nodes. The
 * server can only switch the feature off, through `privacyDisabled` in the
 * network list's `extensions.localWallet` (see localWallet/remoteConfig).
 *
 * Pool addresses and auditor keys are live-verified (docs/02-strk20-
 * deployment-facts.md): each class at those addresses exposes apply_actions,
 * get_public_key, get_enc_private_key, get_fee_amount and get_fee_collector.
 * The fee is not configured here: it changes, so it is read via get_fee_amount.
 * The discovery gateway is StarkNet's hosted instance (live-verified 2026-10-15
 * through the vendored SDK over OHTTP), key config pinned from the operator's
 * snippet and byte-identical to its /ohttp-keys, 1000 req / 5 min per IP.
 * Discovery connects directly with the pinned OHTTP key config, as supplied
 * by the operator. No OneKey relay or secret API key is required for discovery.
 * Mainnet proving is the Starkscan REST prover (StarkscanProvingService in the
 * vendored SDK) through the wallet proxy, where the backend adds the API key,
 * so provingUrl stays empty.
 *
 * minRpcSpecVersion is 0.10.1: below it `proof` does not exist on
 * starknet_addInvokeTransaction, so a private tx could not be submitted at all.
 */
export const STRK20_PRIVACY_CONFIG: Record<
  string,
  IStrk20PrivacyNetworkConfig
> = {
  'starknet--mainnet': {
    networkId: 'starknet--mainnet',
    poolAddress:
      '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    discoveryUrl: 'https://discovery.nodes.starknet.org',
    provingUrl: '',
    provingKind: 'starkscan',
    ohttp: {
      enabled: true,
      publicKeyConfig:
        '0x00290000209e19bba88f0c5f4f10913377a4367265bdd59b7d435ee83cba3329f35e263939000400010001',
    },
    auditorPublicKey:
      '0x01eed60b8d483b3bede62d1cc0f32874aea30747e6943437c858359b41801bf7',
    minRpcSpecVersion: '0.10.1',
  },
};

/**
 * Seconds per block, used only to turn the STRK20 block countdown into a
 * human-readable estimate. IServerNetwork carries no block interval for this
 * chain, so it is measured rather than read: sampled 2026-09-18 over 1000- and
 * 10 000-block windows, both mainnet and Sepolia averaged 1.71s. Rounded up to
 * 2 so the countdown over-promises time rather than under-promising it.
 */
export const STARKNET_BLOCK_TIME_SECONDS = 2;

/**
 * How long a built deposit stays submittable. The pool's screening attestation
 * is valid 300s with 60s of skew tolerance, so this uses the un-padded 300s:
 * refusing a little early beats burning a fee on a SCREENING_REQUIRED revert.
 */
export const STRK20_SCREENING_WINDOW_MS = 300_000;

/** STRK ERC-20, the fee token. */
export const STRK_TOKEN_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

/** ETH ERC-20, shown as an ordinary token. */
export const ETH_TOKEN_ADDRESS =
  '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

/**
 * Tokens every account lists, before any user-added ones. Bundled until the
 * backend token list covers Starknet (docs/06); mainnet only, testnets are not
 * supported. Symbols and decimals are the bundled resource list's; names were
 * read from each contract on 2026-10-21, decimals matched. USDC.e reports the
 * symbol USDC on-chain, so only this symbol tells it apart from native USDC.
 */
export const STARKNET_PRESET_TOKENS: Record<string, IStarknetPresetToken[]> = {
  'starknet--mainnet': [
    {
      address: STRK_TOKEN_ADDRESS,
      name: 'Starknet Token',
      symbol: 'STRK',
      decimals: 18,
    },
    { address: ETH_TOKEN_ADDRESS, name: 'Ether', symbol: 'ETH', decimals: 18 },
    {
      address:
        '0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
    },
    {
      address:
        '0x0787150e306e6eae6e3f79dea881770e8bbff2c1b8eb490f969669ee945b3135',
      name: 'strkBTC',
      symbol: 'strkBTC',
      decimals: 8,
    },
    {
      address:
        '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
      name: 'Wrapped BTC',
      symbol: 'WBTC',
      decimals: 8,
    },
    {
      address:
        '0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb',
      name: 'USDC',
      symbol: 'USDC',
      decimals: 6,
    },
    {
      address:
        '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
      name: 'USD Coin',
      symbol: 'USDC.e',
      decimals: 6,
    },
  ],
};

/** Starknet JSON-RPC error codes we branch on (see the spec's error table). */
export enum EStarknetRpcErrorCode {
  ContractNotFound = 20,
  TxnHashNotFound = 29,
  TransactionExecutionError = 41,
  /** Not a Starknet code: the JSON-RPC "Invalid params" used for an unknown block tag. */
  InvalidParams = -32_602,
}

/**
 * Padding applied to every estimated resource bound, on both max_amount and
 * max_price_per_unit. 1.5 matches starknet.js's own default
 * (DEFAULT_GLOBAL_CONFIG.resourceBoundsOverhead = 50% on all six values, see
 * node_modules/starknet/dist/index.mjs), so a transaction this app builds is
 * padded exactly like one built by Argent X or Braavos.
 */
export const RESOURCE_BOUNDS_MULTIPLIER = 1.5;

/**
 * Block tag naming the not-yet-closed block. RPC 0.9 renamed `pending` to
 * `pre_confirmed` and rejects the old name outright (-32602 "Invalid block id",
 * confirmed against both live endpoints), so the tag has to follow the spec
 * version the endpoint actually serves.
 */
export const BLOCK_TAG_PRE_CONFIRMED = 'pre_confirmed';
export const BLOCK_TAG_PENDING = 'pending';
export const BLOCK_TAG_LATEST = 'latest';

/** First spec version that uses `pre_confirmed` instead of `pending`. */
export const SPEC_VERSION_PRE_CONFIRMED = { major: 0, minor: 9 };

/** ERC-20 entrypoint names. Calls carry names; buildExecuteCalldata hashes them. */
export const ERC20_ENTRYPOINT = {
  approve: 'approve',
  balanceOf: 'balanceOf',
  decimals: 'decimals',
  name: 'name',
  symbol: 'symbol',
  transfer: 'transfer',
} as const;

/**
 * starknet_call wants an already-hashed entry_point_selector, and the hash is a
 * masked keccak of the name. Hardcoding the four read-only selectors keeps
 * starknet.js out of the background bundle; selectors.test.ts recomputes them
 * from the library so they cannot drift.
 */
export const ERC20_SELECTOR = {
  balanceOf:
    '0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e',
  decimals: '0x4c4fb1ab068f6039d5780c68dd0fa2f8742cceb3426d19667778ca7f3518a9',
  name: '0x361458367e696363fbcc70777d07ebbd2394e89fd0adcaf147faccd1d294d60',
  symbol: '0x216b05c387bab9ac31918a3e61672f4618601f3c598a2f3f2710f37053e1ea4',
} as const;

/**
 * STRK20 pool view selectors. Same reason the ERC-20 ones are hardcoded:
 * starknet_call wants a hashed selector and this keeps starknet.js out of the
 * background bundle. selectors.test.ts recomputes them from the library.
 */
export const STRK20_POOL_SELECTOR = {
  getPublicKey:
    '0x1a35984e05126dbecb7c3bb9929e7dd9106d460c59b1633739a5c733a5fb13b',
  getFeeAmount:
    '0x3d323cd692ad43935b81ce230c47bfc57f69656249c5a33fe5223c17dd32ed2',
  isPaused: '0x238d7ea31550fece8f0a8a601e3ae1a7c59cb3b6cc976ceb721e31ebd9c36f9',
  getVersion:
    '0x2a4bb4205277617b698a9a2950b938d0a236dd4619f82f05bec02bdbd245fab',
} as const;

/** Entrypoint names behind STRK20_POOL_SELECTOR, for the drift test. */
export const STRK20_POOL_ENTRYPOINT = {
  getPublicKey: 'get_public_key',
  getFeeAmount: 'get_fee_amount',
  isPaused: 'is_paused',
  getVersion: 'get_version',
} as const;

/** Simulation flag that lets an undeployed account be estimated. */
export const SIMULATION_FLAG_SKIP_VALIDATE = 'SKIP_VALIDATE';

/**
 * Placeholder signature handed to starknet_estimateFee. SKIP_VALIDATE means the
 * node never checks it, but the arity still has to match a Stark signature.
 */
export const ZERO_SIGNATURE: [string, string] = ['0x0', '0x0'];
