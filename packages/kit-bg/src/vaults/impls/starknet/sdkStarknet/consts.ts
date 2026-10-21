import type { IStrk20PrivacyNetworkConfig } from '@onekeyhq/shared/types/starknetPrivacy';

/**
 * Temporary: Starknet RPC is meant to run through OneKey's backend proxy, the
 * same route Stellar uses. The backend has no Starknet proxy yet, so the
 * default transport is direct JSON-RPC against the endpoints below. Flip this
 * to true when the proxy lands and the bundled urls stop being used.
 *
 * There is deliberately no runtime fallback from proxy to public RPC: a failing
 * proxy has to surface, not be masked by a silent downgrade.
 */
export const STARKNET_BACKEND_PROXY_ENABLED = false;

/**
 * Bundled default JSON-RPC endpoints, one per preset network. Temporary, see
 * STARKNET_BACKEND_PROXY_ENABLED above.
 *
 * This repo has no preset-RPC mechanism (IServerNetwork has no rpcUrls field
 * and ServiceCustomRpc.getCustomRpcForNetwork is a pure local-DB read), and
 * Starknet has no backend proxy to fall back to, so Phase 1 ships its own
 * defaults. A user-configured custom RPC always wins over these.
 *
 * Both paths pin spec 0.10 because STRK20 private transfers need `proof` on
 * starknet_addInvokeTransaction, which the spec only carries from 0.10.1.
 * Verified 2026-09-18: /rpc/v0_10 answers 0.10.2 on mainnet and Sepolia alike,
 * accepts the pre_confirmed tag, rejects the old `pending` tag with -32602, and
 * still reports error 20 for a missing contract and 29 for a missing tx hash.
 *
 * A user-configured RPC may still serve 0.9, so every field this package reads
 * stays 0.9-compatible (chainId, class hash, nonce, call results, the six
 * estimateFee resource fields, receipt execution_status / finality_status /
 * block_number / actual_fee) and the open-block tag is resolved per endpoint by
 * ClientStarknet.getPreConfirmedBlockTag. Such an endpoint cannot carry a
 * privacy proof; ServiceStarknetPrivacy gates on minRpcSpecVersion for that.
 *
 * The previously planned public.blastapi.io endpoints are gone: every path and
 * version now answers "Blast API is no longer available".
 */
export const STARKNET_DEFAULT_RPC_URLS: Record<string, string> = {
  'starknet--mainnet': 'https://api.cartridge.gg/x/starknet/mainnet/rpc/v0_10',
  'starknet--sepolia': 'https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_10',
};

/**
 * Bundled STRK20 privacy config. `enabled: false` with empty endpoints on
 * purpose: a missing or unparseable remote config falls back to this, and that
 * fallback must never silently switch the feature on.
 *
 * Pool addresses and auditor keys are live-verified (docs/02-strk20-
 * deployment-facts.md): each class at those addresses exposes apply_actions,
 * get_public_key, get_enc_private_key, get_fee_amount and get_fee_collector.
 * The fee is not configured here: it changes, so it is read via get_fee_amount.
 * Mainnet discovery is StarkNet's hosted instance (live-verified 2026-10-15
 * through the vendored SDK over OHTTP), key config pinned from the operator's
 * snippet and byte-identical to its /ohttp-keys, 1000 req / 5 min per IP.
 * Mainnet proving is the Starkscan REST prover (StarkscanProvingService in the
 * vendored SDK); the API key arrives via remote config, so it stays off here.
 * StarkNet runs no Sepolia infrastructure at all.
 *
 * minRpcSpecVersion is 0.10.1: below it `proof` does not exist on
 * starknet_addInvokeTransaction, so a private tx could not be submitted at all.
 */
export const STRK20_PRIVACY_FALLBACK_CONFIG: Record<
  string,
  IStrk20PrivacyNetworkConfig
> = {
  'starknet--mainnet': {
    networkId: 'starknet--mainnet',
    enabled: false,
    poolAddress:
      '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a',
    discoveryUrl: 'https://discovery.nodes.starknet.org',
    provingUrl: 'https://api.starkscan.co/v1/SN_MAIN',
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
  'starknet--sepolia': {
    networkId: 'starknet--sepolia',
    enabled: false,
    poolAddress:
      '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91',
    discoveryUrl: '',
    provingUrl: '',
    auditorPublicKey:
      '0x01d17f98be07e99713265714699a5c40ccbf7b50c950fb7a2abd81846fcdfbb2',
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

/** STRK ERC-20, the fee token. Same address on mainnet and Sepolia. */
export const STRK_TOKEN_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

/** ETH ERC-20, shown as an ordinary token. Same address on mainnet and Sepolia. */
export const ETH_TOKEN_ADDRESS =
  '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

/** Contracts the token list always queries, before any user-added ones. */
export const STARKNET_DEFAULT_TOKEN_ADDRESSES = [
  STRK_TOKEN_ADDRESS,
  ETH_TOKEN_ADDRESS,
];

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
