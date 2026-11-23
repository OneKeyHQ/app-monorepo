// Pools (LP) data model, following the product doc's Appendix A: pools are
// modelled by mechanism (V2_LIKE / V3_LIKE / V4_LIKE), and pages read the
// capability fields instead of checking protocol names.

import type { IEarnProtocolIntroInfo } from './staking';

export enum EPoolType {
  V2Like = 'V2_LIKE',
  V3Like = 'V3_LIKE',
  V4Like = 'V4_LIKE',
}

export type IPoolProtocol = 'uniswap';

export type IPoolProtocolVersion = 'v2' | 'v3' | 'v4';

export enum EPoolPositionStatus {
  Active = 'ACTIVE',
  OutOfRange = 'OUT_OF_RANGE',
  Closed = 'CLOSED',
}

/** Which side of the range the price left through */
export type IPoolOutOfRangeSide = 'below' | 'above';

export type IPoolCapabilities = {
  priceRange: boolean;
  positionForm: 'FUNGIBLE' | 'NFT';
  feeCollection: 'AUTO_COMPOUND' | 'CLAIMABLE';
  nativeToken: 'WRAP' | 'NATIVE';
  approvalModel: 'ERC20_APPROVE' | 'PERMIT2';
  hooks: boolean;
};

export type IPoolDeployment = {
  /** `${networkId}:${protocol}:${version}` */
  id: string;
  networkId: string;
  protocol: IPoolProtocol;
  version: IPoolProtocolVersion;
  poolType: EPoolType;
  capabilities: IPoolCapabilities;
  /** Router, NFT position manager or Permit2: what approvals point at */
  spenderName: string;
};

/** A curated tag; bluechip is ETH, BTC, BNB and their wrapped forms */
export type IPoolAssetCategory = 'stock' | 'stablecoin' | 'bluechip';

export type IPoolAsset = {
  /** `${networkId}:${address}`; the native coin uses an empty address */
  id: string;
  networkId: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  isNative?: boolean;
  /** ETH and WETH share one canonical id */
  canonicalId: string;
  priceUsd: string;
  /**
   * The only price is the one the token's own pools imply, which anyone can
   * set. Its side adds nothing to a pool's TVL, and adding to such a pool
   * asks for a risk confirm.
   */
  hasUntrustedPrice?: boolean;
  category?: IPoolAssetCategory;
  /** Special-list issuer, e.g. Robinhood for stock tokens */
  issuer?: string;
};

export type IPoolHook = {
  address: string;
  name: string;
  description: string;
};

export type IPoolTickLiquidityNet = {
  tick: number;
  /** Raw signed liquidity added when the price crosses this tick upward */
  liquidityNet: string;
};

export type IPool = {
  /** `${networkId}:${protocol}:${version}:${poolKey}` */
  id: string;
  networkId: string;
  deploymentId: string;
  protocol: IPoolProtocol;
  version: IPoolProtocolVersion;
  poolType: EPoolType;
  capabilities: IPoolCapabilities;
  /** Pair or pool address; the PoolId for V4 */
  poolKey: string;
  /** Groups pools of the same pair across versions and fee tiers */
  pairKey: string;
  token0: IPoolAsset;
  token1: IPoolAsset;
  /** Hundredths of a bip: 3000 = 0.30% */
  feeTier: number;
  isDynamicFee: boolean;
  hook?: IPoolHook;
  /**
   * Trades under the list's floors, so the list and its search leave the
   * pool out. Its address still finds it, and adding asks for a risk confirm.
   */
  isOffList: boolean;
  /** Counts only sides with a trusted price; what the list ranks by */
  tvlUsd: string;
  volume24hUsd: string;
  /** LP fees earned in the last 24h, protocol fee already taken out */
  fees24hUsd: string;
  /** Human token amounts held for LPs */
  reserve0: string;
  reserve1: string;
  /** False when a hook changes LP cash flows in a way the estimate ignores */
  aprEstimateSupported: boolean;
  // V2_LIKE
  lpTotalSupply?: string;
  // V3_LIKE and V4_LIKE
  tickSpacing?: number;
  sqrtPriceX96?: string;
  currentTick?: number;
  activeLiquidity?: string;
};

export type IPoolPricePoint = {
  time: number;
  /** token1 per token0 */
  price: string;
  /** USD traded in the interval that ends at this point */
  volumeUsd?: string;
};

/** The price chart's periods, as Market names them */
export type IPoolPriceRange = '1D' | '1W' | '1M' | '1Y';

/** Windows the pool list's volume, fees and APR are measured over */
export type IPoolStatsWindow = '1D' | '1W' | '1M';

/**
 * A pool's activity over one window. Changes compare it with the window
 * before it, as fractions: 0.12 is +12%.
 */
export type IPoolWindowStats = {
  volumeUsd: string;
  feesUsd: string;
  /** fees × 365 ÷ days ÷ TVL */
  apr?: string;
  tvlChange?: string;
  volumeChange?: string;
  feesChange?: string;
  /** In points, APR minus the window before's: 0.0047 is +0.47 points */
  aprChange?: string;
};

/**
 * Someone else's open range position in a pool, ranked by what it earned,
 * so a user can see which ranges work and copy one (proposal).
 */
export type IPoolTopPosition = {
  id: string;
  tokenId: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
  valueUsd: string;
  /** Fees earned since opening, at today's prices */
  feesEarnedUsd: string;
  /** Fees earned over its life, as a yearly fraction of its value */
  apr: string;
  inRange: boolean;
  createdAt: number;
};

/** What top positions rank by, highest first */
export type IPoolTopPositionsSortKey = 'apr' | 'value' | 'earned';

export type IPoolTopPositionsPage = {
  items: IPoolTopPosition[];
  /** Positions above the value floor, all pages */
  total: number;
  /** Positions worth less are left out */
  minValueUsd: string;
};

export type IPoolDetail = {
  pool: IPoolListItem;
  ticks: IPoolTickLiquidityNet[];
  priceHistory: IPoolPricePoint[];
  /** Other pools of the same pair, for side-by-side comparison */
  pairPools: IPoolListItem[];
  /** The DEX behind the pool, as an Earn asset page's Protocol tab shows it */
  protocolInfo?: IEarnProtocolIntroInfo;
};

export type IPoolPosition = {
  /** `${networkId}:${protocol}:${version}:${positionKey}` */
  id: string;
  poolId: string;
  networkId: string;
  owner: string;
  /** NFT positions (V3_LIKE / V4_LIKE) */
  tokenId?: string;
  tickLower?: number;
  tickUpper?: number;
  /** Raw liquidity */
  liquidity?: string;
  /** Fungible positions (V2_LIKE), human LP token amount */
  lpBalance?: string;
  /** Human amounts; always zero for auto-compounding pools */
  uncollectedFees0: string;
  uncollectedFees1: string;
  /** Human amounts claimed so far, so the position can show what it earned */
  collectedFees0?: string;
  collectedFees1?: string;
  createdAt: number;
};

/** A position with the figures the UI shows, computed from its pool */
export type IPoolPositionView = {
  position: IPoolPosition;
  pool: IPool;
  status: EPoolPositionStatus;
  outOfRangeSide?: IPoolOutOfRangeSide;
  amount0: string;
  amount1: string;
  valueUsd: string;
  uncollectedFeesUsd: string;
  /**
   * Fees earned since opening, claimed and unclaimed, at today's prices.
   * Zero for auto-compounding pools, whose fees are part of the value.
   */
  feesEarnedUsd: string;
  /**
   * Fees the position would have earned over the past 24h: the pool's fees
   * times its share of active liquidity. Zero when out of range or closed.
   */
  fees24hUsd: string;
  /**
   * What it earns now as a yearly rate: those 24h fees × 365 ÷ its value.
   * "0" out of range; absent when closed or when a hook makes fees unknowable.
   */
  currentApr?: string;
  /** Fungible positions only */
  shareOfPool?: string;
};

export type IPoolsPortfolio = {
  positions: IPoolPositionView[];
  totalValueUsd: string;
  uncollectedFeesUsd: string;
  fees24hUsd: string;
  tasks: IPoolTask[];
};

export type IPoolListSortKey = 'tvl' | 'apr' | 'volume24h' | 'fees';

export type IPoolListQuery = {
  networkIds?: string[];
  versions?: IPoolProtocolVersion[];
  category?: IPoolAssetCategory;
  feeTiers?: number[];
  search?: string;
  sortBy?: IPoolListSortKey;
};

export type IPoolListItem = IPool & {
  /** Pool fee APR as a fraction: fees24h × 365 ÷ TVL */
  feeApr?: string;
  /** Volume, fees and APR per window, for the list's period switch */
  windows: Record<IPoolStatsWindow, IPoolWindowStats>;
  /** When the pool was created */
  createdAt: number;
};

// Swap quotes used by Zap in and Zap out

export type IPoolSwapQuote = {
  fromAssetId: string;
  toAssetId: string;
  amountIn: string;
  amountOut: string;
  /** amountOut ÷ amountIn, after fees and price impact */
  rate: string;
  priceImpact: string;
  costUsd: string;
};

export type IPoolZapInLeg = {
  side: 0 | 1;
  amountIn: string;
  /** Absent when the input already is that pool token */
  quote?: IPoolSwapQuote;
};

export type IPoolZapInPlan = {
  inputAssetId: string;
  amountIn: string;
  legs: IPoolZapInLeg[];
  expected0: string;
  expected1: string;
  /** What actually goes in; the rest stays in the wallet */
  used0: string;
  used1: string;
  leftover0: string;
  leftover1: string;
  depositUsd: string;
  costUsd: string;
  /** Raw liquidity minted for range pools, LP tokens for share pools */
  liquidity: string;
};

export type IPoolZapOutLeg = {
  assetId: string;
  amount: string;
  /** Absent when the asset already is the target */
  quote?: IPoolSwapQuote;
};

export type IPoolZapOutPlan = {
  targetAssetId: string;
  legs: IPoolZapOutLeg[];
  expectedOut: string;
  costUsd: string;
};

// Requests the pages send; tasks keep them so later steps can re-plan

export type IPoolAddLiquidityParams = {
  poolId: string;
  /** Adds to this range position instead of minting a new one */
  positionId?: string;
  tickLower?: number;
  tickUpper?: number;
  /** The user accepted the risk of a pool the list leaves out */
  riskConfirmed?: boolean;
} & (
  | {
      mode: 'both';
      amount0: string;
      amount1: string;
      /** Pay the WETH side in ETH; the V2 router or V3 manager wraps it */
      payWithNative?: boolean;
    }
  | { mode: 'zap'; inputAssetId: string; amountIn: string }
);

export type IPoolZapInPlanParams = {
  poolId: string;
  inputAssetId: string;
  amountIn: string;
  tickLower?: number;
  tickUpper?: number;
};

export type IPoolRemoveParams = {
  positionId: string;
  /** Fraction of the position, 0–1 */
  percent: number;
  /** Swap everything into this asset; absent keeps both pool tokens */
  targetAssetId?: string;
};

export type IPoolExitParams = {
  positionIds: string[];
  percent: number;
  targetAssetId: string;
};

export type IPoolRemovePreviewItem = {
  positionId: string;
  amount0: string;
  amount1: string;
  /** Range positions hand back all unclaimed fees with any removal */
  fees0: string;
  fees1: string;
  valueUsd: string;
};

export type IPoolRemovePreview = {
  items: IPoolRemovePreviewItem[];
  /** What lands in the wallet before any swap, merged by asset */
  received: IPoolTaskTokenAmount[];
  receivedUsd: string;
  zapOut?: IPoolZapOutPlan;
};

export type IPoolTaskRequest =
  | { kind: 'add'; params: IPoolAddLiquidityParams }
  | { kind: 'remove'; params: IPoolRemoveParams }
  | { kind: 'collect'; positionId: string }
  | { kind: 'exit'; params: IPoolExitParams };

export type IPoolsWallet = {
  networkId: string;
  assets: IPoolAsset[];
  /** Human amounts keyed by asset id */
  balances: Record<string, string>;
};

export type IPoolsDemoSettings = {
  /** The next transaction fails, to show a stopped Zap */
  failNextStep: boolean;
};

// Multi-step tasks (doc §3.8): every step is its own transaction, and a
// stopped task can be continued or abandoned. Assets stay in the wallet
// between steps.

export enum EPoolTaskKind {
  AddLiquidity = 'addLiquidity',
  IncreaseLiquidity = 'increaseLiquidity',
  ZapIn = 'zapIn',
  RemoveLiquidity = 'removeLiquidity',
  ZapOut = 'zapOut',
  ExitToToken = 'exitToToken',
  CollectFees = 'collectFees',
}

export enum EPoolTaskStepKind {
  Approve = 'approve',
  ApprovePermit2 = 'approvePermit2',
  SignPermit = 'signPermit',
  Swap = 'swap',
  AddLiquidity = 'addLiquidity',
  IncreaseLiquidity = 'increaseLiquidity',
  RemoveLiquidity = 'removeLiquidity',
  CollectFees = 'collectFees',
}

export enum EPoolTaskStepStatus {
  Pending = 'pending',
  /** Waiting for the user to confirm in the wallet */
  Confirming = 'confirming',
  /** Sent, waiting for the chain */
  Submitted = 'submitted',
  Done = 'done',
  Failed = 'failed',
}

export enum EPoolTaskStatus {
  Running = 'running',
  /** Stopped between steps; can be continued or abandoned */
  Stopped = 'stopped',
  Done = 'done',
  Abandoned = 'abandoned',
}

export type IPoolTaskTokenAmount = {
  assetId: string;
  symbol: string;
  amount: string;
};

export type IPoolTaskStep = {
  id: string;
  kind: EPoolTaskStepKind;
  status: EPoolTaskStepStatus;
  /** Pool token or position the step acts on */
  poolId?: string;
  positionId?: string;
  /** Approvals: the contract allowed to spend tokenIn, shown in the wallet */
  spenderName?: string;
  /** Approvals: who that is in the user's words, "OneKey Swap" or "Uniswap" */
  spenderLabel?: string;
  tokenIn?: IPoolTaskTokenAmount;
  tokenOut?: IPoolTaskTokenAmount;
  /** Filled in once the step lands; later steps use these, not estimates */
  received?: IPoolTaskTokenAmount[];
  /** What an add step actually put into the pool */
  spent?: IPoolTaskTokenAmount[];
  txId?: string;
  error?: string;
};

/** An add's fee APR estimate, as the form showed it (doc §3.5) */
export type IPoolTaskAprPreview =
  | { status: 'ok'; /** Fraction: 0.36 = 36% */ apr: string }
  | { status: 'noFees' | 'outOfRange' | 'unavailable' };

/** What a task moves, computed when it is created (the review screen) */
export type IPoolTaskPreview = {
  /** Leaves the wallet */
  pay: IPoolTaskTokenAmount[];
  /** Goes into the pool */
  deposit: IPoolTaskTokenAmount[];
  /** Lands in the wallet */
  receive: IPoolTaskTokenAmount[];
  /** Stays in the wallet after a Zap in */
  leftover: IPoolTaskTokenAmount[];
  valueUsd: string;
  /** Swap fees and price impact */
  costUsd: string;
  /** Adds to a range pool: the range the deposit goes into */
  range?: { tickLower: number; tickUpper: number };
  /** Adds: what the deposit is estimated to earn */
  apr?: IPoolTaskAprPreview;
};

export type IPoolTask = {
  id: string;
  kind: EPoolTaskKind;
  networkId: string;
  owner: string;
  poolIds: string[];
  positionIds: string[];
  status: EPoolTaskStatus;
  steps: IPoolTaskStep[];
  createdAt: number;
  updatedAt: number;
  request: IPoolTaskRequest;
  preview: IPoolTaskPreview;
  /** Set by the step that opened a position, so success can link to it */
  resultPositionId?: string;
};
