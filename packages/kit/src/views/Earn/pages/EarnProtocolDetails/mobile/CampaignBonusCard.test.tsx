/** @jest-environment jsdom */

import type { MouseEvent, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import enUS from '@onekeyhq/shared/src/locale/json/en_US.json';
import type { IEarnBonusProgress } from '@onekeyhq/shared/types/staking';

import { CampaignBonusCard } from './CampaignBonusCard';

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    role,
    'aria-label': accessibilityLabel,
    onPress,
  }: {
    children?: ReactNode;
    role?: string;
    'aria-label'?: string;
    onPress?: (event: MouseEvent) => void;
  }) =>
    role === 'link' ? (
      <button
        type="button"
        role="link"
        aria-label={accessibilityLabel}
        onClick={onPress}
      >
        {children}
      </button>
    ) : (
      <div>{children}</div>
    );
  return {
    XStack: Stack,
    YStack: Stack,
    SizableText: ({ children }: { children: ReactNode }) => (
      <span>{children}</span>
    ),
    Icon: () => null,
    IconButton: ({
      accessibilityLabel,
      disabled,
      onPress,
    }: {
      accessibilityLabel: string;
      disabled: boolean;
      onPress: () => void;
    }) => (
      <button
        type="button"
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={onPress}
      />
    ),
  };
});

let mockHideValue = false;
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsValuePersistAtom: () => [{ hideValue: mockHideValue }],
}));
jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn().mockResolvedValue(undefined),
}));

const NOW = Date.UTC(2027, 0, 20, 10);
const DAY_MS = 86_400_000;
const deposits = [0, 3.5, 11, 20, 22].map((days, index) => ({
  amount: `${5 - index}.00000001`,
  symbol: 'ETH',
  depositedAt: NOW + (days - 60) * DAY_MS,
  maturesAt: NOW + days * DAY_MS,
}));
const bonusProgress: IEarnBonusProgress = {
  status: 'earning',
  title: 'Campaign bonus',
  bonus: { amount: '0.019301', symbol: 'USDC' },
  isEstimated: true,
  payoutAt: Date.UTC(2027, 1, 17, 10),
  deposits,
};
const messages: Record<string, string> = enUS;

function card(progress: Partial<IEarnBonusProgress> = {}) {
  return (
    <IntlProvider locale="en-US" timeZone="UTC" messages={messages}>
      <CampaignBonusCard
        progress={{ ...bonusProgress, ...progress }}
        networkId="evm--1"
      />
    </IntlProvider>
  );
}

beforeEach(() => {
  mockHideValue = false;
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('earning shows a zero estimate and the remaining or completed hold', () => {
  render(card({ bonus: { amount: '0', symbol: 'USDC' } }));

  expect(screen.getByText('Campaign bonus')).toBeTruthy();
  expect(screen.getByText('≈+0 USDC')).toBeTruthy();
  expect(screen.getByText('Pays out Feb 17')).toBeTruthy();
  expect(screen.getByText('Held 60 days')).toBeTruthy();
  expect(screen.getByText('4 days left')).toBeTruthy();
  expect(screen.getByText('5.00000001 ETH')).toBeTruthy();
});

test('waiting honors isEstimated and paginates in server order as deposits change', () => {
  const { rerender } = render(card({ status: 'waiting' }));

  expect(screen.getByText('≈+0.019301 USDC')).toBeTruthy();
  expect(screen.getByText('5 deposits')).toBeTruthy();
  expect(screen.getByText('1/2')).toBeTruthy();
  expect(screen.queryByText('2.00000001 ETH')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('2/2')).toBeTruthy();
  expect(screen.getByText('2.00000001 ETH')).toBeTruthy();
  expect(screen.queryByText('5.00000001 ETH')).toBeNull();

  rerender(
    card({
      status: 'waiting',
      isEstimated: false,
      deposits: deposits.slice(0, 3),
    }),
  );
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  expect(screen.getByText('5.00000001 ETH')).toBeTruthy();

  rerender(card({ status: 'waiting', isEstimated: false, deposits: [] }));
  expect(screen.getByText('+0.019301 USDC')).toBeTruthy();
  expect(screen.getByText('Pays out Feb 17')).toBeTruthy();
  expect(screen.queryByText('5.00000001 ETH')).toBeNull();
});

test('paying shows the compact status and amount', () => {
  render(card({ status: 'paying', isEstimated: false }));

  expect(screen.getByText('Paying out')).toBeTruthy();
  expect(screen.getByText('+0.019301 USDC')).toBeTruthy();
  expect(screen.queryByText('5 deposits')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
});

test('paid opens the confirmed claim transaction and omits missing or invalid links', () => {
  const paidAt = Date.UTC(2027, 1, 18, 10);
  const txHash = `0x${'ab'.repeat(32)}`;
  const paid: Partial<IEarnBonusProgress> = {
    status: 'paid',
    isEstimated: false,
    paidAt,
    deposits: [],
  };
  const { rerender } = render(card({ ...paid, txHash }));

  fireEvent.click(
    screen.getByRole('link', {
      name: 'Paid Feb 18. View transaction in explorer',
    }),
  );
  expect(openTransactionDetailsUrl).toHaveBeenCalledWith({
    networkId: 'evm--1',
    txid: txHash,
  });

  rerender(card(paid));
  expect(screen.getByText('Paid Feb 18')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();

  rerender(card({ ...paid, txHash: 'invalid-hash' }));
  expect(screen.getByText('Paid Feb 18')).toBeTruthy();
  expect(screen.queryByRole('link')).toBeNull();
});

test('the balance privacy setting masks both bonus and deposits', () => {
  mockHideValue = true;
  render(card());

  expect(screen.getByText('**** USDC')).toBeTruthy();
  expect(screen.getAllByText('**** ETH')).toHaveLength(3);
  expect(screen.queryByText('≈+0.019301 USDC')).toBeNull();
});
