import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopWalletNetworkGroup,
} from './earnDesktopHome.utils';

// The guide for a wallet without positions (demo 10-22, a checklist since
// 11-13): add ETH on Base, deposit USDC, view the position. Each task opens
// the app's own window for it. Base because its network fees are a few
// cents; the PO picked this Morpho USDC vault as the example, which the Earn
// window starts on
export const EARN_GUIDE_SYMBOL = 'USDC';
export const EARN_GUIDE_PROVIDER = 'morpho';
export const EARN_GUIDE_VAULT = '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b';
export const getEarnGuideNetworkId = () => getNetworkIdsMap().base;

// ETH on Base that counts as enough for the deposit and a later withdrawal;
// the guide asks for more than this, for room
export const EARN_GUIDE_MIN_GAS = 0.0001;
export const EARN_GUIDE_SUGGESTED_GAS = '0.0005';

export type IEarnGuideStep = 1 | 2 | 3;
export const EARN_GUIDE_STEPS: IEarnGuideStep[] = [1, 2, 3];

/** What the guide keeps for an account between visits */
export type IEarnGuideSaved = {
  /** When the account's first deposit went out of the Earn window */
  depositedAt?: number;
  completed?: boolean;
  /** The checklist folded to its pill, or opened from it */
  collapsed?: boolean;
};

export type IEarnGuideState = {
  /** Tasks 1 to 3 in order */
  done: [boolean, boolean, boolean];
  current: IEarnGuideStep;
};

const toState = (done: IEarnGuideState['done']): IEarnGuideState => {
  const index = done.findIndex((item) => !item);
  return {
    done,
    current: (index < 0 ? 3 : index + 1) as IEarnGuideStep,
  };
};

// A deposit had its fee paid, so task 1 stays done after it even when the
// ETH left is under the mark. The first task not done is the current one
export function deriveGuideState({
  hasGas,
  saved,
}: {
  hasGas: boolean;
  saved: IEarnGuideSaved;
}): IEarnGuideState {
  const deposited = Boolean(saved.depositedAt);
  return toState([hasGas || deposited, deposited, Boolean(saved.completed)]);
}

/** The preview key's state: every step before the shown one done */
export function getPreviewGuideState(step: IEarnGuideStep): IEarnGuideState {
  return {
    done: EARN_GUIDE_STEPS.map(
      (item) => item < step,
    ) as IEarnGuideState['done'],
    current: step,
  };
}

/** The preview key's next state, and back to the real one after the last */
export function nextPreviewStep(
  step: IEarnGuideStep | undefined,
): IEarnGuideStep | undefined {
  if (!step) {
    return 1;
  }
  return step < 3 ? ((step + 1) as IEarnGuideStep) : undefined;
}

// The checklist shows for an account with nothing deposited, and for no
// wallet at all. A watched account can't sign, so it gets none. Once a
// deposit from the Earn window is in the account has a position, and the
// checklist stays for its last task; a position made any other way ends it
export function shouldShowGuide({
  isLoading,
  hasWallet,
  isWatching,
  hasPositions,
  saved,
  previewStep,
}: {
  isLoading: boolean;
  hasWallet: boolean;
  isWatching: boolean;
  hasPositions: boolean;
  saved: IEarnGuideSaved;
  previewStep?: IEarnGuideStep;
}) {
  if (previewStep) {
    return true;
  }
  if (isLoading) {
    return false;
  }
  if (!hasWallet) {
    return true;
  }
  if (isWatching) {
    return false;
  }
  // Without positions it shows and can't be put away. A finished one is
  // gone; it starts over when the account is still without positions later
  // (see isGuideOverWithoutPositions)
  if (!hasPositions) {
    return !saved.completed;
  }
  return Boolean(saved.depositedAt) && !saved.completed;
}

// A finished guide starts over for an account back to no positions. Not
// right after its deposit though: the position takes a while to be listed
export const EARN_GUIDE_SETTLE_MS = 10 * 60 * 1000;
export function isGuideOverWithoutPositions({
  saved,
  hasPositions,
  now,
}: {
  saved: IEarnGuideSaved;
  hasPositions: boolean;
  now: number;
}) {
  return (
    Boolean(saved.completed) &&
    !hasPositions &&
    now - (saved.depositedAt ?? 0) > EARN_GUIDE_SETTLE_MS
  );
}

/** A deposit from the Earn window is the guide's while the account has none */
export function countsAsGuideDeposit({
  hasWallet,
  isWatching,
  hasPositions,
  saved,
}: {
  hasWallet: boolean;
  isWatching: boolean;
  hasPositions: boolean;
  saved: IEarnGuideSaved;
}) {
  return hasWallet && !isWatching && !hasPositions && !saved.depositedAt;
}

/** The wallet's ETH on Base, from the home's balances a network at a time */
export function findGuideGas(
  groups: IEarnDesktopWalletNetworkGroup[],
  networkId: string,
): number {
  let total = new BigNumber(0);
  groups
    .filter((group) => group.networkId === networkId)
    .forEach(({ tokens, map }) => {
      tokens
        .filter((token) => token.isNative)
        .forEach((token) => {
          const fiat = map[token.$key];
          if (!fiat) {
            return;
          }
          const amount = new BigNumber(
            tokenRebaseUtils.applyBalanceMultiplier({
              amount: fiat.balanceParsed,
              balanceMultiplier:
                fiat.balanceMultiplier ?? token.balanceMultiplier,
            }),
          );
          if (amount.isFinite() && amount.gt(0)) {
            total = total.plus(amount);
          }
        });
    });
  return total.toNumber();
}

export const hasGuideGas = (amount: number | string | undefined) =>
  new BigNumber(amount ?? 0).gte(EARN_GUIDE_MIN_GAS);

// What Swap starts on to bring ETH to Base: the wallet's most valuable coin
// of a network's own on another network, where it pays its own fee; else its
// most valuable token there. A token on Base itself can't pay: the swap's
// fee is the very ETH that is missing. Nothing held elsewhere: no swap
export function pickGuideSwapFrom<
  T extends {
    networkId: string;
    amount: string;
    fiatValueUsd: string;
    token: { isNative?: boolean };
  },
>(heldTokens: T[], guideNetworkId: string): T | undefined {
  const byValue = (a: T, b: T) =>
    new BigNumber(b.fiatValueUsd || 0).comparedTo(a.fiatValueUsd || 0) ?? 0;
  const elsewhere = heldTokens
    .filter(
      (item) =>
        item.networkId !== guideNetworkId && new BigNumber(item.amount).gt(0),
    )
    .toSorted(byValue);
  return elsewhere.find((item) => item.token.isNative) ?? elsewhere[0];
}

/** The PO's example vault among the Earn window's offers */
export function isGuideVaultOffer(offer: IEarnDesktopHoldOffer) {
  return (
    offer.kind === 'protocol' &&
    offer.item.provider.name.toLowerCase() === EARN_GUIDE_PROVIDER &&
    (offer.item.provider.vault ?? '').toLowerCase() === EARN_GUIDE_VAULT
  );
}

/** Where the saved state of an account lives; no wallet keeps its own */
export const getGuideScope = ({
  accountId,
  indexedAccountId,
}: {
  accountId?: string;
  indexedAccountId?: string;
}) => indexedAccountId || accountId || 'none';
