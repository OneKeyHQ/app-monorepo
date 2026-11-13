/** @jest-environment jsdom */

import type { KeyboardEvent, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenListFooterRows } from './TokenListFooterRows';

function MockBox({
  children,
  testID,
  role,
  tabIndex,
  onPress,
  onKeyDown,
}: {
  children?: ReactNode;
  testID?: string;
  role?: string;
  tabIndex?: number;
  onPress?: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
}) {
  return (
    // Mirrors the RN props it is given; pressable rows pass role="button".
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      data-testid={testID}
      role={role}
      tabIndex={tabIndex}
      onClick={onPress}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}

jest.mock('@onekeyhq/components', () => ({
  Icon: ({ name }: { name: string }) => <i data-icon={name} />,
  IconButton: ({
    testID,
    icon,
    'aria-label': label,
  }: {
    testID?: string;
    icon?: string;
    'aria-label'?: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      data-icon={icon}
      aria-label={label}
    />
  ),
  Image: ({ source }: { source?: { uri?: string } }) => (
    <img alt="" src={source?.uri} />
  ),
  Popover: ({
    title,
    renderTrigger,
    renderContent,
  }: {
    title?: ReactNode;
    renderTrigger?: ReactNode;
    renderContent?: ReactNode;
  }) => (
    <div data-testid="low-value-help">
      {title}
      {renderTrigger}
      {renderContent}
    </div>
  ),
  SizableText: MockBox,
  Stack: MockBox,
  XStack: MockBox,
  YStack: MockBox,
  useTheme: () => ({
    bgCautionSubdued: { val: '#fff7e0' },
    borderCautionSubdued: { val: '#f5d680' },
  }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: Record<string, number | string>,
    ) => (values ? `${id}:${JSON.stringify(values)}` : id),
  }),
}));
jest.mock('../Currency', () => ({
  Currency: ({ children }: { children?: ReactNode }) => (
    <span data-testid="low-value-total">{children}</span>
  ),
}));

function token(key: string, logoURI?: string): IAccountToken {
  return {
    $key: key,
    address: `0x${key}`,
    symbol: key,
    name: key,
    decimals: 18,
    isNative: false,
    logoURI,
  };
}

describe('TokenListFooterRows', () => {
  it('piles the first four low-value logos, in order', () => {
    const tokens = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) =>
      token(key, `https://logo/${key}.png`),
    );
    render(
      <TokenListFooterRows
        lowValue={{
          tokens,
          count: tokens.length,
          total: '0.16',
          showTotal: true,
          onPress: jest.fn(),
        }}
      />,
    );
    const row = screen.getByTestId('token-list-footer-low-value-btn');
    expect(
      Array.from(row.querySelectorAll('img')).map((img) =>
        img.getAttribute('src'),
      ),
    ).toEqual([
      'https://logo/a.png',
      'https://logo/b.png',
      'https://logo/c.png',
      'https://logo/d.png',
    ]);
    expect(row.textContent).toContain('6 low_value_assets');
    expect(screen.getByTestId('low-value-total').textContent).toBe('0.16');
  });

  it('keeps four coins under four tokens, gray where there is no logo', () => {
    render(
      <TokenListFooterRows
        lowValue={{
          tokens: [token('a', 'https://logo/a.png'), token('b')],
          count: 2,
          showTotal: false,
          onPress: jest.fn(),
        }}
      />,
    );
    const coins = screen.getAllByTestId('token-list-footer-low-value-coin');
    expect(coins).toHaveLength(4);
    // Only the token with a logo draws one; the rest stay plain coins.
    expect(
      coins.map((coin) => coin.querySelector('img')?.getAttribute('src')),
    ).toEqual(['https://logo/a.png', undefined, undefined, undefined]);
  });

  it('explains low-value assets behind a "?" whose press stays its own', () => {
    const onPress = jest.fn();
    render(
      <TokenListFooterRows
        lowValue={{
          tokens: [],
          count: 2,
          showTotal: false,
          help: ['first rule', 'second rule'],
          onPress,
        }}
      />,
    );
    const help = screen.getByTestId('low-value-help');
    expect(help.textContent).toContain('low_value_assets');
    expect(help.textContent).toContain('first rule');
    expect(help.textContent).toContain('second rule');
    const button = screen.getByTestId('token-list-footer-help-btn');
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onPress).not.toHaveBeenCalled();
  });

  it('leaves the "?" out without help lines', () => {
    render(
      <TokenListFooterRows
        lowValue={{
          tokens: [],
          count: 2,
          showTotal: false,
          onPress: jest.fn(),
        }}
      />,
    );
    expect(screen.queryByTestId('token-list-footer-help-btn')).toBeNull();
  });

  it('leaves the low-value total out under one cent', () => {
    render(
      <TokenListFooterRows
        lowValue={{
          tokens: [token('a')],
          count: 1,
          total: '0.001',
          showTotal: false,
          onPress: jest.fn(),
        }}
      />,
    );
    expect(screen.queryByTestId('low-value-total')).toBeNull();
  });

  it('shows only the rows it is given, risky ones under a caution shield', () => {
    render(<TokenListFooterRows risky={{ count: 347, onPress: jest.fn() }} />);
    expect(screen.queryByTestId('token-list-footer-low-value-btn')).toBeNull();
    expect(screen.queryByTestId('token-list-footer-add-token-btn')).toBeNull();
    const risky = screen.getByTestId('token-list-footer-risky-btn');
    expect(risky.textContent).toContain(
      'wallet.collapsed_risk_assets_number:{"number":347}',
    );
    expect(risky.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(
      'ShieldExclamationSolid',
    );
  });

  it('holds the Swap column beside the table only', () => {
    const { unmount } = render(
      <TokenListFooterRows risky={{ count: 1, onPress: jest.fn() }} />,
    );
    expect(
      screen.getByTestId('token-list-footer-risky-btn').textContent,
    ).toContain(ETranslations.global_swap);
    unmount();
    render(
      <TokenListFooterRows
        layout="list"
        risky={{ count: 1, onPress: jest.fn() }}
      />,
    );
    expect(
      screen.getByTestId('token-list-footer-risky-btn').textContent,
    ).not.toContain(ETranslations.global_swap);
  });

  it('opens each row by click, Enter or Space', () => {
    const onLowValue = jest.fn();
    const onRisky = jest.fn();
    const onAddToken = jest.fn();
    render(
      <TokenListFooterRows
        lowValue={{
          tokens: [],
          count: 0,
          showTotal: false,
          onPress: onLowValue,
        }}
        risky={{ count: 1, onPress: onRisky }}
        addToken={{ onPress: onAddToken }}
      />,
    );
    // The row takes the click; its label is the keyboard and screen reader
    // button, so the low-value "?" is not nested inside a button.
    const lowValue = screen.getByTestId('token-list-footer-low-value-btn');
    expect(lowValue.getAttribute('role')).toBeNull();
    const lowValueLabel = screen.getByTestId(
      'token-list-footer-low-value-btn-label',
    );
    expect(lowValueLabel.getAttribute('role')).toBe('button');
    expect(lowValueLabel.getAttribute('tabindex')).toBe('0');

    fireEvent.click(lowValue);
    fireEvent.keyDown(screen.getByTestId('token-list-footer-risky-btn-label'), {
      key: 'Enter',
    });
    const addToken = screen.getByTestId(
      'token-list-footer-add-token-btn-label',
    );
    fireEvent.keyDown(addToken, { key: ' ' });
    fireEvent.keyDown(addToken, { key: 'a' });

    expect(onLowValue).toHaveBeenCalledTimes(1);
    expect(onRisky).toHaveBeenCalledTimes(1);
    expect(onAddToken).toHaveBeenCalledTimes(1);
  });
});
