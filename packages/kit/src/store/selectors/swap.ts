import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectSwap = (state: IAppState) => state.swap;

export const selectSwapInputToken = createSelector(
  selectSwap,
  (s) => s.inputToken,
);

export const selectSwapOutputToken = createSelector(
  selectSwap,
  (s) => s.outputToken,
);

export const selectSwapMode = createSelector(selectSwap, (s) => s.mode);

export const selectSwapLoading = createSelector(selectSwap, (s) => s.loading);

export const selectSwapQuote = createSelector(selectSwap, (s) => s.quote);

export const selectSwapResponses = createSelector(
  selectSwap,
  (s) => s.responses,
);

export const selectSwapSendingAccount = createSelector(
  selectSwap,
  (s) => s.sendingAccount,
);

export const selectSwapIndependentField = createSelector(
  selectSwap,
  (s) => s.independentField,
);

export const selectSwapTypedValue = createSelector(
  selectSwap,
  (s) => s.typedValue,
);

export const selectSwapError = createSelector(selectSwap, (s) => s.error);

export const selectSwapRecipient = createSelector(
  selectSwap,
  (s) => s.recipient,
);

export const selectSwapAllowAnotherRecipientAddress = createSelector(
  selectSwap,
  (s) => s.allowAnotherRecipientAddress,
);

export const selectSwapInputTokenNetwork = createSelector(
  selectSwap,
  (s) => s.inputTokenNetwork,
);

export const selectSwapOutputTokenNetwork = createSelector(
  selectSwap,
  (s) => s.outputTokenNetwork,
);

export const selectSwapQuoteLimited = createSelector(
  selectSwap,
  (s) => s.quoteLimited,
);

export const selectSwapShowMoreQuoteDetail = createSelector(
  selectSwap,
  (s) => s.showMoreQuoteDetail,
);
