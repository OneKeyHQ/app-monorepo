import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { LOCALE_LOADERS } from '@onekeyhq/shared/src/locale/localeLoaders';
import type {
  IDustSweepItem,
  IDustSweepReason,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { groupDustSweepSkips } from '../utils/skipReasons';

import {
  dustSweepReasonMessageIds,
  getDustSweepItemReasonMessage,
  getDustSweepReasonMessage,
} from './DustSweepTokenRow';

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/views/Swap/components/PreSwapStep', () => ({
  SwapStepStatusIcon: () => null,
}));

describe('Dust Sweep reason messages', () => {
  it('shows trusted failed-transaction details and hides raw internal errors', async () => {
    const messages = await LOCALE_LOADERS['en-US']();
    const intl = createIntl({ locale: 'en-US', messages });
    const failed: IDustSweepItem = {
      token: {
        key: 'dust',
        networkId: 'sol--101',
        contractAddress: 'token',
        symbol: 'DUST',
        decimals: 6,
        amount: '1',
        valueUsd: '1',
        suspicious: false,
      },
      status: 'failed',
      reason: 'txFailed',
      message: 'Internal execution details',
    };
    expect(getDustSweepItemReasonMessage(intl, failed)).toBe(
      messages[dustSweepReasonMessageIds.txFailed],
    );
    expect(
      getDustSweepItemReasonMessage(intl, {
        ...failed,
        providerErrorMessage: 'Please increase slippage',
      }),
    ).toBe('Please increase slippage');
    expect(
      getDustSweepItemReasonMessage(intl, {
        ...failed,
        reason: 'unknown',
        providerErrorMessage: undefined,
      }),
    ).toBe(messages[dustSweepReasonMessageIds.unknown]);
  });

  it('prioritizes trusted API text independently of the internal skip reason', async () => {
    const messages = await LOCALE_LOADERS['en-US']();
    const intl = createIntl({ locale: 'en-US', messages });
    expect(
      getDustSweepReasonMessage(intl, 'noQuote', 'ETH', '请增加金额后重试'),
    ).toBe('请增加金额后重试');
    for (const message of [undefined, '', '  ']) {
      expect(getDustSweepReasonMessage(intl, 'noQuote', 'ETH', message)).toBe(
        messages[dustSweepReasonMessageIds.noQuote],
      );
    }
    for (const reason of Object.keys(
      dustSweepReasonMessageIds,
    ) as IDustSweepReason[]) {
      expect(
        getDustSweepReasonMessage(intl, reason, 'ETH', 'API title\nAPI detail'),
      ).toBe('API title\nAPI detail');
    }
  });

  it('uses existing App copy only when no API message is available', async () => {
    const intl = createIntl({
      locale: 'en-US',
      messages: await LOCALE_LOADERS['en-US'](),
    });
    expect(
      getDustSweepReasonMessage(intl, 'noQuote', 'ETH', undefined, {
        key: ETranslations.provider_min_amount_required,
        values: { amount: '1', token: 'DUST' },
      }),
    ).toBe('Min amount requires 1 DUST');
    expect(
      getDustSweepReasonMessage(intl, 'noQuote', 'ETH', 'API original', {
        key: ETranslations.provider_min_amount_required,
        values: { amount: '1', token: 'DUST' },
      }),
    ).toBe('API original');
  });

  it.each(Object.entries(LOCALE_LOADERS))(
    'formats reasons with the native token symbol in %s',
    async (locale, loadMessages) => {
      const messages = await loadMessages();
      const onError = jest.fn();
      const intl = createIntl({ locale, messages, onError });
      const reasons = Object.keys(
        dustSweepReasonMessageIds,
      ) as IDustSweepReason[];

      for (const reason of reasons) {
        const id = dustSweepReasonMessageIds[reason];
        expect(messages[id]).toBeTruthy();
        const message = getDustSweepReasonMessage(intl, reason, 'ETH');
        expect(message).not.toBe(id);
        expect(message).not.toContain('{symbol}');
        if (reason === 'insufficientGas') expect(message).toContain('ETH');
      }

      for (const symbol of [undefined, '', '  ']) {
        expect(getDustSweepReasonMessage(intl, 'insufficientGas', symbol)).toBe(
          intl.formatMessage({
            id: ETranslations.swap_page_button_insufficient_balance,
          }),
        );
      }

      expect(onError).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['en-US', 'Insufficient BNB for network fees'],
    ['zh-CN', 'BNB 不足以支付网络费用'],
  ] as const)(
    'uses the network fee message in %s',
    async (locale, expected) => {
      const messages = await LOCALE_LOADERS[locale]();
      const intl = createIntl({ locale, messages });
      expect(getDustSweepReasonMessage(intl, 'insufficientGas', 'BNB')).toBe(
        expected,
      );
    },
  );

  it.each(['en-US', 'zh-CN'] as const)(
    'keeps the existing slippage copy and uses the generic fallback for value-drop flags in %s',
    async (locale) => {
      const messages = await LOCALE_LOADERS[locale]();
      const intl = createIntl({ locale, messages });
      expect(getDustSweepReasonMessage(intl, 'valueDrop')).toBe(
        messages[ETranslations.global_unknown_error],
      );
      expect(getDustSweepReasonMessage(intl, 'priceImpact')).toBe(
        messages[ETranslations.toast_price_impact_exceeded_skipped],
      );
    },
  );

  it('groups by the same trusted text that token rows display', async () => {
    const messages = await LOCALE_LOADERS['en-US']();
    const intl = createIntl({ locale: 'en-US', messages });
    const items: IDustSweepItem[] = [
      'First API error',
      'Second API error',
      ' First API error ',
    ].map((providerErrorMessage, index) => ({
      token: {
        key: String(index),
        networkId: 'evm--1',
        contractAddress: String(index),
        symbol: 'DUST',
        decimals: 18,
        amount: '1',
        valueUsd: '1',
        suspicious: false,
      },
      status: 'skipped',
      reason: 'valueDrop',
      providerErrorMessage,
    }));
    const groups = groupDustSweepSkips(items, (item) =>
      getDustSweepItemReasonMessage(intl, item),
    );
    expect(groups.map((group) => [group.label, group.tokens.length])).toEqual([
      ['First API error', 2],
      ['Second API error', 1],
    ]);
  });
});
