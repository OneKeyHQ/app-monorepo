import { useRef } from 'react';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapRecipientRequiredScopeKey,
  resolveSettledSwapRecipientRequired,
} from './useSwapAccount.utils';

type ISwapRecipientScopeToken = {
  networkId?: string;
  contractAddress?: string;
};

type IUseSettledSwapRecipientRequiredParams = {
  swapType: ESwapTabSwitchType;
  fromToken?: ISwapRecipientScopeToken;
  toToken?: ISwapRecipientScopeToken;
  sourceAccountId?: string;
  /**
   * The currently selected quote, straight from the selection atom. The
   * selection layer intentionally keeps a previous actionable quote visible
   * while a new round is requesting, so this hook never trusts its presence
   * alone — it only counts as settled for the scope when its token pair
   * matches the current selection.
   */
  quoteResult?: {
    toAmount?: string;
    fromTokenInfo?: ISwapRecipientScopeToken;
    toTokenInfo?: ISwapRecipientScopeToken;
  };
  /**
   * Proof that quoteResult belongs to the active quote round for the current
   * inputs (event id membership plus the request lock matching the current
   * account/pair/amount). Token-pair equality alone cannot provide this: a
   * same-pair account switch keeps the previous account's quote AND its event
   * as "current" until the new request is written.
   */
  quoteProvenForCurrentInput: boolean;
  /** The current input's quote round completed with no result at all. */
  quoteSettledWithoutResult: boolean;
  isAddressInfoReady: boolean;
  hasTargetAddress: boolean;
  noConnectWallet: boolean;
};

/**
 * Whether the recipient entry must be shown, held steady across a quote cycle.
 *
 * The raw verdict flips false during every quote refresh window, which would
 * collapse and re-expand the entry on each round; holding it keeps the row
 * still. The hold is scoped to one quote round (tab, pair, source account),
 * and a verdict is only adopted from a quote that belongs to that scope: the
 * selection layer can retain the previous pair's actionable quote during the
 * transition renders right after a switch, and that quote must not decide the
 * new scope. (OK-58326)
 */
export function useSettledSwapRecipientRequired({
  swapType,
  fromToken,
  toToken,
  sourceAccountId,
  quoteResult,
  quoteProvenForCurrentInput,
  quoteSettledWithoutResult,
  isAddressInfoReady,
  hasTargetAddress,
  noConnectWallet,
}: IUseSettledSwapRecipientRequiredParams) {
  const scopeKey = buildSwapRecipientRequiredScopeKey({
    swapType,
    fromToken,
    toToken,
    sourceAccountId,
  });
  const quoteMatchesSelectedPair = Boolean(
    quoteResult &&
    equalTokenNoCaseSensitive({
      token1: quoteResult.fromTokenInfo,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: quoteResult.toTokenInfo,
      token2: toToken,
    }),
  );
  const quoteUsableForScope =
    quoteMatchesSelectedPair && quoteProvenForCurrentInput;
  const quoteSettled = quoteUsableForScope || quoteSettledWithoutResult;
  const recipientRequiredNow = Boolean(
    quoteUsableForScope &&
    quoteResult?.toAmount &&
    !hasTargetAddress &&
    !noConnectWallet,
  );
  // Start neutral: every adoption, including the mount render, must pass the
  // resolver's settled + address-ready gates.
  const settledRef = useRef({ scopeKey, value: false });
  settledRef.current = resolveSettledSwapRecipientRequired({
    previous: settledRef.current,
    scopeKey,
    quoteSettled,
    isAddressInfoReady,
    recipientRequiredNow,
  });
  return settledRef.current.value;
}
