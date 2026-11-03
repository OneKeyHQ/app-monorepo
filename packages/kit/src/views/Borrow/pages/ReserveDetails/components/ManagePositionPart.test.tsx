/** @jest-environment jsdom */

import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IHeaderRightViewProps } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/components/HeaderRight';
import type { IManagePositionContentProps } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/components/ManagePositionContent';
import type { IBorrowReserveFormTab } from '@onekeyhq/shared/src/routes';
import { EManagePositionType } from '@onekeyhq/shared/types/staking';

import { useBorrowReserveFormScope } from '../../../components/ManagePosition/reserveFormScope';

import { ManagePositionPart } from './ManagePositionPart';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

// Jest maps every @onekeyhq/components path to one module, so this mock is
// also the animation constants the column imports
jest.mock('@onekeyhq/components', () => ({
  ANIMATE_ONLY_OPACITY: ['opacity'],
  IconButton: ({ onPress }: { onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      history-icon
    </button>
  ),
  SegmentControl: ({
    options,
    onChange,
  }: {
    options: { value: string; label: ReactNode; testID?: string }[];
    onChange: (value: string) => void;
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={option.testID}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Staking/components/StakingActivityIndicator',
  () => ({
    PendingIndicator: () => <span>pending</span>,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/components/HeaderRight',
  () => ({
    HeaderRightView: ({ historyText, onHistory }: IHeaderRightViewProps) => (
      <button type="button" onClick={onHistory}>
        {historyText}
      </button>
    ),
  }),
);

const formProps: IManagePositionContentProps[] = [];
const onHistory = jest.fn();

function FormStub(props: IManagePositionContentProps) {
  formProps.push(props);
  const scope = useBorrowReserveFormScope();
  const { onHeaderRightChange } = props;
  useEffect(() => {
    onHeaderRightChange?.({
      pendingCount: 0,
      historyText: 'History',
      showHistory: true,
      showPendleControls: false,
      hasRefreshQuote: false,
      onHistory,
      onOpenSlippage: jest.fn(),
      onRefreshQuote: jest.fn(),
    });
  }, [onHeaderRightChange]);
  return <div data-testid="form-scope">{JSON.stringify(scope ?? null)}</div>;
}

jest.mock(
  '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/components/ManagePositionContent',
  () => ({
    ManagePositionContent: (props: IManagePositionContentProps) => (
      <FormStub {...props} />
    ),
  }),
);

function renderPart({
  sides,
  side,
  onSideChange = jest.fn(),
  startAmount,
  position,
}: {
  sides: IBorrowReserveFormTab[];
  side: IBorrowReserveFormTab;
  onSideChange?: (side: IBorrowReserveFormTab) => void;
  startAmount?: string;
  position?: { hasSupply: boolean; hasBorrow: boolean };
}) {
  return render(
    <ManagePositionPart
      accountId="account-1"
      indexedAccountId="indexed-1"
      networkId="evm--1"
      provider="aave"
      marketAddress="0xMarket"
      reserveAddress="0xReserve"
      symbol="cbBTC"
      logoURI="https://token.logo"
      marketLabel="Aave Core"
      marketLogoURI="https://market.logo"
      sides={sides}
      side={side}
      onSideChange={onSideChange}
      startAmount={startAmount}
      position={position}
    />,
  );
}

const lastFormProps = () => formProps[formProps.length - 1];

beforeEach(() => {
  formProps.length = 0;
  onHistory.mockClear();
});

describe('ManagePositionPart', () => {
  it('shows only the sides it is given, and asks for another one when pressed', () => {
    const onSideChange = jest.fn();
    renderPart({
      sides: ['supply', 'borrow', 'repay'],
      side: 'supply',
      onSideChange,
    });

    expect(screen.getByTestId('borrow-reserve-side-supply')).toBeTruthy();
    expect(screen.getByTestId('borrow-reserve-side-borrow')).toBeTruthy();
    expect(screen.getByTestId('borrow-reserve-side-repay')).toBeTruthy();
    expect(screen.queryByTestId('borrow-reserve-side-withdraw')).toBeNull();

    fireEvent.click(screen.getByTestId('borrow-reserve-side-supply'));
    expect(onSideChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('borrow-reserve-side-repay'));
    expect(onSideChange).toHaveBeenCalledWith('repay');
  });

  it.each([
    ['supply', EManagePositionType.Supply, true, false, true],
    ['withdraw', EManagePositionType.Supply, false, true, true],
    ['borrow', EManagePositionType.Borrow, true, false, false],
    ['repay', EManagePositionType.Borrow, false, true, false],
  ] as const)(
    'loads the manage window form for %s',
    (side, type, depositOnly, withdrawOnly, isEarnLending) => {
      renderPart({ sides: [side], side });

      expect(screen.getByTestId(`borrow-reserve-form-${side}`)).toBeTruthy();
      expect(lastFormProps()).toMatchObject({
        type,
        depositOnly,
        withdrawOnly,
        isEarnLending,
        hidesTabLine: true,
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMarket',
        reserveAddress: '0xReserve',
        accountId: 'account-1',
        indexedAccountId: 'indexed-1',
        symbol: 'cbBTC',
        fallbackTokenImageUri: 'https://token.logo',
        // The market's logo, not the token's
        providerDisplayName: 'Aave Core',
        providerLogoUri: 'https://market.logo',
      });
    },
  );

  it('hands the start amount to the form', () => {
    renderPart({
      sides: ['supply', 'borrow'],
      side: 'borrow',
      startAmount: '1',
    });

    expect(lastFormProps().initialAmount).toBe('1');
  });

  it("draws the form's History on the switch's line", () => {
    renderPart({ sides: ['supply', 'borrow'], side: 'supply' });

    fireEvent.click(screen.getByText('History'));
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  it('tells the form it is on a reserve page, and what the account holds once read', () => {
    const { unmount } = renderPart({ sides: ['supply'], side: 'supply' });
    expect(
      JSON.parse(screen.getByTestId('form-scope').textContent ?? ''),
    ).toEqual({});
    unmount();

    renderPart({
      sides: ['supply', 'borrow', 'repay'],
      side: 'repay',
      position: { hasSupply: false, hasBorrow: true },
    });
    expect(
      JSON.parse(screen.getByTestId('form-scope').textContent ?? ''),
    ).toEqual({ position: { hasSupply: false, hasBorrow: true } });
  });
});
