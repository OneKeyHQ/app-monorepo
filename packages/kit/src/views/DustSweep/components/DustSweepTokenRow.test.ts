import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { LOCALE_LOADERS } from '@onekeyhq/shared/src/locale/localeLoaders';
import type { IDustSweepReason } from '@onekeyhq/shared/types/swap/dustSweep';

import {
  dustSweepReasonMessageIds,
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

  it.each([
    ['en-US', 'High value drop'],
    ['zh-CN', '高价值损失'],
  ] as const)(
    'distinguishes value drop from price impact in %s',
    async (locale, expected) => {
      const messages = await LOCALE_LOADERS[locale]();
      const intl = createIntl({ locale, messages });
      expect(getDustSweepReasonMessage(intl, 'valueDrop')).toBe(expected);
    },
  );
});
