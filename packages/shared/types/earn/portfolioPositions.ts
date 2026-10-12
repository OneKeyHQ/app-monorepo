import type { IDeFiAsset, IDeFiPosition, IProtocolSummary } from '../defi';
import type {
  IEarnActionIcon,
  IEarnInvestmentItemV2,
  IEarnProtocolCategory,
  IEarnProtocolType,
  IEarnText,
  IEarnTooltip,
} from '../staking';

/**
 * POST /earn/v1/portfolio/positions (OK-61377): the phone "My portfolio"
 * page's data model. It is the wallet DeFi Portfolio contract
 * (IFetchAccountDeFiPositionsResp['data']) limited to OneKey Earn, with an
 * `earn` block on every position:
 *   - a position is one holding the user acts on as a unit: one vault /
 *     market on one network, `groupId` is its identity, and the client never
 *     merges, splits or re-derives one;
 *   - one vault cuts into up to three positions, the way the wallet DeFi
 *     portfolio shows a protocol: the staked principal with its yield rows
 *     (`deposit` assets and `rewards`), one locked position per withdrawal
 *     in progress (`earn.unstaking`) and the principal out of its cooldown
 *     waiting to be collected (`claimable` assets, see
 *     IEarnPositionAssetCategory). The detail page shows what sits in the
 *     vault and its rewards, not principal on its way out;
 *   - the card's principal button is `earn.action`: Manage or Unstake into
 *     the detail page, or Claim on a claimable position, which carries its
 *     claim in `earn.claim`; a reward the user collects by hand carries its
 *     own claim on the reward asset (`rewards[].claim`), one per row the
 *     detail page lists, so the card claims rewards in place;
 *   - the whole investment detail the position was cut from travels along in
 *     `earn.investment`, so nothing the older investment-detail page had is
 *     lost; the page reads what it renders and ignores the rest.
 */

/** Wallet position categories the Earn page uses; each maps to one badge. */
export type IEarnPositionCategory = 'yield' | 'staked' | 'lending';

/**
 * `assets[].category` / `rewards[].category`: deposit is the staked
 * principal, claimable is principal out of its cooldown waiting to be
 * collected (only on claimable positions), unstaking is a withdrawal in
 * progress (only on locked positions), reward is yield.
 */
export type IEarnPositionAssetCategory =
  | 'deposit'
  | 'claimable'
  | 'unstaking'
  | 'reward';

/**
 * A position's PnL as numbers: the card prints it as fiat with the
 * percentage of the cost basis ('1.69' for +1.69%), absent when the cost
 * basis is zero. Only positions with a cost basis (Pendle markets) carry it.
 */
export type IEarnPositionPnl = {
  /** accounting units (the market's accounting asset for Pendle) */
  amount: string;
  symbol?: string;
  /** request currency */
  fiatValue: string;
  percent?: string;
};

/** The Earn detail page that Manage opens: this position's own page. */
export type IEarnPositionManageTarget = {
  networkId: string;
  provider: string;
  symbol: string;
  vault?: string;
};

type IEarnInvestmentAsset = IEarnInvestmentItemV2['assets'][number];

/** An airdrop-detail row as the server sends it: its text, an optional claim and the row facts. */
export type IEarnPositionAirdropRow = Pick<
  IEarnInvestmentAsset['assetsStatus'][number],
  'title' | 'tooltip' | 'badge' | 'key' | 'kind' | 'amount' | 'fiatValue'
> & {
  description?: IEarnText;
  button?: IEarnActionIcon;
  claimType?: 'normal' | 'airdrop';
};

/**
 * How a reward is acted on from the list: the row's own button (a claim, or
 * Lista's Check, the `listaCheck` signature that reveals the amount) and the
 * flow that runs it (`investment` is the detail row's, `airdrop` the airdrop
 * read's), with the row as the detail page lists it.
 */
export type IEarnPositionRewardClaim = {
  button: IEarnActionIcon;
  claimSource: 'investment' | 'airdrop';
  row: IEarnPositionAirdropRow;
};

/**
 * A reward row of a position: claimable by hand when it carries `claim`;
 * `pending` when the user cannot claim it by itself yet (accruing until the
 * next settlement at Morpho or Lista, settled with the principal at Bitway),
 * with the detail row's tooltip saying why.
 */
export type IEarnPositionRewardAsset = IDeFiAsset & {
  claim?: IEarnPositionRewardClaim;
  status?: 'pending';
  tooltip?: IEarnTooltip;
};

/** The investment detail this position was cut from, kept whole. */
export type IEarnPositionInvestment = {
  totalFiatValue: string;
  totalFiatValueUsd?: string;
  earnings24hFiatValue: string;
  rewardsFiatValue?: string;
  netPnl?: IEarnText;
  netPnlFiatValue?: IEarnText;
  deposit?: IEarnInvestmentAsset['deposit'];
  earnings24h?: IEarnInvestmentAsset['earnings24h'];
  totalReward?: IEarnInvestmentAsset['totalReward'];
  assetsStatus?: IEarnInvestmentAsset['assetsStatus'];
  rewardAssets?: IEarnInvestmentAsset['rewardAssets'];
  buttons?: IEarnInvestmentAsset['buttons'];
};

export type IEarnPositionExtension = {
  /** ms; fixed-term positions (Pendle markets) */
  maturityAt?: number;
  matured?: boolean;
  /**
   * Where Manage and a tapped row go: this position's own detail page. Also
   * the identity every flow keys on (provider, symbol, vault): a position
   * filed under the protocol holding its funds (`protocol`; the USDe cooling
   * down at Ethena) still claims through the provider that reads it (Pendle).
   */
  manage: IEarnPositionManageTarget;
  /**
   * The card's button. `manage` opens the detail page, the way the detail
   * page's own button does; `unstake` is reserved for a provider whose only
   * move left is leaving (none sends it today); `claim` collects the
   * position's principal on the card, through `claim`; `cancel` calls a
   * withdrawal in progress back, through `cancel`.
   */
  action?: 'manage' | 'unstake' | 'claim' | 'cancel';
  /** locked positions: one per withdrawal in progress, dated when the provider knows */
  unstaking?: { unlockAt?: number };
  /** locked positions whose withdrawal can still be called back (Native): the row's own button */
  cancel?: IEarnActionIcon;
  /** claimable positions: the row's own claim button */
  claim?: IEarnActionIcon;
  /**
   * The flow that runs `claim`: `investment` is the detail row's claim, the
   * one the wide layout runs on its rows; `airdrop` is the airdrop read's
   * (the USDe cooling down at Ethena, reached through Pendle).
   */
  claimSource?: 'investment' | 'airdrop';
  /** the protocol symbol, the one the detail page and claim flows key on */
  symbol: string;
  vault?: string;
  vaultName?: string;
  protocolCategory?: IEarnProtocolCategory;
  protocolType?: IEarnProtocolType;
  providerLogoURI?: string;
  network: { networkId: string; name: string; logoURI: string };
  /** principal still activating (staking providers); already inside the deposit asset */
  pendingActivation?: { amount: string; fiatValue: string };
  /** active positions with a cost basis: the PnL the card prints under its value */
  pnl?: IEarnPositionPnl;
  investment: IEarnPositionInvestment;
  /** the on-chain airdrop rows the server folded into `rewards` or cut this position from, kept whole */
  airdropRows?: IEarnPositionAirdropRow[];
  /** fiat of those rows, as the airdrop detail sums it */
  airdropFiatValue?: string;
};

export type IEarnPortfolioPosition = Omit<
  IDeFiPosition,
  'category' | 'rewards'
> & {
  category: IEarnPositionCategory;
  rewards: IEarnPositionRewardAsset[];
  earn: IEarnPositionExtension;
};

export type IEarnPortfolioPositionsError = {
  vault: string;
  symbol: string;
  errorCode: string;
};

export type IEarnPortfolioPositionsResponse = {
  /** <networkId, positions>, the same keying as the wallet response */
  positions: Record<string, IEarnPortfolioPosition[]>;
  /** one entry per protocol per network: display name, logo and totals */
  protocolSummaries: IProtocolSummary[];
  /** vaults whose read failed; the rest of the response stands */
  errors: IEarnPortfolioPositionsError[];
};
