/* cspell:ignore Infini */
import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import zhCN from '@onekeyhq/shared/src/locale/json/zh_CN.json';

import { showPrimeInfiniUnfinishedPaymentDialog } from './showPrimeInfiniUnfinishedPaymentDialog';

type IWarning = {
  title: string;
  description: string;
  onConfirmText: string;
  onCancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
};
const mockShow = jest.fn<void, [IWarning]>();
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (...args: Parameters<typeof mockShow>) => mockShow(...args) },
}));
const messages: Record<string, string> = {
  [ETranslations.prime_unfinished_payment__title]: 'Unfinished payment',
  [ETranslations.prime_unfinished_payment__desc]:
    'The previous transfer may still complete. Starting a new payment could result in a duplicate payment.',
  [ETranslations.prime_start_new_payment__action]: 'Start new payment',
  [ETranslations.prime_keep_waiting__action]: 'Keep waiting',
  [ETranslations.global_continue]: 'Continue',
  [ETranslations.global_cancel]: 'Cancel',
};
const intl = createIntl({ locale: 'en', onError: () => undefined, messages });
const chineseMessages: Record<string, string> = zhCN;

describe('existing unfinished-payment warning', () => {
  beforeEach(() => mockShow.mockClear());
  it('reuses the current device warning and copy for a discovered order', async () => {
    const result = showPrimeInfiniUnfinishedPaymentDialog({
      intl,
      canResume: true,
    });
    const warning = mockShow.mock.calls[0][0];
    expect(warning.title).toBe('Unfinished payment');
    expect(warning.description).toBe(
      'The previous transfer may still complete. Starting a new payment could result in a duplicate payment.',
    );
    expect(warning.onConfirmText).toBe('Start new payment');
    expect(warning.onCancelText).toBe('Keep waiting');
    warning.onCancel();
    warning.onClose();
    await expect(result).resolves.toBe('resume');
  });
  it('localizes lookup failure and the risk warning without asserting an existing order', async () => {
    const result = showPrimeInfiniUnfinishedPaymentDialog({
      intl: createIntl({ locale: 'zh-CN', messages: chineseMessages }),
      canResume: false,
      lookupUnavailable: true,
    });
    const warning = mockShow.mock.calls[0][0];
    expect(warning.title).toBe(zhCN.prime_payment_refresh_failed__title);
    expect(warning.description).toBe(zhCN.prime_unfinished_payment__desc);
    expect(warning.onConfirmText).toBe(zhCN['global.continue']);
    expect(warning.onCancelText).toBe(zhCN['global.cancel']);
    warning.onConfirm();
    warning.onClose();
    await expect(result).resolves.toBe('replace');
  });
  it.each([false, true])(
    'never resumes missing/unreliable recovery data, unavailable=%s',
    async (lookupUnavailable) => {
      const result = showPrimeInfiniUnfinishedPaymentDialog({
        intl,
        canResume: false,
        lookupUnavailable,
      });
      const warning = mockShow.mock.calls[0][0];
      warning.onCancel();
      warning.onClose();
      await expect(result).resolves.toBe('cancel');
    },
  );
  it('does not authorize a new payment on dismissal or before the warning closes', async () => {
    const dismissed = showPrimeInfiniUnfinishedPaymentDialog({
      intl,
      canResume: false,
    });
    mockShow.mock.calls[0][0].onClose();
    await expect(dismissed).resolves.toBe('cancel');
    let finished = false;
    const confirmed = showPrimeInfiniUnfinishedPaymentDialog({
      intl,
      canResume: false,
    }).then((choice) => {
      finished = true;
      return choice;
    });
    const warning = mockShow.mock.calls[1][0];
    warning.onConfirm();
    await Promise.resolve();
    expect(finished).toBe(false);
    warning.onClose();
    await expect(confirmed).resolves.toBe('replace');
  });
});
