import type {
  IDeFiPosition,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';
import type { IEarnClaimActionIcon } from '@onekeyhq/shared/types/staking';

/**
 * Reference contract for the phone "My portfolio" DeFi Assets tab (OK-61377).
 *
 * It is the wallet DeFi Portfolio contract (POST /wallet/v1/portfolio/positions,
 * IFetchAccountDeFiPositionsResp['data']) limited to the protocols OneKey Earn
 * supports, with one `earn` block added to each position:
 *   - a position is the unit, `groupId` is its identity, and two positions
 *     never share one;
 *   - the client groups positions into protocol rows per network and never
 *     merges, splits or re-derives a position.
 */
export type IEarnPortfolioPositionsResponse = {
  /** <networkId, positions>, the same keying as the wallet response */
  positions: Record<string, IEarnPortfolioPosition[]>;
  /** one entry per protocol per network: display name, logo and totals */
  protocolSummaries: IProtocolSummary[];
};

/** Wallet position categories the Earn page uses; each maps to one badge. */
export type IEarnPositionCategory = 'yield' | 'staked' | 'lending';

/**
 * What the position is doing now. Withdrawn principal waiting to be claimed and
 * each withdrawal in progress are positions of their own, with their own
 * groupId, never rows inside the deposit position.
 */
export type IEarnPositionState = 'active' | 'claimable' | 'unstaking';

/** The Earn detail page that Manage opens: this position's own page. */
export type IEarnPositionManageTarget = {
  networkId: string;
  provider: string;
  symbol: string;
  vault?: string;
};

export type IEarnPositionExtension = {
  state: IEarnPositionState;
  /** ms; unstaking positions whose provider knows when the funds free up */
  unlockAt?: number;
  /** ms; fixed-term positions such as a Pendle PT market */
  maturityAt?: number;
  /** active positions: where Manage goes */
  manage?: IEarnPositionManageTarget;
  /** claimable positions: the claim payload the detail page already runs */
  claim?: IEarnClaimActionIcon;
};

export type IEarnPortfolioPosition = Omit<IDeFiPosition, 'category'> & {
  category: IEarnPositionCategory;
  earn: IEarnPositionExtension;
};
