/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IDustSweepItem,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { DustSweepDetails } from './DustSweepDetails';

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Button: Stack,
    IconButton: () => null,
    ScrollView: Stack,
    SizableText: Stack,
    Toast: { error: jest.fn() },
    XStack: Stack,
    YStack: Stack,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/utils/explorerUtils', () => ({
  openTransactionDetailsUrl: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/views/Swap/components/PreSwapStep', () => ({
  SwapStepStatusIcon: () => null,
}));
jest.mock('./DustSweepTokenRow', () => ({
  ...jest.requireActual<typeof import('./DustSweepTokenRow')>(
    './DustSweepTokenRow',
  ),
  DustSweepTokenRow: () => null,
}));

const token: IDustSweepToken = {
  key: 'token',
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'TOKEN',
  decimals: 18,
  amount: '1',
  valueUsd: '1',
  suspicious: false,
};

it('shows settled transaction details while keeping internal errors behind localized fallbacks', () => {
  const items: IDustSweepItem[] = [
    {
      token: { ...token, key: 'failed-detail' },
      status: 'failed',
      txId: 'failed-transaction',
      reason: 'txFailed',
      message: 'Provider transaction failure detail',
    },
    {
      token: { ...token, key: 'failed-missing' },
      status: 'failed',
      txId: 'missing-detail-transaction',
      reason: 'txFailed',
    },
    {
      token: { ...token, key: 'failed-blank' },
      status: 'failed',
      txId: 'blank-detail-transaction',
      reason: 'txFailed',
      message: '   ',
    },
    {
      token: { ...token, key: 'skipped' },
      status: 'skipped',
      reason: 'unknown',
      message: 'Internal preparation error',
    },
    {
      token: { ...token, key: 'unknown' },
      status: 'unknown',
      reason: 'unknown',
      message: 'Internal submission error',
    },
  ];

  render(
    <DustSweepDetails
      state={{ phase: 'blocked', items }}
      onBack={jest.fn()}
      onDone={jest.fn()}
    />,
  );

  expect(screen.getByText('Provider transaction failure detail')).toBeTruthy();
  expect(
    screen.getAllByText(ETranslations.swap_review_transaction_failed),
  ).toHaveLength(2);
  expect(screen.getByText(ETranslations.global_unknown_error)).toBeTruthy();
  expect(screen.getByText(ETranslations.swap_review_tx_pending)).toBeTruthy();
  expect(screen.queryByText('Internal preparation error')).toBeNull();
  expect(screen.queryByText('Internal submission error')).toBeNull();
});
