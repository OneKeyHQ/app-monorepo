/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { BorrowBalanceText } from './BorrowBalanceText';

jest.mock('@onekeyhq/components', () => ({
  NumberSizeableText: ({
    children,
    autoFormatter,
    autoFormatterThreshold,
    accessibilityLabel,
    'aria-label': ariaLabel,
    formatterOptions,
  }: {
    children: string;
    autoFormatter: string;
    autoFormatterThreshold?: number;
    accessibilityLabel?: string;
    'aria-label'?: string;
    formatterOptions?: { currency?: string };
  }) => {
    const { formatDisplayNumber, formatBalance, formatMarketCap, formatValue } =
      jest.requireActual<
        typeof import('@onekeyhq/shared/src/utils/numberUtils')
      >('@onekeyhq/shared/src/utils/numberUtils');
    let formatter =
      autoFormatter === 'value-marketCap' ? formatValue : formatBalance;
    if (Number(children) >= (autoFormatterThreshold ?? 1_000_000)) {
      formatter = formatMarketCap;
    }
    const result = formatDisplayNumber(formatter(children, formatterOptions));
    return (
      <span
        data-formatter={autoFormatter}
        data-threshold={autoFormatterThreshold}
        aria-label={ariaLabel}
        data-native-label={accessibilityLabel}
      >
        {Array.isArray(result)
          ? result
              .map((part) =>
                typeof part === 'string' ? part : `[${part.value}]`,
              )
              .join('')
          : result}
      </span>
    );
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: ({ text }: { text?: { text: string } }) => (
      <span>{text?.text}</span>
    ),
  }),
);

describe('BorrowBalanceText', () => {
  it.each([
    ['1234.56', '1.23K'],
    ['999.99', '999.99'],
    ['1000', '1K'],
    ['999999.99', '1M'],
    ['12345678.9', '12.35M'],
    ['1234567890', '1.23B'],
    ['0.00000123456', '0.0[5]1235'],
  ])('formats a raw token balance %s', (value, expected) => {
    const { container } = render(
      <BorrowBalanceText
        kind="balance"
        text={{ text: 'server' }}
        value={value}
      />,
    );
    expect(container.textContent).toBe(expected);
  });

  it.each([
    ['$1,234.56', '$1.23K'],
    ['¥1,234.56', '¥1.23K'],
    ['US$1,234.56', 'US$1.23K'],
    ['€12,345,678.90', '€12.35M'],
    ['$1,234,567,890', '$1.23B'],
    ['< $0.01', '< $0.01'],
    ['$7.34', '$7.34'],
    ['1.234,56 €', '1.234,56 €'],
    ['$1.2M', '$1.2M'],
  ])('formats or preserves fiat display %s', (display, expected) => {
    const { container } = render(
      <BorrowBalanceText kind="fiat" text={{ text: display }} />,
    );
    expect(container.textContent).toBe(expected);
  });

  it.each([undefined, 'invalid', 'Infinity'])(
    'preserves server amount when raw value is %s',
    (value) => {
      const { container } = render(
        <BorrowBalanceText
          kind="balance"
          text={{ text: 'server' }}
          value={value}
        />,
      );
      expect(container.textContent).toBe('server');
    },
  );

  it('does not expose the raw amount when the display title is missing', () => {
    const { container } = render(
      <BorrowBalanceText kind="balance" value="1234" />,
    );
    expect(container.textContent).toBe('');
  });

  it.each(['-', '--', '****'])(
    'preserves the server placeholder %s',
    (text) => {
      const { container } = render(
        <BorrowBalanceText kind="balance" text={{ text }} value="1234" />,
      );
      expect(container.textContent).toBe(text);
    },
  );

  it('exposes the full token amount to assistive technology', () => {
    const { getByLabelText } = render(
      <BorrowBalanceText
        kind="balance"
        text={{ text: '0.0<subscripts>5</subscripts>1234' }}
        value="0.00000123456"
      />,
    );
    const number = getByLabelText('0.00000123456');
    expect(number.getAttribute('data-formatter')).toBe('balance-marketCap');
    expect(number.getAttribute('data-threshold')).toBe('1000');
    expect(number.getAttribute('data-native-label')).toBe('0.00000123456');
    expect(number.textContent).toBe('0.0[5]1235');
  });

  it('exposes the original fiat value to assistive technology', () => {
    const { getByLabelText } = render(
      <BorrowBalanceText kind="fiat" text={{ text: '¥1,234.56' }} />,
    );
    const number = getByLabelText('¥1,234.56');
    expect(number.getAttribute('data-formatter')).toBe('value-marketCap');
    expect(number.getAttribute('data-threshold')).toBe('1000');
    expect(number.getAttribute('data-native-label')).toBe('¥1,234.56');
    expect(number.textContent).toBe('¥1.23K');
  });
});
