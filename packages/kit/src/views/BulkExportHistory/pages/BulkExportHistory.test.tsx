/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  EModalRoutes,
  type IModalBulkExportHistoryParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import BulkExportHistory from './BulkExportHistory';

const mockPush = jest.fn();
const mockPushFullModal = jest.fn();
const mockCreateExportTask = jest.fn(
  async (_params?: unknown): Promise<void> => undefined,
);
const mockGetVaultSettings = jest.fn(async (_params?: unknown) => ({
  mergeDeriveAssetsEnabled: false,
}));
const mockGetGlobalDeriveTypeOfNetwork = jest.fn(
  async (_params?: unknown) => 'default',
);
const mockGetAccountsByIndexedAccounts = jest.fn(async (_params?: unknown) => ({
  accounts: [{ id: 'network-account-1', address: '0xabc' }],
}));
const mockGetAccountXpub = jest.fn(async (_params?: unknown) => '');
const mockGetAccountMetaForNetworksBatch = jest.fn(
  async (_params?: unknown) => undefined,
);
const mockAuthState = {
  isPrimeSubscriptionActive: true,
};
const mockAccountState: {
  account?: { id: string };
  dbAccount?: { id: string };
  indexedAccount?: { id: string; walletId: string };
  ready: boolean;
} = {
  account: { id: 'account-1' },
  dbAccount: { id: 'account-1' },
  indexedAccount: { id: 'indexed-1', walletId: 'hd-1' },
  ready: true,
};
const mockNetworksState = {
  hasRangeData: true,
};
const mockIntl = {
  formatMessage: ({ id }: { id: string }) => id,
};
const mockNavigation = {
  push: mockPush,
  pushFullModal: mockPushFullModal,
  pushModal: jest.fn(),
};
const mockSelectedNetworkIds = ['evm--1'];
const mockRangeNowMs = Date.now();
const mockEffectiveRange = {
  minTimestampMs: mockRangeNowMs - 400 * 24 * 60 * 60 * 1000,
  maxTimestampMs: mockRangeNowMs,
};
const mockNetworkRangeMap = {
  'evm--1': mockEffectiveRange,
};
const mockSetSelectedNetworkIds = jest.fn();
const mockRetryRangeRequest = jest.fn();
const mockAccountSelectorActions = {
  current: {
    syncFromScene: jest.fn(async () => undefined),
  },
};
const mockActiveAccountResult = {
  activeAccount: mockAccountState,
};

type IBulkExportHistoryPageProps = IPageScreenProps<
  IModalBulkExportHistoryParamList,
  EModalBulkExportHistoryRoutes.BulkExportHistoryModal
>;

const mockExportPageProps: IBulkExportHistoryPageProps = {
  navigation:
    mockNavigation as unknown as IBulkExportHistoryPageProps['navigation'],
  route: {
    key: 'bulk-export-history-modal',
    name: EModalBulkExportHistoryRoutes.BulkExportHistoryModal,
    params: {
      networkId: 'evm--1',
    },
  },
};

jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function Box({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) {
    return React.createElement('div', { 'data-testid': testID }, children);
  }

  const Page = Object.assign(Box, {
    Header: ({
      headerRight,
    }: {
      headerRight?: () => ReactNode;
      title?: string;
    }) => React.createElement('div', null, headerRight?.()),
    Body: Box,
    Footer: Box,
    FooterActions: ({
      confirmButtonProps,
    }: {
      confirmButtonProps?: {
        disabled?: boolean;
        loading?: boolean;
        onPress?: () => void;
      };
    }) =>
      React.createElement('button', {
        'data-testid': 'bulk-export-history-create-btn',
        'data-loading': String(Boolean(confirmButtonProps?.loading)),
        disabled: confirmButtonProps?.disabled,
        onClick: confirmButtonProps?.disabled
          ? undefined
          : confirmButtonProps?.onPress,
        type: 'button',
      }),
  });

  return {
    DatePicker: {
      Range: () =>
        React.createElement('div', { 'data-testid': 'custom-date-range' }),
      Trigger: Box,
    },
    ESwitchSize: { small: 'small' },
    Empty: Box,
    Icon: Box,
    IconButton: ({
      disabled,
      onPress,
      testID,
    }: {
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) =>
      React.createElement('button', {
        'data-testid': testID,
        disabled,
        onClick: disabled ? undefined : onPress,
        type: 'button',
      }),
    Page,
    SizableText: Box,
    Spinner: () =>
      React.createElement('div', { 'data-testid': 'export-spinner' }),
    Stack: Box,
    Switch: ({
      disabled,
      onChange,
      testID,
      value,
    }: {
      disabled?: boolean;
      onChange?: (value: boolean) => void;
      testID?: string;
      value?: boolean;
    }) =>
      React.createElement('button', {
        'data-testid': testID,
        'data-value': String(value),
        disabled,
        onClick: () => onChange?.(!value),
        type: 'button',
      }),
    Toast: { error: jest.fn(), message: jest.fn() },
    XStack: Box,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountMetaForNetworksBatch: (params?: unknown) =>
        mockGetAccountMetaForNetworksBatch(params),
      getAccountXpub: (params?: unknown) => mockGetAccountXpub(params),
      getAccountsByIndexedAccounts: (params?: unknown) =>
        mockGetAccountsByIndexedAccounts(params),
    },
    serviceHistory: {
      createExportTransactionHistoryTask: (params?: unknown) =>
        mockCreateExportTask(params),
    },
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: (params?: unknown) =>
        mockGetGlobalDeriveTypeOfNetwork(params),
      getVaultSettings: (params?: unknown) => mockGetVaultSettings(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerBulkExportHistory',
  () => ({
    AccountSelectorTriggerBulkExportHistory: () => null,
  }),
);

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isPrimeSubscriptionActive: mockAuthState.isPrimeSubscriptionActive,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => mockActiveAccountResult,
}));

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => mockAccountSelectorActions,
  }),
);

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    showToastOfError: jest.fn(),
    toastIfError: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: jest.fn() } },
    prime: {
      usage: { exportHistoryTaskCreateSuccess: jest.fn() },
    },
  },
}));

jest.mock('../../Staking/components/PageFrame', () => ({
  PageFrame: () => null,
}));

jest.mock('../components/BulkExportHistoryDateRangeSelector', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ({
      disabled,
      onChange,
      options,
      testID,
      value,
    }: {
      disabled?: boolean;
      onChange: (next: string | number) => void;
      options: { label: string; value: string | number }[];
      testID?: string;
      value: string | number;
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': testID,
          'data-value': String(value),
        },
        options.map((option) =>
          React.createElement(
            'button',
            {
              key: String(option.value),
              'data-testid': `date-range-${String(option.value)}`,
              disabled,
              onClick: () => onChange(option.value),
              type: 'button',
            },
            option.label,
          ),
        ),
      ),
  };
});

jest.mock('../components/BulkExportHistoryNetworkTrigger', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../hooks/useBulkExportHistorySupportedNetworks', () => ({
  useBulkExportHistorySupportedNetworks: () => ({
    supportedNetworkIds: mockSelectedNetworkIds,
    selectedNetworkIds: mockSelectedNetworkIds,
    setSelectedNetworkIds: mockSetSelectedNetworkIds,
    networkRangeMap: mockNetworkRangeMap,
    effectiveRange: mockEffectiveRange,
    hasRangeData: mockNetworksState.hasRangeData,
    isLoading: false,
    isRangeLoading: false,
    hasRangeError: false,
    hasEmptyRange: false,
    retryRangeRequest: mockRetryRangeRequest,
  }),
}));

function renderExportPage() {
  return render(<BulkExportHistory {...mockExportPageProps} />);
}

async function waitForExportForm() {
  return waitFor(() => screen.getByTestId('bulk-export-history-create-btn'));
}

function expectNoAccountResolutionOrCreate() {
  expect(mockGetVaultSettings).not.toHaveBeenCalled();
  expect(mockGetAccountMetaForNetworksBatch).not.toHaveBeenCalled();
  expect(mockGetAccountsByIndexedAccounts).not.toHaveBeenCalled();
  expect(mockGetAccountXpub).not.toHaveBeenCalled();
  expect(mockCreateExportTask).not.toHaveBeenCalled();
}

describe('BulkExportHistory create gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.isPrimeSubscriptionActive = true;
    mockNetworksState.hasRangeData = true;
    mockAccountState.account = { id: 'account-1' };
    mockAccountState.dbAccount = { id: 'account-1' };
    mockAccountState.indexedAccount = { id: 'indexed-1', walletId: 'hd-1' };
    mockAccountState.ready = true;
    mockGetVaultSettings.mockResolvedValue({
      mergeDeriveAssetsEnabled: false,
    });
    mockGetGlobalDeriveTypeOfNetwork.mockResolvedValue('default');
    mockGetAccountsByIndexedAccounts.mockResolvedValue({
      accounts: [{ id: 'network-account-1', address: '0xabc' }],
    });
    mockGetAccountXpub.mockResolvedValue('');
    mockCreateExportTask.mockResolvedValue(undefined);
  });

  it('routes inactive users to Prime without resolving accounts or creating a task, and keeps history accessible', async () => {
    mockAuthState.isPrimeSubscriptionActive = false;
    renderExportPage();
    await waitForExportForm();

    fireEvent.click(screen.getByTestId('bulk-export-history-create-btn'));

    await waitFor(() =>
      expect(mockPushFullModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDashboard,
        params: { fromFeature: EPrimeFeatures.HistoryExport },
      }),
    );
    expectNoAccountResolutionOrCreate();
    expect(
      screen
        .getByTestId('bulk-export-history-create-btn')
        .getAttribute('data-loading'),
    ).toBe('false');

    fireEvent.click(screen.getByTestId('bulk-export-history-task-list-btn'));
    expect(mockPush).toHaveBeenCalledWith(
      EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList,
    );
  });

  it('creates once for active users and ignores repeated clicks while the request is pending', async () => {
    let resolveCreate: (() => void) | undefined;
    mockCreateExportTask.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    renderExportPage();
    await waitForExportForm();

    const createButton = screen.getByTestId('bulk-export-history-create-btn');
    fireEvent.click(createButton);
    fireEvent.click(createButton);

    await waitFor(() => expect(mockCreateExportTask).toHaveBeenCalledTimes(1));
    expect(mockPushFullModal).not.toHaveBeenCalled();
    expect(mockCreateExportTask).toHaveBeenCalledWith(
      expect.objectContaining({
        networkIdToAddressArray: { 'evm--1': ['0xabc'] },
        onlySafe: true,
      }),
    );

    resolveCreate?.();
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        EModalBulkExportHistoryRoutes.BulkExportHistoryTaskCreated,
      ),
    );
  });

  it('uses the latest auth state on the next click and keeps form options through Prime upsell', async () => {
    mockAuthState.isPrimeSubscriptionActive = false;
    const { rerender } = renderExportPage();
    await waitForExportForm();

    fireEvent.click(screen.getByTestId('date-range-last3Months'));
    fireEvent.click(
      screen.getByTestId('bulk-export-history-hide-risky-switch'),
    );
    fireEvent.click(screen.getByTestId('bulk-export-history-create-btn'));

    await waitFor(() => expect(mockPushFullModal).toHaveBeenCalledTimes(1));
    expectNoAccountResolutionOrCreate();
    expect(
      screen
        .getByTestId('bulk-export-history-date-range')
        .getAttribute('data-value'),
    ).toBe('last3Months');
    expect(
      screen
        .getByTestId('bulk-export-history-hide-risky-switch')
        .getAttribute('data-value'),
    ).toBe('false');

    mockAuthState.isPrimeSubscriptionActive = true;
    rerender(<BulkExportHistory {...mockExportPageProps} />);
    expect(mockCreateExportTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('bulk-export-history-create-btn'));
    await waitFor(() => expect(mockCreateExportTask).toHaveBeenCalledTimes(1));
    expect(mockCreateExportTask).toHaveBeenCalledWith(
      expect.objectContaining({ onlySafe: false }),
    );
    await waitFor(() =>
      expect(
        screen
          .getByTestId('bulk-export-history-create-btn')
          .getAttribute('data-loading'),
      ).toBe('false'),
    );

    mockAuthState.isPrimeSubscriptionActive = false;
    rerender(<BulkExportHistory {...mockExportPageProps} />);
    fireEvent.click(screen.getByTestId('bulk-export-history-create-btn'));
    await waitFor(() => expect(mockPushFullModal).toHaveBeenCalledTimes(2));
    expect(mockCreateExportTask).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByTestId('bulk-export-history-date-range')
        .getAttribute('data-value'),
    ).toBe('last3Months');
  });

  it.each([
    {
      label: 'missing export account',
      setup: () => {
        mockAccountState.account = undefined;
        mockAccountState.dbAccount = undefined;
        mockAccountState.indexedAccount = undefined;
      },
    },
    {
      label: 'missing range data',
      setup: () => {
        mockNetworksState.hasRangeData = false;
      },
    },
    {
      label: 'invalid custom date range',
      setup: () => undefined,
      selectCustomRange: true,
    },
  ])(
    'keeps $label from creating or opening Prime',
    async ({ setup, selectCustomRange }) => {
      mockAuthState.isPrimeSubscriptionActive = false;
      setup();
      renderExportPage();
      await waitForExportForm();

      if (selectCustomRange) {
        fireEvent.click(screen.getByTestId('date-range-custom'));
      }

      const createButton = screen.getByTestId(
        'bulk-export-history-create-btn',
      ) as HTMLButtonElement;
      expect(createButton.disabled).toBe(true);
      fireEvent.click(createButton);

      expect(mockPushFullModal).not.toHaveBeenCalled();
      expectNoAccountResolutionOrCreate();
    },
  );
});
