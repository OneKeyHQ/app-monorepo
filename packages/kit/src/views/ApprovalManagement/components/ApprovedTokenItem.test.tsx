/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import type { IApproval } from '@onekeyhq/shared/types/approval';
import type { IToken } from '@onekeyhq/shared/types/token';

import { ApprovalManagementTestIDs } from '../testIDs';

import ApprovedTokenItem from './ApprovedTokenItem';

const accountId = 'account-1';
const networkId = 'evm--1';
const contractAddress = '0xspender';
const tokenAddress = '0xtoken';
const permit2Address = '0xpermit2';

const tokenInfo: IToken = {
  address: tokenAddress,
  decimals: 6,
  isNative: false,
  name: 'USD Coin',
  symbol: 'USDC',
};

let mockTokenMap: Record<string, { info: IToken }> = {};
let mockApprovalContext: {
  isBuildingRevokeTxs: boolean;
  selectedTokens: Record<string, boolean>;
} = {
  isBuildingRevokeTxs: false,
  selectedTokens: {},
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: Record<string, string>,
    ) => {
      const messages: Record<string, string> = {
        'global.approval_time': 'Approval time',
        'global.revoke': 'Revoke',
        'swap_page.provider.approve_amount_un_limit': 'Unlimited',
        wallet_approval_permit2_never_expires__desc: 'Never expires',
      };
      if (id === 'global.revoke_approve') {
        return `Revoke ${values?.symbol ?? ''} allowance`;
      }
      if (id === 'wallet_approval_permit2_expires_at__desc') {
        return `Expires at ${values?.date ?? ''}`;
      }
      return messages[id] ?? id;
    },
  }),
}));

jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  formatDate: (
    _date: Date,
    options?: {
      hideTheYear?: boolean;
      hideTimeForever?: boolean;
      hideYear?: boolean;
    },
  ) => {
    if (options?.hideTheYear) {
      return '07/17';
    }
    if (options?.hideTimeForever) {
      return '2026/07/17';
    }
    if (options?.hideYear) {
      return '08/16, 12:27';
    }
    return '2026/08/16, 12:27';
  },
}));

jest.mock('@onekeyhq/components', () => {
  return {
    Button: ({
      accessibilityLabel,
      children,
      disabled,
      loading,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
      disabled?: boolean;
      loading?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        aria-label={accessibilityLabel}
        data-loading={String(Boolean(loading))}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        type="button"
      >
        {children}
      </button>
    ),
    Checkbox: ({
      accessibilityLabel,
      onChange,
      shouldStopPropagation,
      testID,
      value,
    }: {
      accessibilityLabel?: string;
      onChange?: (value: boolean) => void;
      shouldStopPropagation?: boolean;
      testID?: string;
      value?: boolean;
    }) => (
      <input
        aria-label={accessibilityLabel}
        checked={value}
        data-should-stop-propagation={String(Boolean(shouldStopPropagation))}
        data-testid={testID}
        onChange={() => onChange?.(!value)}
        onClick={(event) => {
          if (shouldStopPropagation) {
            event.stopPropagation();
          }
        }}
        type="checkbox"
      />
    ),
    Icon: () => null,
    NumberSizeableText: ({
      autoFormatter,
      children,
    }: {
      autoFormatter?: string;
      children?: ReactNode;
    }) => (
      <span data-auto-formatter={autoFormatter} data-testid="allowance-number">
        {children}
      </span>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('../../../components/ListItem', () => {
  const ListItem = ({
    children,
    onPress,
    renderItemText,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    renderItemText?: ReactNode;
  }) => {
    const content = (
      <>
        {renderItemText}
        {children}
      </>
    );

    if (onPress) {
      return (
        <div
          data-testid="approval-list-item"
          onClick={onPress}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              onPress();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {content}
        </div>
      );
    }

    return <div data-testid="approval-list-item">{content}</div>;
  };
  return { ListItem };
});

jest.mock('../../../states/jotai/contexts/approvalList', () => ({
  useTokenMapAtom: () => [{ tokenMap: mockTokenMap }],
}));

jest.mock('./ApprovalManagementContext', () => ({
  useApprovalManagementContext: () => mockApprovalContext,
}));

function buildApproval(overrides: Partial<IApproval> = {}): IApproval {
  return {
    allowance: '1000000',
    allowanceParsed: '1',
    isInfiniteAmount: true,
    networkId,
    riskLevel: 0,
    spenderAddress: contractAddress,
    time: 1_768_492_800_000,
    tokenAddress,
    ...overrides,
  };
}

function renderItem({
  approval = buildApproval(),
  isSelectMode = false,
  onRevoke = jest.fn(async () => undefined),
  onSelect = jest.fn(async () => undefined),
}: {
  approval?: IApproval;
  isSelectMode?: boolean;
  onRevoke?: jest.Mock;
  onSelect?: jest.Mock;
} = {}) {
  return {
    onRevoke,
    onSelect,
    ...render(
      <ApprovedTokenItem
        accountId={accountId}
        networkId={networkId}
        contractAddress={contractAddress}
        approval={approval}
        isSelectMode={isSelectMode}
        onRevoke={onRevoke}
        onSelect={onSelect}
      />,
    ),
  };
}

describe('ApprovedTokenItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenMap = {
      [approvalUtils.buildTokenMapKey({ networkId, tokenAddress })]: {
        info: tokenInfo,
      },
    };
    mockApprovalContext = {
      isBuildingRevokeTxs: false,
      selectedTokens: {},
    };
  });

  it('renders a standard approval and forwards revoke', () => {
    const approval = buildApproval();
    const onRevoke = jest.fn(async () => undefined);
    const { getByLabelText, getByTestId, getByText, queryByText } = renderItem({
      approval,
      onRevoke,
    });

    expect(getByText('USDC')).toBeTruthy();
    expect(getByText('2026/07/17')).toBeTruthy();
    expect(getByText('Unlimited')).toBeTruthy();
    expect(getByText('Revoke')).toBeTruthy();
    expect(queryByText('Permit2 ·')).toBeNull();
    expect(getByLabelText('Revoke USDC allowance')).toBeTruthy();

    fireEvent.click(getByTestId(ApprovalManagementTestIDs.tokenRevokeBtn));

    expect(onRevoke).toHaveBeenCalledTimes(1);
    expect(onRevoke).toHaveBeenCalledWith({ approval, tokenInfo });
  });

  it('keeps the compact number formatter for finite allowances', () => {
    const { getByTestId, getByText } = renderItem({
      approval: buildApproval({
        allowanceParsed: '1250000',
        isInfiniteAmount: false,
      }),
    });

    expect(
      getByTestId('allowance-number').getAttribute('data-auto-formatter'),
    ).toBe('balance-marketCap');
    expect(getByText('1250000')).toBeTruthy();
  });

  it.each([
    {
      expirationMs: 1_785_444_349_000,
      expected: 'Expires at 08/16, 12:27',
    },
    {
      expirationMs: 281_474_976_710_655_000,
      expected: 'Never expires',
    },
    { expirationMs: Number.NaN, expected: '--' },
  ])(
    'renders Permit2 metadata for expiration $expirationMs',
    ({ expirationMs, expected }) => {
      const { getByText } = renderItem({
        approval: buildApproval({ permit2Address, expirationMs }),
      });

      expect(getByText('Permit2 ·')).toBeTruthy();
      expect(getByText('Approval time 07/17')).toBeTruthy();
      expect(getByText(expected)).toBeTruthy();
    },
  );

  it('keeps checkbox selection separate from row selection', () => {
    const onSelect = jest.fn(async () => undefined);
    const { getByLabelText, getByTestId, queryByTestId } = renderItem({
      isSelectMode: true,
      onSelect,
    });

    expect(queryByTestId(ApprovalManagementTestIDs.tokenRevokeBtn)).toBeNull();

    const checkbox = getByLabelText('USDC');
    expect(checkbox.getAttribute('data-should-stop-propagation')).toBe('true');
    fireEvent.click(checkbox);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      approval: expect.any(Object),
      isSelected: true,
    });

    onSelect.mockClear();
    fireEvent.click(getByTestId('approval-list-item'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      approval: expect.any(Object),
      isSelected: true,
    });
  });

  it('shows loading only on the selected revoke action', () => {
    const approval = buildApproval({ permit2Address });
    const selectedKey = approvalUtils.buildSelectedTokenKey({
      accountId,
      networkId,
      contractAddress,
      tokenAddress,
      permit2Address,
    });
    mockApprovalContext = {
      isBuildingRevokeTxs: true,
      selectedTokens: { [selectedKey]: true },
    };

    const { getByTestId } = renderItem({ approval });
    const revokeButton = getByTestId(ApprovalManagementTestIDs.tokenRevokeBtn);

    expect((revokeButton as HTMLButtonElement).disabled).toBe(true);
    expect(revokeButton.getAttribute('data-loading')).toBe('true');
  });
});
