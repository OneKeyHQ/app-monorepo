/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { WalletActionBulkSend } from './WalletActionBulkSend';

type IGateParams = {
  isContextValid?: () => boolean | Promise<boolean>;
};

const mockEnsureFeatureAccess = jest.fn();
const mockShowBulkSendModeDialog = jest.fn();
const mockNavigateToBulkSend = jest.fn();
const mockPressedActiveAccount = {
  wallet: { id: 'wallet-1' },
  network: { id: 'evm--1' },
  account: { id: 'account-1' },
  indexedAccount: { id: 'indexed-1' },
};
// What the account selector store holds when the gate re-checks.
let mockLatestActiveAccount = mockPressedActiveAccount;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Badge = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  Badge.Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );
  return {
    ActionList: {
      Item: ({ label, onPress }: { label: string; onPress: () => void }) => (
        <button type="button" onClick={onPress}>
          {label}
        </button>
      ),
    },
    Badge,
  };
});

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    user: undefined,
    isPrimeActive: false,
    isPrimeSubscriptionActive: false,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockPressedActiveAccount }),
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actionsLazy',
  () => ({
    useAccountSelectorLazyAction:
      () =>
      async (name: string, { num }: { num: number }) =>
        name === 'getActiveAccount' && num === 0
          ? mockLatestActiveAccount
          : undefined,
  }),
);

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: { subscription: { primeEntryClick: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isE2E: false },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: async () => undefined },
}));

jest.mock('../../../BulkSend/hooks/useBulkSendModeDialog', () => ({
  useBulkSendModeDialog: () => mockShowBulkSendModeDialog,
}));

jest.mock('../../../BulkSend/hooks/useNavigateToBulkSend', () => ({
  useNavigateToBulkSend: () => mockNavigateToBulkSend,
}));

jest.mock('../../../Prime/hooks/usePrimeAvailable', () => ({
  usePrimeAvailable: () => ({ isPrimeAvailable: true }),
}));

jest.mock('../../../Prime/hooks/usePrimeFeatureAccess', () => ({
  usePrimeFeatureAccess: () => ({
    ensureFeatureAccess: mockEnsureFeatureAccess,
  }),
}));

async function pressBulkSend() {
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', { name: /wallet\.bulk_send_title/ }),
    );
  });
}

function getGateContextCheck() {
  const params = mockEnsureFeatureAccess.mock.calls[0]?.[0] as
    | IGateParams
    | undefined;
  expect(typeof params?.isContextValid).toBe('function');
  return async () => params?.isContextValid?.();
}

describe('WalletActionBulkSend free trial gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatestActiveAccount = mockPressedActiveAccount;
  });

  it('re-checks the latest selection after the menu item unmounted', async () => {
    mockEnsureFeatureAccess.mockResolvedValue({ granted: false });
    const { unmount } = render(<WalletActionBulkSend onClose={jest.fn()} />);

    await pressBulkSend();
    // The menu closes on press, so the item is gone while the gate waits.
    unmount();
    const isContextValid = getGateContextCheck();

    await expect(isContextValid()).resolves.toBe(true);
    mockLatestActiveAccount = {
      ...mockPressedActiveAccount,
      wallet: { id: 'wallet-2' },
    };
    await expect(isContextValid()).resolves.toBe(false);
    mockLatestActiveAccount = {
      ...mockPressedActiveAccount,
      network: { id: 'evm--56' },
    };
    await expect(isContextValid()).resolves.toBe(false);
  });

  it('opens bulk send for the pressed account once granted', async () => {
    mockEnsureFeatureAccess.mockResolvedValue({
      granted: true,
      entitlementSource: 'freeTrial',
    });
    render(<WalletActionBulkSend onClose={jest.fn()} />);

    await pressBulkSend();

    expect(mockShowBulkSendModeDialog).toHaveBeenCalledTimes(1);
    const { onSelect } = mockShowBulkSendModeDialog.mock.calls[0][0] as {
      onSelect: (mode: string) => void;
    };
    onSelect('oneToMany');
    expect(mockNavigateToBulkSend).toHaveBeenCalledWith({
      networkId: 'evm--1',
      accountId: 'account-1',
      indexedAccountId: 'indexed-1',
      bulkSendMode: 'oneToMany',
    });
  });

  it('opens nothing when the gate drops the press', async () => {
    mockEnsureFeatureAccess.mockResolvedValue({ granted: false });
    render(<WalletActionBulkSend onClose={jest.fn()} />);

    await pressBulkSend();

    expect(mockShowBulkSendModeDialog).not.toHaveBeenCalled();
    expect(mockNavigateToBulkSend).not.toHaveBeenCalled();
  });
});
