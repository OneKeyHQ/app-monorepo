import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { LOCALE_LOADERS } from '@onekeyhq/shared/src/locale/localeLoaders';

import {
  getSwapBalanceInsufficientMessage,
  getSwapQuoteLimitError,
  getSwapQuoteLimitMessage,
} from './swapErrorUtils';

it.each([
  [
    '0.999999999999999999',
    { min: '1' },
    ETranslations.provider_min_amount_required,
  ],
  ['1', { min: '1' }, undefined],
  ['1', { max: '1' }, undefined],
  [
    '1.000000000000000001',
    { max: '1' },
    ETranslations.provider_max_amount_required,
  ],
  ['10', { min: '1', max: '20' }, undefined],
  ['10', undefined, undefined],
] as const)(
  'uses strict decimal amount limits (%s, %j)',
  (fromTokenAmount, limit, messageId) => {
    expect(getSwapQuoteLimitError({ limit, fromTokenAmount })?.key).toBe(
      messageId,
    );
  },
);

it.each(['en-US', 'zh-CN'] as const)(
  'formats the existing Swap copy in %s',
  async (locale) => {
    const intl = createIntl({
      locale,
      messages: await LOCALE_LOADERS[locale](),
    });
    expect(
      getSwapQuoteLimitMessage({
        intl,
        limit: { min: '1' },
        fromTokenAmount: '0.5',
        fromTokenSymbol: 'DUST',
      }),
    ).toBe(
      intl.formatMessage(
        { id: ETranslations.provider_min_amount_required },
        { amount: '1', token: 'DUST' },
      ),
    );
    expect(
      getSwapQuoteLimitMessage({
        intl,
        limit: { max: '1' },
        fromTokenAmount: '2',
        fromTokenSymbol: 'DUST',
      }),
    ).toBe(
      intl.formatMessage(
        { id: ETranslations.provider_max_amount_required },
        { amount: '1', token: 'DUST' },
      ),
    );
    const balance = getSwapBalanceInsufficientMessage({
      intl,
      networkId: 'evm--1',
      tokenSymbol: 'ETH',
      reserveAmount: '0.01',
    });
    expect(balance.title).toBe(
      intl.formatMessage(
        { id: ETranslations.swap_page_toast_insufficient_balance_title },
        { token: 'ETH' },
      ),
    );
    expect(balance.message).toBe(
      intl.formatMessage(
        { id: ETranslations.swap_page_toast_insufficient_balance_content },
        { token: 'ETH', number: '0.01' },
      ),
    );
    expect(
      getSwapBalanceInsufficientMessage({
        intl,
        networkId: 'btc--0',
        tokenSymbol: 'BTC',
        reserveAmount: '0.01',
      }),
    ).toEqual({
      title: intl.formatMessage({
        id: ETranslations.send_toast_btc_fork_insufficient_fund,
      }),
      message: undefined,
    });
  },
);
