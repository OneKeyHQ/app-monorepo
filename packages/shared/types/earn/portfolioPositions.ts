import type { IDeFiPosition, IProtocolSummary } from '../defi';
import type {
  IEarnActionIcon,
  IEarnInvestmentItemV2,
  IEarnProtocolCategory,
  IEarnProtocolType,
  IEarnText,
} from '../staking';

/**
 * POST /earn/v1/portfolio/positions (OK-61377): the phone "My portfolio"
 * page's data model. It is the wallet DeFi Portfolio contract
 * (IFetchAccountDeFiPositionsResp['data']) limited to OneKey Earn, with an
 * `earn` block on every position:
 *   - a position is one holding the user acts on as a unit: one vault /
 *     market on one network, `groupId` is its identity, and the client never
 *     merges, splits or re-derives one;
 *   - its `assets` are the staked principal plus the principal waiting to be
 *     claimed (see IEarnPositionAssetCategory); each withdrawal in progress
 *     is a locked position of its own (`earn.unstaking`), the way the wallet
 *     DeFi portfolio shows it; its `rewards` are the yield rows;
 *   - the card has one button (`earn.action`), and every claim or withdrawal
 *     runs on the detail page, except a position without one, which carries
 *     its claim in `earn.claim`;
 *   - the whole investment detail the position was cut from travels along in
 *     `earn.investment`, so nothing the older investment-detail page had is
 *     lost; the page reads what it renders and ignores the rest.
 */

/** Wallet position categories the Earn page uses; each maps to one badge. */
export type IEarnPositionCategory = 'yield' | 'staked' | 'lending';

/**
 * `assets[].category` / `rewards[].category`: deposit is the staked
 * principal, claimable is withdrawn principal waiting to be claimed,
 * unstaking is a withdrawal in progress (only on locked positions), reward
 * is yield.
 */
export type IEarnPositionAssetCategory =
  | 'deposit'
  | 'claimable'
  | 'unstaking'
  | 'reward';

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
  /** where Manage and a tapped row go: this position's own detail page */
  manage: IEarnPositionManageTarget;
  /**
   * The card's button. `manage` opens the detail page; `unstake` is the same
   * page labelled for a provider whose only move left is leaving (Ethena).
   */
  action?: 'manage' | 'unstake';
  /** locked positions: one per withdrawal in progress, dated when the provider knows */
  unstaking?: { unlockAt?: number };
  /** principal claimed on the card itself, for a position without a detail page */
  claim?: IEarnActionIcon;
  /** `airdrop`: the claim runs through the airdrop claim flow of the detail page */
  claimSource?: 'airdrop';
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
  investment: IEarnPositionInvestment;
  /** the on-chain airdrop rows the server folded into `rewards` or cut this position from, kept whole */
  airdropRows?: IEarnPositionAirdropRow[];
  /** fiat of those rows, as the airdrop detail sums it */
  airdropFiatValue?: string;
};

export type IEarnPortfolioPosition = Omit<IDeFiPosition, 'category'> & {
  category: IEarnPositionCategory;
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
