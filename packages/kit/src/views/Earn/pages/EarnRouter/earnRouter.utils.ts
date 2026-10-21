import BigNumber from 'bignumber.js';

import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { normalizeStakeTokenAddress } from '../../../Staking/utils/utils';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopWalletTokenGroup,
} from '../../components/desktopHome/earnDesktopHome.utils';

// ---------- Pay with ----------

export type IEarnRouterPayToken = {
  key: string;
  token: IAccountToken;
  /** The balance in display units */
  amount: string;
  /** Its value in USD, the basis the token cache keeps; '0' in another */
  fiatValueUsd: string;
  /** One unit's price in USD, on the same terms */
  priceUsd: string;
  /** The token the offer itself takes in */
  isDepositToken: boolean;
};

// The wallet's tokens on the router's network, as Pay with lists them: the
// deposit token first, then the most valuable. Positions (DeFi-marked),
// shared-balance twins and empty balances stay out. Given `payableSymbols`
// (the tokens Earn itself lists), only those and the network's own coin stay:
// a receipt token, an LP or a PT is already earning somewhere
export function listPayTokens({
  group,
  depositSymbol,
  payableSymbols,
}: {
  group?: IEarnDesktopWalletTokenGroup;
  depositSymbol: string;
  /** Lowercased */
  payableSymbols?: Set<string>;
}): IEarnRouterPayToken[] {
  if (!group) {
    return [];
  }
  const depositKey = depositSymbol.toLowerCase();
  const tokens: IEarnRouterPayToken[] = [];
  group.tokens.forEach((token) => {
    const fiat = group.map[token.$key];
    if (!fiat || token.defiMarked || fiat.sharedBalanceExcludedFromTotal) {
      return;
    }
    const symbolKey = token.symbol.toLowerCase();
    if (
      payableSymbols &&
      !token.isNative &&
      symbolKey !== depositKey &&
      !payableSymbols.has(symbolKey)
    ) {
      return;
    }
    const amount = new BigNumber(
      tokenRebaseUtils.applyBalanceMultiplier({
        amount: fiat.balanceParsed,
        balanceMultiplier: fiat.balanceMultiplier ?? token.balanceMultiplier,
      }),
    );
    if (!amount.isFinite() || amount.lte(0)) {
      return;
    }
    const isUsd = (fiat.currency ?? USD_CURRENCY_ID) === USD_CURRENCY_ID;
    const value = new BigNumber(fiat.fiatValue);
    const price = new BigNumber(fiat.price ?? 0);
    tokens.push({
      key: token.$key,
      token,
      amount: amount.toFixed(),
      fiatValueUsd: isUsd && value.isFinite() ? value.toFixed() : '0',
      priceUsd: isUsd && price.isFinite() ? price.toFixed() : '0',
      isDepositToken: symbolKey === depositKey,
    });
  });
  return tokens.toSorted((a, b) => {
    if (a.isDepositToken !== b.isDepositToken) {
      return a.isDepositToken ? -1 : 1;
    }
    return new BigNumber(b.fiatValueUsd).comparedTo(a.fiatValueUsd) ?? 0;
  });
}

// Pay with starts on the deposit token when the wallet holds it, else on the
// most valuable token the wallet holds on that network
export function pickDefaultPayToken(
  tokens: IEarnRouterPayToken[],
): IEarnRouterPayToken | undefined {
  return tokens.find((item) => item.isDepositToken) ?? tokens[0];
}

export type IEarnRouterPayMode =
  // The offer takes the token as it is: the real form
  | 'direct'
  // The provider takes it in one transaction of its own (Pendle, native
  // staking): the real form, started on that token
  | 'zap'
  // Swap first, then deposit: simulated in this demo
  | 'swapThenDeposit';

// How the chosen token reaches the provider. `takesOtherTokens`: the
// provider lists the tokens it takes in (Pendle, native staking), which
// are `zapInputs`
export function resolvePayMode({
  payToken,
  takesOtherTokens,
  zapInputs,
}: {
  payToken?: IEarnRouterPayToken;
  takesOtherTokens: boolean;
  zapInputs?: { address?: string; isNative?: boolean }[];
}): IEarnRouterPayMode {
  if (!payToken || payToken.isDepositToken) {
    return 'direct';
  }
  if (takesOtherTokens) {
    const payAddress = normalizeStakeTokenAddress({
      address: payToken.token.address,
      isNative: payToken.token.isNative,
    });
    const isTaken = (zapInputs ?? []).some(
      (input) => normalizeStakeTokenAddress(input) === payAddress,
    );
    if (isTaken) {
      return 'zap';
    }
  }
  return 'swapThenDeposit';
}

// What a swap of `payAmount` would deposit, at the two tokens' prices. The
// demo has no quote, so this stands in for one
export function estimateDepositAmount({
  payAmount,
  payPrice,
  depositPrice,
}: {
  payAmount: string;
  payPrice: string;
  depositPrice: string;
}) {
  const amount = new BigNumber(payAmount);
  const pay = new BigNumber(payPrice);
  const deposit = new BigNumber(depositPrice);
  if (
    !amount.isFinite() ||
    amount.lte(0) ||
    !pay.isFinite() ||
    !deposit.isFinite() ||
    deposit.lte(0)
  ) {
    return '0';
  }
  return amount.times(pay).div(deposit).toFixed();
}

// ---------- Offers ----------

// The offer for one provider among a token's offers: a vault, or a lending
// market, narrows it when given
export function findOffer({
  offers,
  provider,
  vault,
  marketAddress,
}: {
  offers: IEarnDesktopHoldOffer[];
  provider: string;
  vault?: string;
  marketAddress?: string;
}) {
  const providerKey = provider.toLowerCase();
  const vaultKey = vault?.toLowerCase();
  const marketKey = marketAddress?.toLowerCase();
  return offers.find((offer) => {
    if (offer.kind === 'lending') {
      const { market } = offer.offer;
      return (
        market.provider.toLowerCase() === providerKey &&
        (!marketKey || market.marketAddress.toLowerCase() === marketKey)
      );
    }
    const { name, vault: offerVault } = offer.item.provider;
    if (name.toLowerCase() !== providerKey) {
      return false;
    }
    return !vaultKey || !offerVault || offerVault.toLowerCase() === vaultKey;
  });
}

// ---------- After a withdrawal ----------

// How much more, in percentage points, another offer has to pay to be worth
// moving to: a rate that only differs past the second decimal reads the same
export const BETTER_RATE_MIN_GAIN = 0.5;

// The offer a withdrawal left and, among the token's other offers on that
// network (best rate first), the best one paying at least
// BETTER_RATE_MIN_GAIN more. Pendle sells into a token picked in the form
// and staking (native, Lido, validators, Babylon) waits to release it, so neither
// leaves the token in the wallet to deposit again. A cooldown or a queue on
// one withdrawal (Ethena, queued orders) is the withdraw form's to report
export function pickBetterOffer({
  offers,
  provider,
  vault,
}: {
  offers: IEarnDesktopHoldOffer[];
  provider: string;
  vault?: string;
}): { from?: IEarnDesktopHoldOffer; better?: IEarnDesktopHoldOffer } {
  if (
    earnUtils.isPendleProvider({ providerName: provider }) ||
    earnUtils.isNativeProvider({ providerName: provider }) ||
    earnUtils.isLidoProvider({ providerName: provider }) ||
    earnUtils.isValidatorProvider({ providerName: provider }) ||
    earnUtils.isBabylonProvider({ providerName: provider })
  ) {
    return {};
  }
  const from = findOffer({ offers, provider, vault });
  if (!from) {
    return {};
  }
  return {
    from,
    // In decimals: 4.35 - 3.85 falls just short of 0.5 in floating point
    better: offers.find(
      (offer) =>
        offer.key !== from.key &&
        new BigNumber(offer.apr).minus(from.apr).gte(BETTER_RATE_MIN_GAIN),
    ),
  };
}

// ---------- Swap, then deposit (simulated) ----------

export type IEarnRouterFlowStep = 'swap' | 'deposit';

export type IEarnRouterFlowState =
  | { status: 'idle' }
  // `confirm`: waiting on the wallet; `pending`: sent, waiting on the chain
  | {
      status: 'running';
      step: IEarnRouterFlowStep;
      phase: 'confirm' | 'pending';
    }
  // The swap went through and the deposit didn't start: the swapped tokens
  // sit in the wallet, one deposit away
  | { status: 'swapped' }
  | { status: 'done' };

export type IEarnRouterFlowAction =
  | { type: 'start' }
  | { type: 'confirmed' }
  | { type: 'settled' }
  | { type: 'cancel' }
  | { type: 'reset' };

export const EARN_ROUTER_FLOW_IDLE: IEarnRouterFlowState = { status: 'idle' };

// One press runs both steps: the deposit asks for its confirmation as soon
// as the swap settles. Cancelling the deposit's confirmation leaves the
// swapped tokens behind, and starting again deposits only
export function earnRouterFlowReducer(
  state: IEarnRouterFlowState,
  action: IEarnRouterFlowAction,
): IEarnRouterFlowState {
  switch (action.type) {
    case 'start':
      if (state.status === 'idle') {
        return { status: 'running', step: 'swap', phase: 'confirm' };
      }
      if (state.status === 'swapped') {
        return { status: 'running', step: 'deposit', phase: 'confirm' };
      }
      return state;
    case 'confirmed':
      if (state.status === 'running' && state.phase === 'confirm') {
        return { ...state, phase: 'pending' };
      }
      return state;
    case 'settled':
      if (state.status === 'running' && state.phase === 'pending') {
        return state.step === 'swap'
          ? { status: 'running', step: 'deposit', phase: 'confirm' }
          : { status: 'done' };
      }
      return state;
    case 'cancel':
      if (state.status === 'running' && state.phase === 'confirm') {
        return state.step === 'swap'
          ? EARN_ROUTER_FLOW_IDLE
          : { status: 'swapped' };
      }
      return state;
    case 'reset':
      return EARN_ROUTER_FLOW_IDLE;
    default:
      return state;
  }
}
