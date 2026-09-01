/* cspell:ignore Infini */
import type { ReactElement } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { createIntl } from 'react-intl';

import { showPrimeInfiniPaymentWarnings } from './PrimeInfiniPaymentWarnings';

const mockShow = jest.fn<
  void,
  [
    {
      renderContent: ReactElement;
      onConfirm: () => void;
      onClose: () => Promise<void>;
    },
  ]
>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (...args: Parameters<typeof mockShow>) => mockShow(...args),
    ScrollView: 'div',
  },
  SizableText: 'span',
  YStack: 'div',
}));

const messages: Record<string, string> = {
  'global.warning': 'Warning',
  'global.continue': 'Continue',
};
const intl = createIntl({
  locale: 'en',
  messages,
});

describe('Prime Infini warning confirmation dialog', () => {
  beforeEach(() => mockShow.mockClear());

  test.each([true, false])(
    'resolves confirmation=%s only after the dialog closes',
    async (confirmed) => {
      const result = showPrimeInfiniPaymentWarnings(
        ['First server warning', 'Second server warning'],
        intl,
      );
      const options = mockShow.mock.calls[0][0];
      const html = renderToStaticMarkup(options.renderContent);
      expect(html.indexOf('First server warning')).toBeLessThan(
        html.indexOf('Second server warning'),
      );
      if (confirmed) options.onConfirm();
      await options.onClose();
      await expect(result).resolves.toBe(confirmed);
    },
  );

  test('renders server text literally without interpreting markup or removing duplicates', async () => {
    const result = showPrimeInfiniPaymentWarnings(
      ['<script>warning</script>', '<script>warning</script>'],
      intl,
    );
    const options = mockShow.mock.calls[0][0];
    const html = renderToStaticMarkup(options.renderContent);
    expect(html).not.toContain('<script>');
    expect(html.match(/&lt;script&gt;warning/g)).toHaveLength(2);
    await options.onClose();
    await expect(result).resolves.toBe(false);
  });
});
