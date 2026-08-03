import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import {
  FUNDING_INTENT_DISARM_GRACE_MS,
  getFundingIntentDisarmDelayMs,
  matchesFundingIntent,
  shouldDisarmFundingIntentOnFocus,
} from './useEModeFundingTx';

const NETWORK_ID = 'evm--1';
const ACCOUNT_ID = 'hd-1--m/44/60/0/0/0';
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

const intent = {
  stepKey: 'repay:usdt',
  tokenAddress: USDT.toLowerCase(),
  armedAt: 1000,
};

function buildHistory(
  overrides: {
    contractAddress?: string;
    networkId?: string;
    receiverAccountId?: string;
    created?: number;
  } = {},
): ISwapTxHistory {
  const {
    contractAddress = USDT.toLowerCase(),
    networkId = NETWORK_ID,
    receiverAccountId = ACCOUNT_ID,
    created = 2000,
  } = overrides;
  return {
    baseInfo: {
      toToken: { contractAddress, networkId },
    },
    accountInfo: {
      receiver: { accountId: receiverAccountId, networkId },
    },
    date: { created },
  } as unknown as ISwapTxHistory;
}

describe('matchesFundingIntent', () => {
  const match = (history: ISwapTxHistory) =>
    matchesFundingIntent({
      history,
      intent,
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
    });

  it('matches a swap delivering the funding token to this account', () => {
    expect(match(buildHistory())).toBe(true);
  });

  it('ignores address casing, which differs across swap providers', () => {
    expect(match(buildHistory({ contractAddress: USDT }))).toBe(true);
  });

  it('rejects a swap delivering a different token', () => {
    expect(
      match(
        buildHistory({ contractAddress: '0x0000000000000000000000000001' }),
      ),
    ).toBe(false);
  });

  it('rejects a swap landing on another network', () => {
    expect(match(buildHistory({ networkId: 'evm--8453' }))).toBe(false);
  });

  it('rejects a swap received by a different account', () => {
    expect(match(buildHistory({ receiverAccountId: 'hd-1--other' }))).toBe(
      false,
    );
  });

  it('rejects a swap that predates the detour', () => {
    // An unrelated swap already in flight when the user opened this screen must
    // not be mistaken for the top-up and pull them out of wherever they are.
    expect(match(buildHistory({ created: 999 }))).toBe(false);
  });

  it('rejects a swap whose receiver account is unknown', () => {
    // An incomplete history entry cannot safely drive automatic navigation.
    expect(match(buildHistory({ receiverAccountId: '' }))).toBe(false);
  });

  it('matches a native-token top-up, where the address is the empty sentinel', () => {
    expect(
      matchesFundingIntent({
        history: buildHistory({ contractAddress: '' }),
        intent: { ...intent, tokenAddress: '' },
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).toBe(true);
  });

  it('does not treat a missing toToken address as a native match', () => {
    const history = buildHistory();
    (history.baseInfo.toToken as { contractAddress?: string }).contractAddress =
      undefined;
    expect(
      matchesFundingIntent({
        history,
        intent: { ...intent, tokenAddress: '' },
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).toBe(false);
  });
});

describe('shouldDisarmFundingIntentOnFocus', () => {
  it('does not disarm on the initial focused render', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: true,
        previousIsFocused: undefined,
        fundingTxKey: null,
      }),
    ).toBe(false);
  });

  it('disarms when a Swap detour returns without a pending transaction', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: true,
        previousIsFocused: false,
        fundingTxKey: null,
      }),
    ).toBe(true);
  });

  it('keeps the intent when the selected Swap has produced a transaction', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: true,
        previousIsFocused: false,
        fundingTxKey: '0xtx',
      }),
    ).toBe(false);
  });

  it('does not disarm while the Swap detour is still covering the page', () => {
    expect(
      shouldDisarmFundingIntentOnFocus({
        isFocused: false,
        previousIsFocused: true,
        fundingTxKey: null,
      }),
    ).toBe(false);
  });
});

describe('getFundingIntentDisarmDelayMs', () => {
  it('holds the disarm while a just-broadcast transaction can still arrive', () => {
    expect(getFundingIntentDisarmDelayMs({ armedAt: 1000, now: 1200 })).toBe(
      FUNDING_INTENT_DISARM_GRACE_MS - 200,
    );
  });

  it('disarms immediately once the grace window has closed', () => {
    expect(
      getFundingIntentDisarmDelayMs({
        armedAt: 1000,
        now: 1000 + FUNDING_INTENT_DISARM_GRACE_MS,
      }),
    ).toBe(0);
  });

  it('disarms immediately when no intent is armed', () => {
    expect(getFundingIntentDisarmDelayMs({ armedAt: null, now: 1200 })).toBe(0);
  });
});
