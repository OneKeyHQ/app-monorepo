import { ETranslations } from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import type { IDecodedTxExtraStarknet } from '@onekeyhq/shared/types/starknetPrivacy';
import {
  EStrk20ErrorCode,
  EStrk20ErrorRetry,
} from '@onekeyhq/shared/types/starknetPrivacy';

import {
  getStarknetPrivacyAmountError,
  getStarknetPrivacyFeeDisplay,
  getStarknetPrivateBalanceParsed,
  isStarknetPublicHistoryVisible,
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
        ETranslations.starknet_privacy_error_screening_rejected__msg,
      retryable: EStrk20ErrorRetry.No,
    });
  });

  it('falls back to the unknown, non-retryable copy for anything else', () => {
    expect(mapStrk20Error(namedError('boom'))).toEqual({
      code: EStrk20ErrorCode.Unknown,
      translationKey: ETranslations.global_an_error_occurred,
      retryable: EStrk20ErrorRetry.No,
    });
    expect(mapStrk20Error(undefined)).toEqual({
      code: EStrk20ErrorCode.Unknown,
      translationKey: ETranslations.global_an_error_occurred,
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

describe('Starknet private balance', () => {
  const address = `0x${'ab'.padStart(64, '0')}`;
  const balances = {
    byToken: { [address]: '10000000000000000001' },
    blockNumber: 100,
    noteCount: 1,
  };

  it('preserves token precision and accepts an unpadded mixed-case address', () => {
    expect(
      getStarknetPrivateBalanceParsed({
        balances,
        tokenAddress: '0xAb',
        decimals: 18,
      }),
    ).toBe('10.000000000000000001');
  });

  it('keeps the balance unknown until the scan and decimals exist', () => {
    expect(
      getStarknetPrivateBalanceParsed({
        tokenAddress: address,
        decimals: 18,
      }),
    ).toBeUndefined();
    expect(
      getStarknetPrivateBalanceParsed({ balances, tokenAddress: address }),
    ).toBeUndefined();
  });

  it('returns zero after a completed scan with no notes', () => {
    expect(
      getStarknetPrivateBalanceParsed({
        balances: { ...balances, byToken: {} },
        tokenAddress: address,
        decimals: 18,
      }),
    ).toBe('0');
  });
});

describe('Starknet public history', () => {
  it('includes ordinary transactions', () => {
    expect(isStarknetPublicHistoryVisible(undefined)).toBe(true);
  });

  it.each(['register', 'transfer', 'deposit', 'withdraw'] as const)(
    'includes %s only when it moves the public balance',
    (kind) => {
      const extraInfo: IDecodedTxExtraStarknet = {
        privacy: { kind, poolAddress: '0x1' },
      };
      expect(isStarknetPublicHistoryVisible(extraInfo)).toBe(
        kind === 'deposit' || kind === 'withdraw',
      );
    },
  );
});

describe('exact privacy amounts', () => {
  it.each(['0', '-1', 'Infinity', 'NaN'])(
    'rejects non-positive or non-finite %s',
    (amount) => {
      expect(
        getStarknetPrivacyAmountError({ amount, balance: '100', decimals: 18 }),
      ).toBe(ETranslations.defi_action_invalid_amount__msg);
    },
  );
  it('never rounds an amount beyond token precision', () => {
    expect(
      getStarknetPrivacyAmountError({
        amount: '1.0000001',
        balance: '10',
        decimals: 6,
      }),
    ).toBe(ETranslations.wallet_bulk_send_error_max_decimal_places);
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
    ).toBe(ETranslations.privacy_balance_unavailable__msg);
    expect(
      getStarknetPrivacyAmountError({
        amount: '1',
        balance: '0',
        decimals: 18,
      }),
    ).toBe(ETranslations.swap_page_button_insufficient_balance);
  });
});
