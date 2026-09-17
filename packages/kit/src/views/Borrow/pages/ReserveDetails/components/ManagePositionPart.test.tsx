/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { ManagePositionPart } from './ManagePositionPart';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    disabled,
    onPress,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button disabled={disabled} onClick={onPress} type="button">
      {children}
    </button>
  ),
  Divider: () => <hr />,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: jest.fn() }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText',
  () => ({
    EarnText: ({ text }: { text?: { text?: string } }) => (
      <span>{text?.text}</span>
    ),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip',
  () => ({
    EarnTooltip: () => null,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage',
  () => ({
    EManagePositionType: { Supply: 'supply', Borrow: 'borrow' },
  }),
);

jest.mock('../../../borrowUtils', () => ({
  BorrowNavigation: { pushToBorrowManagePosition: jest.fn() },
}));

const userInfo = {
  walletBalance: {
    title: { text: '1 ETH' },
    button: { disabled: false, text: { text: 'Supply' } },
  },
  availableBorrowBalance: {
    title: { text: '2 ETH' },
    button: { disabled: false, text: { text: 'Borrow' } },
  },
} as unknown as IBorrowReserveDetail['userInfo'];

function renderPart({ networkId }: { networkId: string }) {
  return render(
    <ManagePositionPart
      accountId="account-1"
      userInfo={userInfo}
      networkId={networkId}
      provider="Aave"
      marketAddress="0xMarket"
      reserveAddress=""
      symbol="ETH"
    />,
  );
}

function isActionDisabled(label: string) {
  return screen.getByText(label).closest('button')?.disabled;
}

describe('ManagePositionPart native reserve guard', () => {
  it('disables both actions for an Aave native reserve without gateway support', () => {
    renderPart({ networkId: 'evm--137' });

    expect(isActionDisabled('Supply')).toBe(true);
    expect(isActionDisabled('Borrow')).toBe(true);
  });

  it('keeps the server flag authoritative where the gateway is supported', () => {
    renderPart({ networkId: 'evm--1' });

    expect(isActionDisabled('Supply')).toBe(false);
    expect(isActionDisabled('Borrow')).toBe(false);
  });
});
