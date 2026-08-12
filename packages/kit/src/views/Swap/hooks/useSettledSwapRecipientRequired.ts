import { useRef } from 'react';

import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapRecipientRequiredScopeKey,
  resolveSettledSwapRecipientRequired,
} from './useSwapAccount.utils';

type IUseSettledSwapRecipientRequiredParams = {
  swapType: ESwapTabSwitchType;
  fromToken?: { networkId?: string; contractAddress?: string };
  toToken?: { networkId?: string; contractAddress?: string };
  sourceAccountId?: string;
  /** A quote for the current input settled, with or without a result. */
  quoteSettled: boolean;
  isAddressInfoReady: boolean;
  recipientRequiredNow: boolean;
};

/**
 * Whether the recipient entry must be shown, held steady across a quote cycle.
 *
 * The raw verdict flips false during every quote refresh window, which would
 * collapse and re-expand the entry on each round; holding it keeps the row
 * still. The hold is scoped to one quote round because switching tab clears
 * the quote list and resets quoteEventCompleted without ever settling a quote,
 * so an unscoped verdict would leak into the next tab. (OK-58326)
 */
export function useSettledSwapRecipientRequired({
  swapType,
  fromToken,
  toToken,
  sourceAccountId,
  quoteSettled,
  isAddressInfoReady,
  recipientRequiredNow,
}: IUseSettledSwapRecipientRequiredParams) {
  const scopeKey = buildSwapRecipientRequiredScopeKey({
    swapType,
    fromToken,
    toToken,
    sourceAccountId,
  });
  // Start neutral so the very first render still has to clear the settled +
  // address-ready gate below, instead of adopting a verdict built on a target
  // address that has not resolved yet.
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
