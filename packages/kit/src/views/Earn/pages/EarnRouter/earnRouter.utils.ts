import BigNumber from 'bignumber.js';

import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IStakeTransactionConfirmation } from '@onekeyhq/shared/types/staking';
import { swapSlippageAutoValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteResult,
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { normalizeStakeTokenAddress } from '../../../Staking/utils/utils';

import type {
  IEarnDesktopHoldOffer,
  IEarnDesktopWalletTokenGroup,
} from '../../components/desktopHome/earnDesktopHome.utils';

// ---------- The deposit modal's size ----------

// The deposit modal opened on a token's offers with more than one of them:
// wide enough for the form and, beside it, every offer as a card (the Swap
// page's routes). Modals are 640 otherwise
export const EARN_OFFERS_MODAL_WIDTH = 920;
// The offers' column beside the form, its right padding included
export const EARN_OFFER_ROUTES_COLUMN_WIDTH = 420;
// The two routers' windows (Earn's offers, Loans' markets) share one fixed
// height, within 90% of the window: what they hold scrolls inside, so a pick
// never changes the window's size
export const EARN_ROUTER_MODAL_HEIGHT = 800;

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

// Keys of tokens picked in Pay with's picker that the wallet's list lacks:
// `${PICKED_PAY_TOKEN_KEY}|networkId|address`
const PICKED_PAY_TOKEN_KEY = 'earn-pay-picked';

const isPickedPayTokenKey = (key: string) =>
  key.startsWith(`${PICKED_PAY_TOKEN_KEY}|`);

export const getPayTokenAddress = (item: IEarnRouterPayToken) =>
  normalizeStakeTokenAddress({
    address: item.token.address,
    isNative: item.token.isNative,
  });

// A token picked in Pay with's picker (Swap's, so any token on the network).
// The wallet's own entry when Pay with's list has it, its balance being the
// one to trust; else the picker's token, with the balance the picker showed
// and none for a token the wallet doesn't hold
export function toPickedPayToken({
  token,
  tokens,
  depositToken,
  depositSymbol,
}: {
  token: ISwapToken;
  tokens: IEarnRouterPayToken[];
  // The offer's own token: a pick is the deposit token by its address
  depositToken?: { address?: string; isNative?: boolean };
  depositSymbol: string;
}): IEarnRouterPayToken {
  const address = normalizeStakeTokenAddress({
    address: token.contractAddress,
    isNative: token.isNative,
  });
  const listed = tokens.find((item) => getPayTokenAddress(item) === address);
  if (listed) {
    return listed;
  }
  const key = `${PICKED_PAY_TOKEN_KEY}|${token.networkId}|${address}`;
  const isUsd = (token.currency ?? USD_CURRENCY_ID) === USD_CURRENCY_ID;
  const amount = new BigNumber(token.balanceParsed ?? 0);
  const value = new BigNumber(token.fiatValue ?? 0);
  const price = new BigNumber(token.price ?? 0);
  return {
    key,
    token: {
      $key: key,
      address: token.contractAddress,
      decimals: token.decimals,
      isNative: token.isNative,
      logoURI: token.logoURI,
      name: token.name ?? token.symbol,
      symbol: token.symbol,
      networkId: token.networkId,
      balanceMultiplier: token.balanceMultiplier,
    },
    amount: amount.isFinite() && amount.gt(0) ? amount.toFixed() : '0',
    fiatValueUsd: isUsd && value.isFinite() ? value.toFixed() : '0',
    priceUsd: isUsd && price.isFinite() ? price.toFixed() : '0',
    isDepositToken: depositToken
      ? normalizeStakeTokenAddress(depositToken) === address
      : token.symbol.toLowerCase() === depositSymbol.toLowerCase(),
  };
}

// A pick's balance, value and price from Swap's details of the token, read
// in USD as Pay with keeps them. What the details lack stays as picked
export function withPickedTokenDetails(
  item: IEarnRouterPayToken,
  detail: ISwapToken,
): IEarnRouterPayToken {
  const isUsd = (detail.currency ?? USD_CURRENCY_ID) === USD_CURRENCY_ID;
  const amount = new BigNumber(detail.balanceParsed ?? Number.NaN);
  const value = new BigNumber(detail.fiatValue ?? Number.NaN);
  const price = new BigNumber(detail.price ?? Number.NaN);
  let nextAmount = item.amount;
  if (amount.isFinite()) {
    nextAmount = amount.gt(0) ? amount.toFixed() : '0';
  }
  return {
    ...item,
    amount: nextAmount,
    fiatValueUsd:
      isUsd && value.isFinite() ? value.toFixed() : item.fiatValueUsd,
    priceUsd:
      isUsd && price.isFinite() && price.gt(0)
        ? price.toFixed()
        : item.priceUsd,
  };
}

// Pay with's tokens and the picks its list lacks, after the wallet's own. A
// pick the wallet has come to hold gives way to the wallet's entry
export function mergePickedPayTokens(
  tokens: IEarnRouterPayToken[],
  picked: IEarnRouterPayToken[],
): IEarnRouterPayToken[] {
  if (!picked.length) {
    return tokens;
  }
  const listed = new Set(tokens.map(getPayTokenAddress));
  const extra = picked.filter((item) => !listed.has(getPayTokenAddress(item)));
  return extra.length ? [...tokens, ...extra] : tokens;
}

// The pay token a key names. A pick of a token the wallet has since come to
// hold (a swap landed, a transfer arrived) finds the wallet's entry by its
// address
export function findPayToken(
  tokens: IEarnRouterPayToken[],
  key?: string,
): IEarnRouterPayToken | undefined {
  if (!key) {
    return undefined;
  }
  const byKey = tokens.find((item) => item.key === key);
  if (byKey || !isPickedPayTokenKey(key)) {
    return byKey;
  }
  const address = key.slice(key.lastIndexOf('|') + 1);
  return tokens.find(
    (item) =>
      !isPickedPayTokenKey(item.key) && getPayTokenAddress(item) === address,
  );
}

const getSwapTokenAddress = (token: ISwapToken) =>
  normalizeStakeTokenAddress({
    address: token.contractAddress,
    isNative: token.isNative,
  });

const isHeldSwapToken = (token: ISwapToken) =>
  new BigNumber(token.balanceParsed ?? 0).gt(0);

const getSwapTokenValue = (token: ISwapToken) => {
  const value = new BigNumber(token.fiatValue ?? 0);
  return value.isFinite() ? value : new BigNumber(0);
};

// A search the way it reads: the typed letters in the symbol or the name, or
// the whole contract address
export function matchesPayTokenKeyword(token: ISwapToken, keyword: string) {
  const typed = keyword.trim().toLowerCase();
  if (!typed) {
    return true;
  }
  return (
    token.symbol.toLowerCase().includes(typed) ||
    (token.name ?? '').toLowerCase().includes(typed) ||
    token.contractAddress.toLowerCase() === typed
  );
}

// The picker's list with the tokens Pay with itself offers that it lacks:
// Swap files some under DeFi tokens (sUSDe, sUSD3), and Pay with's chip can
// be on one. Only the wallet's, each among the wallet's tokens by its value;
// the list's own order stays
export function listWithPayTokens({
  list,
  candidates,
  payTokenAddresses,
}: {
  list: ISwapToken[];
  // The wallet's tokens Swap keeps out of the list
  candidates: ISwapToken[];
  // Pay with's own tokens, by address as `getPayTokenAddress` gives it
  payTokenAddresses: string[];
}): ISwapToken[] {
  const offered = new Set(payTokenAddresses);
  const listed = new Set(list.map(getSwapTokenAddress));
  const extra = candidates
    .filter((token) => {
      const address = getSwapTokenAddress(token);
      return (
        offered.has(address) && !listed.has(address) && isHeldSwapToken(token)
      );
    })
    .toSorted(
      (a, b) => getSwapTokenValue(b).comparedTo(getSwapTokenValue(a)) ?? 0,
    );
  if (!extra.length) {
    return list;
  }
  const result = [...list];
  extra.forEach((token) => {
    const value = getSwapTokenValue(token);
    const index = result.findIndex(
      (item) => !isHeldSwapToken(item) || getSwapTokenValue(item).lt(value),
    );
    result.splice(index === -1 ? result.length : index, 0, token);
  });
  return result;
}

export type IEarnRouterPayMode =
  // The offer takes the token as it is: the real form
  | 'direct'
  // The provider takes it in one transaction of its own (Pendle, native
  // staking): the real form, started on that token
  | 'zap'
  // Swap first through the app's swap service, then the provider's own
  // deposit form
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

// ---------- Swap, then deposit ----------

export type IEarnRouterSwapState =
  | { status: 'idle' }
  // Checks, a fresh quote and the transaction, before the wallet's confirm
  | { status: 'preparing' }
  // The wallet's confirm is up
  | { status: 'confirming' }
  // Sent: on its way on chain, then into the wallet
  | { status: 'swapping' }
  // In the wallet: the provider's deposit form takes over with this amount
  | { status: 'swapped'; amount: string; balance?: string };

export type IEarnRouterSwapAction =
  | { type: 'prepare' }
  | { type: 'confirm' }
  | { type: 'sent' }
  | { type: 'landed'; amount: string; balance?: string }
  // Rejected in the wallet, failed or given up: back to the start, the
  // amount kept
  | { type: 'stop' };

export const EARN_ROUTER_SWAP_IDLE: IEarnRouterSwapState = { status: 'idle' };

// One press runs the swap to the end: checks, the wallet's confirm, the
// chain. Once it lands the deposit form takes over, so nothing stops it
export function earnRouterSwapReducer(
  state: IEarnRouterSwapState,
  action: IEarnRouterSwapAction,
): IEarnRouterSwapState {
  switch (action.type) {
    case 'prepare':
      return state.status === 'idle' ? { status: 'preparing' } : state;
    case 'confirm':
      return state.status === 'preparing' ? { status: 'confirming' } : state;
    case 'sent':
      return state.status === 'confirming' ? { status: 'swapping' } : state;
    case 'landed':
      return state.status === 'swapping'
        ? { status: 'swapped', amount: action.amount, balance: action.balance }
        : state;
    case 'stop':
      return state.status === 'swapped' ? state : EARN_ROUTER_SWAP_IDLE;
    default:
      return state;
  }
}

export function buildEarnSwapToken({
  networkId,
  token,
  priceUsd,
}: {
  networkId: string;
  token: {
    address: string;
    decimals: number;
    symbol: string;
    name?: string;
    logoURI?: string;
    isNative?: boolean;
  };
  priceUsd?: string;
}): ISwapToken {
  return {
    networkId,
    contractAddress: token.isNative ? '' : token.address,
    isNative: Boolean(token.isNative),
    symbol: token.symbol,
    decimals: token.decimals,
    name: token.name ?? token.symbol,
    logoURI: token.logoURI,
    price: priceUsd,
  };
}

function isSameSwapToken(quoteToken: ISwapTokenBase, token: ISwapTokenBase) {
  if (quoteToken.networkId !== token.networkId) {
    return false;
  }
  // The swap API writes the native coin as an empty address or 0xeeee...
  if (quoteToken.isNative && token.isNative) {
    return true;
  }
  return equalTokenNoCaseSensitive({ token1: quoteToken, token2: token });
}

// A quote this path can carry out: one on-chain swap of exactly this pair
// and amount, settled by its own transaction. Signed orders settle later,
// wraps aren't swaps
export function isUsableEarnSwapQuote({
  quote,
  fromToken,
  toToken,
  amount,
}: {
  quote: IFetchQuoteResult;
  fromToken: ISwapTokenBase;
  toToken: ISwapTokenBase;
  amount: string;
}) {
  const toAmount = new BigNumber(quote.toAmount ?? '');
  if (quote.errorMessage || !toAmount.isFinite() || toAmount.lte(0)) {
    return false;
  }
  if (
    quote.swapShouldSignedData ||
    quote.isWrapped ||
    quote.shouldWrappedToken
  ) {
    return false;
  }
  if (
    !quote.fromTokenInfo ||
    !quote.toTokenInfo ||
    !isSameSwapToken(quote.fromTokenInfo, fromToken) ||
    !isSameSwapToken(quote.toTokenInfo, toToken)
  ) {
    return false;
  }
  return new BigNumber(quote.fromAmount ?? '').eq(amount);
}

// The slippage a quote asks for: the provider's suggestion, as the Swap
// page's automatic setting takes it
export const getEarnSwapSlippage = (quote: IFetchQuoteResult) =>
  quote.autoSuggestedSlippage && quote.autoSuggestedSlippage > 0
    ? quote.autoSuggestedSlippage
    : swapSlippageAutoValue;

/**
 * What goes into the deposit after the swap: what it delivered, or failing
 * the receipt what the balance gained, never more than the balance holds,
 * rounded down to what the provider takes
 */
export function getEarnSwapDepositAmount({
  receivedAmount,
  balanceBefore,
  balanceAfter,
  minToAmount,
  decimals,
}: {
  receivedAmount?: string;
  balanceBefore?: string;
  balanceAfter?: string;
  minToAmount?: string;
  decimals: number;
}) {
  const after = new BigNumber(balanceAfter ?? '');
  let amount = new BigNumber(receivedAmount ?? '');
  if (!amount.isFinite() || amount.lte(0)) {
    const before = new BigNumber(balanceBefore ?? '');
    amount =
      after.isFinite() && before.isFinite()
        ? after.minus(before)
        : new BigNumber(minToAmount ?? '');
  }
  if (after.isFinite() && after.gte(0)) {
    amount = BigNumber.min(amount, after);
  }
  if (!amount.isFinite() || amount.lte(0)) {
    return '';
  }
  return amount.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed();
}

/**
 * Max for a pay token: all of it, except the network's coin, which keeps
 * what the swap and the deposit after it cost in fees
 */
export function getEarnSwapPayMax({
  balance,
  isNative,
  reserveGas,
  decimals,
}: {
  balance: string;
  isNative?: boolean;
  reserveGas?: number | string;
  decimals: number;
}) {
  const amount = new BigNumber(balance);
  if (!amount.isFinite() || amount.lte(0)) {
    return '0';
  }
  if (!isNative) {
    return amount.toFixed();
  }
  const reserve = new BigNumber(reserveGas ?? 0);
  const kept = reserve.isFinite() && reserve.gt(0) ? reserve.times(2) : 0;
  const max = amount.minus(kept);
  return max.gt(0)
    ? max.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed()
    : '0';
}

// ---------- Pendle on the swap path ----------

// Pendle's quote less what only its buy's own execution sets (the least
// received, the fee, the route): the buy is quoted again for what the swap
// actually brings, at the second step, and shows those there. The market's
// rate before and after the buy stays
export function keepPendleMarketRows(
  quote?: IStakeTransactionConfirmation,
): IStakeTransactionConfirmation | undefined {
  const details = quote?.transactionDetails;
  if (!quote || !details?.data) {
    return quote;
  }
  return {
    ...quote,
    transactionDetails: {
      ...details,
      data: {
        ...details.data,
        transactionDetails: details.data.transactionDetails?.filter(
          (item) =>
            !item.description?.text &&
            Boolean(item.current?.title?.text || item.latest?.title?.text),
        ),
        swapRoute: undefined,
      },
    },
  };
}
