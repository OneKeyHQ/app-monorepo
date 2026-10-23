import BigNumber from 'bignumber.js';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopWalletNetworkGroup,
} from './earnDesktopHome.utils';

// The guide for a wallet without positions (demo 10-22): add ETH on Base,
// choose a vault, deposit USDC, view the position. Base because its network
// fees are a few cents; the PO picked this Morpho USDC vault as the example
export const EARN_GUIDE_SYMBOL = 'USDC';
export const EARN_GUIDE_PROVIDER = 'morpho';
export const EARN_GUIDE_VAULT = '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b';
export const getEarnGuideNetworkId = () => getNetworkIdsMap().base;

// The guide modal's size on a wide window, and where the card grows to
export const EARN_GUIDE_MODAL_SIZE = { width: 640, height: 760 };

// ETH on Base that counts as enough for the deposit and a later withdrawal;
// the guide asks for more than this, for room
export const EARN_GUIDE_MIN_GAS = 0.0001;
export const EARN_GUIDE_SUGGESTED_GAS = '0.0005';

export type IEarnGuideStep = 1 | 2 | 3 | 4;
export const EARN_GUIDE_STEPS: IEarnGuideStep[] = [1, 2, 3, 4];

/** What the guide keeps for an account between visits */
export type IEarnGuideSaved = {
  /** The vault picked in step 2, as the deposit modal keys its offers */
  vaultKey?: string;
  /** When the guide's own deposit went out */
  depositedAt?: number;
  /** What that deposit was, in the token, for step 4 */
  amount?: string;
  completed?: boolean;
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
    current: (index < 0 ? 4 : index + 1) as IEarnGuideStep,
  };
};

// A deposit made through the guide had its fee paid, so step 1 stays done
// after it even when the ETH left is under the mark. Without ETH a picked
// vault waits: the first step not done is the current one
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

/** The preview key's next state, and back to the real one after the last */
export function nextPreviewStep(
  step: IEarnGuideStep | undefined,
): IEarnGuideStep | undefined {
  if (!step) {
    return 1;
  }
  return step < 4 ? ((step + 1) as IEarnGuideStep) : undefined;
}

// The card stands in the hero for an account with nothing deposited, and for
// no wallet at all. A watched account can't sign, so it gets none. Once the
// guide's own deposit is in the account has a position, and the card stays
// for step 4; a position made any other way ends it
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
  // Without positions it always shows: the guide can't be put away
  if (!hasPositions) {
    return true;
  }
  return Boolean(saved.depositedAt) && !saved.completed;
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

/** The PO's example vault among the deposit modal's offers */
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
