import type { IDecodedTxExtraStarknet } from '@onekeyhq/core/src/chains/starknet/types';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import {
  EStrk20ErrorCode,
  EStrk20ErrorRetry,
} from '@onekeyhq/shared/types/starknetPrivacy';

import {
  formatStrk20Countdown,
  getStarknetPrivacyAmountError,
  getStarknetPrivacyBalanceDisplay,
  getStarknetPrivacyFeeDisplay,
  isStarknetPrivacyHistoryVisible,
  readStarknetPrivacyBlock,
} from './starknetPrivacyUtils';

describe('Starknet privacy fee display', () => {
  const extraInfo: IDecodedTxExtraStarknet = {
    privacy: {
      kind: 'deposit',
      poolAddress: '0x1',
      amount: '3000000000000000000',
      protocolFee: '4500000000000000000',
    },
  };

  it('includes the protocol fee exactly once without counting principal as a fee', () => {
    expect(
      getStarknetPrivacyFeeDisplay({
        extraInfos: [extraInfo],
        decimals: 18,
        networkFeeNative: '2.2',
        nativeTokenPrice: 0.03,
      }),
    ).toEqual({
      totalNative: '6.7',
      totalFiat: '0.201',
    });
    expect(extraInfo.privacy?.protocolFee).toBe('4500000000000000000');
  });

  it('includes each transaction fee in a batch', () => {
    expect(
      getStarknetPrivacyFeeDisplay({
        extraInfos: [extraInfo, null, extraInfo],
        decimals: 18,
        networkFeeNative: '4.4',
      }),
    ).toMatchObject({ totalNative: '13.4' });
  });

  it.each([undefined, 'NaN', 'Infinity', '-1', ''])(
    'does not invent a total without a usable network estimate (%s)',
    (networkFeeNative) => {
      expect(
        getStarknetPrivacyFeeDisplay({
          extraInfos: [extraInfo],
          decimals: 18,
          networkFeeNative,
        }),
      ).toEqual({
        totalNative: undefined,
        totalFiat: undefined,
      });
    },
  );

  it('displays a protocol fee of zero when that is what the pool quoted', () => {
    const freePool: IDecodedTxExtraStarknet = {
      privacy: { kind: 'transfer', poolAddress: '0x1', protocolFee: '0' },
    };
    expect(
      getStarknetPrivacyFeeDisplay({
        extraInfos: [freePool],
        decimals: 18,
        networkFeeNative: '0.03',
      }),
    ).toEqual({
      totalNative: '0.03',
      totalFiat: undefined,
    });
  });

  it('leaves ordinary network fees alone', () => {
    expect(
      getStarknetPrivacyFeeDisplay({ extraInfos: [null], decimals: 18 }),
    ).toBeUndefined();
    expect(
      getStarknetPrivacyFeeDisplay({ extraInfos: [extraInfo] }),
    ).toBeUndefined();
  });

  it.each([undefined, 0])(
    'keeps fiat unknown without a price (%s)',
    (price) => {
      expect(
        getStarknetPrivacyFeeDisplay({
          extraInfos: [extraInfo],
          decimals: 18,
          networkFeeNative: '2.2',
          nativeTokenPrice: price,
        })?.totalFiat,
      ).toBeUndefined();
    },
  );
});

describe('formatStrk20Countdown', () => {
  it('collapses non-positive and non-finite input to zero', () => {
    expect(formatStrk20Countdown(0)).toBe('0s');
    expect(formatStrk20Countdown(-5)).toBe('0s');
    expect(formatStrk20Countdown(Number.NaN)).toBe('0s');
    expect(formatStrk20Countdown(Number.POSITIVE_INFINITY)).toBe('0s');
  });

  it('rounds up to whole seconds below a minute', () => {
    expect(formatStrk20Countdown(1)).toBe('1s');
    expect(formatStrk20Countdown(30.2)).toBe('31s');
    expect(formatStrk20Countdown(59)).toBe('59s');
  });

  it('renders minutes, dropping a zero seconds remainder', () => {
    expect(formatStrk20Countdown(60)).toBe('1m');
    expect(formatStrk20Countdown(90)).toBe('1m 30s');
    expect(formatStrk20Countdown(300)).toBe('5m');
    expect(formatStrk20Countdown(3599)).toBe('59m 59s');
  });

  it('renders hours, dropping a zero minutes remainder', () => {
    expect(formatStrk20Countdown(3600)).toBe('1h');
    expect(formatStrk20Countdown(3660)).toBe('1h 1m');
    expect(formatStrk20Countdown(7380)).toBe('2h 3m');
  });
});

describe('mapStrk20Error (kit-bg import wiring)', () => {
  // Built by shape, not by importing the SDK's classes, matching
  // strk20Errors.test.ts's own contract for this function.
  function namedError(name: string) {
    const error = new Error('boom');
    Object.defineProperty(error, 'name', { value: name });
    return error;
  }

  it('maps a ScreeningRejected-shaped error to non-retryable copy', () => {
    expect(mapStrk20Error(namedError('ScreeningRejected'))).toEqual({
      code: EStrk20ErrorCode.ScreeningRejected,
      translationKey:
        ETranslationsMock.starknet_privacy_error_screening_rejected,
      retryable: EStrk20ErrorRetry.No,
    });
  });

  it('falls back to the unknown, non-retryable copy for anything else', () => {
    expect(mapStrk20Error(namedError('boom'))).toEqual({
      code: EStrk20ErrorCode.Unknown,
      translationKey: ETranslationsMock.starknet_privacy_error_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(undefined)).toEqual({
      code: EStrk20ErrorCode.Unknown,
      translationKey: ETranslationsMock.starknet_privacy_error_unknown,
      retryable: EStrk20ErrorRetry.No,
    });
  });
});

describe('readStarknetPrivacyBlock', () => {
  it('returns undefined when extraInfo is absent or carries no block', () => {
    expect(readStarknetPrivacyBlock(undefined)).toBeUndefined();
    expect(readStarknetPrivacyBlock(null)).toBeUndefined();
    const extraInfo: IDecodedTxExtraStarknet = {};
    expect(readStarknetPrivacyBlock(extraInfo)).toBeUndefined();
  });

  it('returns the privacy block as-is when extraInfo carries one', () => {
    const extraInfo: IDecodedTxExtraStarknet = {
      privacy: {
        kind: 'withdraw',
        poolAddress: '0x1',
        amount: '100',
      },
    };
    expect(readStarknetPrivacyBlock(extraInfo)).toEqual(extraInfo.privacy);
  });
});

describe('Starknet public / private balances', () => {
  const address = `0x${'ab'.padStart(64, '0')}`;
  const balances = {
    byToken: { [address]: '10000000000000000001' },
    blockNumber: 100,
    noteCount: 1,
  };

  it('preserves token precision and accepts an unpadded mixed-case address', () => {
    expect(
      getStarknetPrivacyBalanceDisplay({
        balances,
        tokenAddress: '0xAb',
        decimals: 18,
        publicBalanceParsed: '66.200107901543245744',
      }),
    ).toEqual({
      privateBalanceParsed: '10.000000000000000001',
      totalBalanceParsed: '76.200107901543245745',
    });
  });

  it('keeps private and total balances unknown until the scan and decimals exist', () => {
    expect(
      getStarknetPrivacyBalanceDisplay({
        tokenAddress: address,
        decimals: 18,
        publicBalanceParsed: '66.2',
      }),
    ).toEqual({});
    expect(
      getStarknetPrivacyBalanceDisplay({ balances, tokenAddress: address }),
    ).toEqual({});
  });

  it('distinguishes a completed scan with no notes from an unknown public balance', () => {
    expect(
      getStarknetPrivacyBalanceDisplay({
        balances: { ...balances, byToken: {} },
        tokenAddress: address,
        decimals: 18,
        publicBalanceParsed: '66.2',
      }),
    ).toEqual({ privateBalanceParsed: '0', totalBalanceParsed: '66.2' });
    expect(
      getStarknetPrivacyBalanceDisplay({
        balances,
        tokenAddress: address,
        decimals: 18,
      }),
    ).toEqual({
      privateBalanceParsed: '10.000000000000000001',
      totalBalanceParsed: undefined,
    });
  });
});

describe('Starknet public / private history', () => {
  it('keeps an ordinary transaction on the public tab', () => {
    expect(
      isStarknetPrivacyHistoryVisible({ extraInfo: undefined, mode: 'public' }),
    ).toBe(true);
    expect(
      isStarknetPrivacyHistoryVisible({
        extraInfo: undefined,
        mode: 'private',
      }),
    ).toBe(false);
  });

  it.each(['register', 'transfer', 'deposit', 'withdraw'] as const)(
    'places %s on the relevant sides only',
    (kind) => {
      const extraInfo: IDecodedTxExtraStarknet = {
        privacy: { kind, poolAddress: '0x1' },
      };
      expect(
        isStarknetPrivacyHistoryVisible({ extraInfo, mode: 'private' }),
      ).toBe(true);
      expect(
        isStarknetPrivacyHistoryVisible({ extraInfo, mode: 'public' }),
      ).toBe(kind === 'deposit' || kind === 'withdraw');
    },
  );
});

describe('exact privacy amounts', () => {
  it.each(['0', '-1', 'Infinity', 'NaN'])(
    'rejects non-positive or non-finite %s',
    (amount) => {
      expect(
        getStarknetPrivacyAmountError({ amount, balance: '100', decimals: 18 }),
      ).toBe(ETranslationsMock.starknet_privacy_amount_required);
    },
  );
  it('never rounds an amount beyond token precision', () => {
    expect(
      getStarknetPrivacyAmountError({
        amount: '1.0000001',
        balance: '10',
        decimals: 6,
      }),
    ).toBe(ETranslationsMock.starknet_privacy_amount_precision);
    expect(
      getStarknetPrivacyAmountError({
        amount: '1.000001',
        balance: '10',
        decimals: 6,
      }),
    ).toBeUndefined();
  });
  it('keeps unknown balances blocked and distinguishes a known zero', () => {
    expect(
      getStarknetPrivacyAmountError({
        amount: '1',
        balance: undefined,
        decimals: 18,
      }),
    ).toBe(ETranslationsMock.starknet_privacy_error_balance);
    expect(
      getStarknetPrivacyAmountError({
        amount: '1',
        balance: '0',
        decimals: 18,
      }),
    ).toBe(ETranslationsMock.starknet_privacy_amount_exceeds_available);
  });
});
