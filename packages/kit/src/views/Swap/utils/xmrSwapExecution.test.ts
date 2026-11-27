import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
} from '@onekeyhq/shared/types/swap/types';

import {
  assertXmrSwapBalance,
  assertXmrSwapSyncReady,
  getXmrSwapOrderDeadline,
  readXmrSwapAmountAtomic,
  readXmrSwapTotalAtomic,
  readXmrSwapTransfer,
} from './xmrSwapExecution';

const intl = createIntl({
  locale: 'en',
  onError: (error) => {
    if (error.code !== 'MISSING_TRANSLATION') throw error;
  },
});
const invalidOrderMessage = intl.formatMessage({
  id: ETranslations.privacy_error_build_failed__msg,
});

const quote: IFetchQuoteResult = {
  info: { provider: 'SwapRocketX', providerName: 'RocketX' },
  fromTokenInfo: {
    networkId: 'xmr--0',
    contractAddress: '',
    decimals: 12,
    symbol: 'XMR',
    isNative: true,
  },
  toTokenInfo: {
    networkId: 'evm--1',
    contractAddress: '',
    decimals: 18,
    symbol: 'ETH',
    isNative: true,
  },
  fromAmount: '1.000000000001',
};

const order = {
  orderId: 'rocket-order',
  payinAddress: 'provider-pay-in-address',
  amountExpectedFrom: '1.000000000001',
};

const build: IFetchBuildTxResponse = {
  result: quote,
  orderId: 'service-order',
  changellyOrder: order,
  ctx: { rocketXOrderId: order.orderId },
};

describe('Monero Swap execution', () => {
  it('only uses exact representable amounts for provider orders', () => {
    expect(readXmrSwapAmountAtomic('0.000000000001')).toBe('1');
    expect(readXmrSwapAmountAtomic('0.0000000000001')).toBeUndefined();
    expect(readXmrSwapAmountAtomic('0')).toBeUndefined();
    expect(readXmrSwapAmountAtomic('18446744.073709551616')).toBeUndefined();
    expect(readXmrSwapAmountAtomic('1e-9')).toBeUndefined();
    expect(
      readXmrSwapTransfer({ build, quote, sender: 'owner-address', intl }),
    ).toMatchObject({
      to: order.payinAddress,
      amount: order.amountExpectedFrom,
    });
    expect(() =>
      readXmrSwapTransfer({
        build: {
          ...build,
          changellyOrder: { ...order, amountExpectedFrom: '1.000000000002' },
        },
        quote,
        sender: 'owner-address',
        intl,
      }),
    ).toThrow(invalidOrderMessage);
  });

  it('refuses a memo, unsupported destination or missing order identifier', () => {
    const read = (response: IFetchBuildTxResponse) =>
      readXmrSwapTransfer({
        build: response,
        quote,
        sender: 'owner-address',
        intl,
      });
    expect(() =>
      read({ ...build, changellyOrder: { ...order, payinExtraId: '123' } }),
    ).toThrow('This provider requires a memo');
    expect(() =>
      read({
        ...build,
        result: {
          ...quote,
          toTokenInfo: { ...quote.toTokenInfo, contractAddress: '0x01' },
        },
      }),
    ).toThrow(invalidOrderMessage);
    expect(() => read({ ...build, orderId: undefined })).toThrow(
      invalidOrderMessage,
    );
    expect(() => read({ ...build, ctx: { rocketXOrderId: 'other' } })).toThrow(
      invalidOrderMessage,
    );
  });

  it('checks the local prepared amount and recipient and adds the actual fee', () => {
    const transfer = readXmrSwapTransfer({
      build,
      quote,
      sender: 'owner-address',
      intl,
    });
    const prepared = {
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount,
      amountAtomic: '1000000000001',
      feeAtomic: '7',
      priority: 'normal' as const,
    };
    expect(readXmrSwapTotalAtomic(prepared, transfer)).toBe('1000000000008');
    expect(
      readXmrSwapTotalAtomic({ ...prepared, isMaxSend: true }, transfer),
    ).toBeUndefined();
    expect(
      readXmrSwapTotalAtomic({ ...prepared, to: 'other' }, transfer),
    ).toBeUndefined();
    expect(
      readXmrSwapTotalAtomic({ ...prepared, amountAtomic: '1' }, transfer),
    ).toBeUndefined();
  });

  it('anchors the order expiry to the request instead of the confirmation', () => {
    expect(getXmrSwapOrderDeadline(1000, 5)).toBe(6000);
    expect(getXmrSwapOrderDeadline(1000, 0)).toBe(1000);
    expect(getXmrSwapOrderDeadline(1000, NaN)).toBe(1000);
    expect(getXmrSwapOrderDeadline(1000)).toBeUndefined();
  });

  it('distinguishes paused, disabled and the 100-block sync boundary', () => {
    expect(() =>
      assertXmrSwapSyncReady({
        state: { enabled: false, paused: false },
        intl,
      }),
    ).toThrow('Turn on privacy sync');
    expect(() =>
      assertXmrSwapSyncReady({ state: { enabled: false, paused: true }, intl }),
    ).toThrow('Sync paused');
    expect(() =>
      assertXmrSwapSyncReady({
        state: { enabled: true, paused: false },
        readiness: { blocksLeft: 100, canSend: false },
        intl,
      }),
    ).toThrow('100 blocks left');
    expect(() =>
      assertXmrSwapSyncReady({
        state: { enabled: true, paused: false },
        readiness: { blocksLeft: 99, canSend: true },
        intl,
      }),
    ).not.toThrow();
  });

  it('blocks a pending send even when spendable is sufficient and distinguishes frozen funds', () => {
    const balance = {
      spendable: '100',
      pools: [],
      frozen: [{ reason: 'confirming' as const, amountParsed: '0.25' }],
    };
    expect(() =>
      assertXmrSwapBalance({
        amountAtomic: '100',
        balance,
        pending: true,
        intl,
      }),
    ).toThrow(
      intl.formatMessage({ id: ETranslations.privacy_error_pending_send__msg }),
    );
    expect(() =>
      assertXmrSwapBalance({
        amountAtomic: '101',
        balance,
        pending: false,
        intl,
      }),
    ).toThrow('0.25 XMR not yet spendable');
  });
});
