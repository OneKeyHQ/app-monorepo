import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopWalletNetworkGroup,
} from './earnDesktopHome.utils';

// The guide for a wallet without positions (demo 10-22, a checklist since
// 11-13): add ETH for the fees, choose a vault, deposit USDC, view the
// portfolio. Each step opens the app's own window for it. Base because its
// network fees are a few cents; the PO picked this Morpho USDC vault as the
// example, which the Earn window starts on
export const EARN_GUIDE_SYMBOL = 'USDC';
export const EARN_GUIDE_PROVIDER = 'morpho';
export const EARN_GUIDE_VAULT = '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b';
// USDC on Base, for the step that buys or receives it
export const EARN_GUIDE_TOKEN_ADDRESS =
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
export const getEarnGuideNetworkId = () => getNetworkIdsMap().base;
// The Help Center's page on the app's Earn section
export const EARN_GUIDE_TUTORIAL_URL =
  'https://help.onekey.so/articles/11461138';

// ETH on Base that counts as enough for the deposit and a later withdrawal;
// the guide asks for more than this, for room
export const EARN_GUIDE_MIN_GAS = 0.0001;
export const EARN_GUIDE_SUGGESTED_GAS = '0.0005';
// What counts as something to deposit, in USD: under it the Earn window's
// form has nothing to work with
export const EARN_GUIDE_MIN_DEPOSIT_USD = 1;
// The page scrolled this far is being read: the open window folds out of
// the way of its list
export const EARN_GUIDE_YIELD_SCROLL = 80;

export type IEarnGuideStep = 1 | 2 | 3 | 4;
export const EARN_GUIDE_STEPS: IEarnGuideStep[] = [1, 2, 3, 4];
const LAST_STEP: IEarnGuideStep = 4;

/** What the guide keeps for an account between visits */
export type IEarnGuideSaved = {
  /** The vault the user picked in the Earn window, by its offer's key */
  vaultKey?: string;
  /** When the account's first deposit went out of the Earn window */
  depositedAt?: number;
  completed?: boolean;
  /** The checklist folded to its pill, or opened from it */
  collapsed?: boolean;
};

export type IEarnGuideState = {
  /** Steps 1 to 4 in order */
  done: [boolean, boolean, boolean, boolean];
  current: IEarnGuideStep;
};

const toState = (done: IEarnGuideState['done']): IEarnGuideState => {
  const index = done.findIndex((item) => !item);
  return {
    done,
    current: (index < 0 ? LAST_STEP : index + 1) as IEarnGuideStep,
  };
};

// A deposit had its fee paid and its vault chosen, so steps 1 and 2 stay done
// after it, even when the ETH left is under the mark. A vault can be chosen
// before the ETH is in. The first step not done is the current one
export function deriveGuideState({
  hasGas,
  saved,
}: {
  hasGas: boolean;
  saved: IEarnGuideSaved;
}): IEarnGuideState {
  const deposited = Boolean(saved.depositedAt);
  return toState([
    hasGas || deposited,
    Boolean(saved.vaultKey) || deposited,
    deposited,
    Boolean(saved.completed),
  ]);
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

export type IEarnGuidePreview = {
  step: IEarnGuideStep;
  /** The third step as a wallet with nothing to deposit sees it */
  needsFunds?: boolean;
};

// The preview key's states in order: every step, the third both ways
const PREVIEW_ORDER: IEarnGuidePreview[] = [
  { step: 1 },
  { step: 2 },
  { step: 3, needsFunds: true },
  { step: 3 },
  { step: 4 },
];

/** The preview key's next state, and back to the real one after the last */
export function nextGuidePreview(
  current: IEarnGuidePreview | undefined,
): IEarnGuidePreview | undefined {
  if (!current) {
    return PREVIEW_ORDER[0];
  }
  const index = PREVIEW_ORDER.findIndex(
    (item) =>
      item.step === current.step &&
      Boolean(item.needsFunds) === Boolean(current.needsFunds),
  );
  return PREVIEW_ORDER[index + 1];
}

// The checklist shows for an account with nothing deposited, and for no
// wallet at all. A watched account can't sign, so it gets none. Once a
// deposit from the Earn window is in the account has a position, and the
// checklist stays for its last step; a position made any other way ends it.
// Skipped, it is gone until the app is opened again
export function shouldShowGuide({
  isLoading,
  hasWallet,
  isWatching,
  hasPositions,
  saved,
  previewStep,
  isSkipped,
}: {
  isLoading: boolean;
  hasWallet: boolean;
  isWatching: boolean;
  hasPositions: boolean;
  saved: IEarnGuideSaved;
  previewStep?: IEarnGuideStep;
  isSkipped?: boolean;
}) {
  if (previewStep) {
    return true;
  }
  if (isLoading || isSkipped) {
    return false;
  }
  if (!hasWallet) {
    return true;
  }
  if (isWatching) {
    return false;
  }
  // A finished one is gone; it starts over when the account is still
  // without positions later (see isGuideOverWithoutPositions)
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

// A vault picked in the Earn window is the guide's choice when it is one of
// the guide's token on the guide's network, where its Deposit step opens
export function isGuideVaultPick({
  symbol,
  networkId,
}: {
  symbol: string;
  networkId: string;
}) {
  return (
    symbol.toUpperCase() === EARN_GUIDE_SYMBOL &&
    networkId === getEarnGuideNetworkId()
  );
}

/**
 * A pick or a deposit in the Earn window is the guide's while the account
 * has no position and no deposit yet
 */
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

type IGuideHeldToken = {
  networkId: string;
  amount: string;
  fiatValueUsd: string;
  priceUsd: string;
  token: { isNative?: boolean };
};

// Whether the wallet holds something the Earn window can deposit: USDC on
// Base, or any token Pay with swaps or bridges into it. The ETH on Base set
// aside for the fees isn't for depositing
export function hasGuideDepositFunds(
  heldTokens: IGuideHeldToken[],
  guideNetworkId: string,
) {
  const total = heldTokens.reduce((sum, item) => {
    if (item.networkId === guideNetworkId && item.token.isNative) {
      const spare = new BigNumber(item.amount).minus(EARN_GUIDE_SUGGESTED_GAS);
      const value = spare.times(item.priceUsd || 0);
      return value.isFinite() && value.gt(0) ? sum.plus(value) : sum;
    }
    const value = new BigNumber(item.fiatValueUsd || 0);
    return value.isFinite() && value.gt(0) ? sum.plus(value) : sum;
  }, new BigNumber(0));
  return total.gte(EARN_GUIDE_MIN_DEPOSIT_USD);
}

// The amount Swap starts on: what the suggested ETH costs in the token paid
// with, rounded up to two digits. None when a price is missing, or when the
// wallet holds under twice that (its own fee comes out of the same balance)
export function getGuideSwapAmount({
  fromAmount,
  fromPriceUsd,
  gasPriceUsd,
}: {
  /** The balance of the token paid with */
  fromAmount: string;
  fromPriceUsd?: string;
  /** One ETH in USD */
  gasPriceUsd?: string;
}): string | undefined {
  const fromPrice = new BigNumber(fromPriceUsd || 0);
  const gasPrice = new BigNumber(gasPriceUsd || 0);
  if (
    !fromPrice.isFinite() ||
    !gasPrice.isFinite() ||
    fromPrice.lte(0) ||
    gasPrice.lte(0)
  ) {
    return undefined;
  }
  const amount = new BigNumber(
    new BigNumber(EARN_GUIDE_SUGGESTED_GAS)
      .times(gasPrice)
      .div(fromPrice)
      .toPrecision(2, BigNumber.ROUND_UP),
  );
  if (!amount.gt(0) || amount.times(2).gt(fromAmount || 0)) {
    return undefined;
  }
  return amount.toFixed();
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
