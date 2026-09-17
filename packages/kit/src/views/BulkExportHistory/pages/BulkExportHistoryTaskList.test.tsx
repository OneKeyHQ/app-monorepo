/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IExportTransactionHistoryTask } from '@onekeyhq/shared/types/history';

import BulkExportHistoryTaskList from './BulkExportHistoryTaskList';

const mockLoginOneKeyId = jest.fn<Promise<void>, []>();
const mockFetchExportTransactionHistoryTasks = jest.fn<
  Promise<{ list: IExportTransactionHistoryTask[] }>,
  []
>();
const mockUseBulkExportHistoryTaskPolling = jest.fn();
const mockSyncFromScene = jest.fn(async () => undefined);

let mockIsLoggedIn = false;
const mockUser: {
  onekeyUserId?: string;
  primeSubscription?: { isActive: boolean };
} = {
  onekeyUserId: undefined,
  primeSubscription: { isActive: false },
};

function createTask({
  id,
  status = 'success',
}: {
  id: number;
  status?: IExportTransactionHistoryTask['status'];
}): IExportTransactionHistoryTask {
  return {
    id,
    next: null,
    createdAt: id,
    updatedAt: id,
    uid: `task-${id}`,
    query: {
      networkIdToAddressArray: { 'evm--1': ['0xabc'] },
      limit: 10,
      maxTimestampMs: 2,
      minTimestampMs: 1,
    },
    status,
    filename: `export-${id}.csv`,
    count: 1,
  };
}

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isLoggedIn: mockIsLoggedIn,
    loginOneKeyId: mockLoginOneKeyId,
    user: mockUser,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHistory: {
      fetchExportTransactionHistoryTasks: () =>
        mockFetchExportTransactionHistoryTasks(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (
      method: () => Promise<unknown>,
      deps: unknown[] = [],
    ) => {
      const [result, setResult] = React.useState<unknown>(undefined);
      const [isLoading, setIsLoading] = React.useState<boolean | undefined>(
        true,
      );
      const methodRef = React.useRef(method);
      methodRef.current = method;

      // Test mock forwards the production deps array; oxlint cannot treat a
      // dynamic array as a literal dependency list.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      React.useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        void methodRef
          .current()
          .then((value) => {
            if (!cancelled) {
              setResult(value);
              setIsLoading(false);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setResult(undefined);
              setIsLoading(false);
            }
          });
        return () => {
          cancelled = true;
        };
        // oxlint-disable-next-line react-hooks/exhaustive-deps
      }, deps);

      return {
        result,
        isLoading,
        run: jest.fn(),
      };
    },
  };
});

jest.mock('../hooks/useBulkExportHistoryTasks', () => {
  const actual = jest.requireActual<
    typeof import('../hooks/useBulkExportHistoryTasks')
  >('../hooks/useBulkExportHistoryTasks');
  return {
    useBulkExportHistoryTasks: actual.useBulkExportHistoryTasks,
    useBulkExportHistoryTaskPolling: (params: unknown) => {
      mockUseBulkExportHistoryTaskPolling(params);
    },
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerBase',
  () => ({
    AccountSelectorTriggerBase: () => null,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({
    useAccountSelectorActions: () => ({
      current: { syncFromScene: mockSyncFromScene },
    }),
  }),
);

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: undefined,
      dbAccount: undefined,
      indexedAccount: undefined,
      ready: true,
    },
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/ChainSelector/hooks/useNetworkOptions',
  () => ({
    useNetworkOptions: () => ({ networks: [], isLoading: false }),
  }),
);

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({
    children,
    testID,
    title,
  }: {
    children?: ReactNode;
    testID?: string;
    title?: string;
  }) => (
    <div data-testid={testID}>
      {title}
      {children}
    </div>
  ),
}));

jest.mock('../components/BulkExportHistoryDownloadButton', () => ({
  BulkExportHistoryDownloadIconButton: () => null,
}));

jest.mock('../components/BulkExportHistoryNetworkAvatars', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./BulkExportHistoryTaskStatus', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function Container({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) {
    return React.createElement('div', { 'data-testid': testID }, children);
  }

  const Page = Object.assign(Container, {
    Header: ({ title }: { title?: string }) =>
      React.createElement('span', null, title),
    Body: Container,
  });

  const Skeleton = Object.assign(() => React.createElement('div'), {
    BodyLg: () => null,
    BodyMd: () => null,
  });

  return {
    Empty: ({
      buttonProps,
      icon,
      title,
    }: {
      buttonProps?: {
        children?: ReactNode;
        onPress?: () => void;
        testID?: string;
      };
      icon?: string;
      title?: ReactNode;
    }) =>
      React.createElement(
        'div',
        { 'data-icon': icon },
        React.createElement('span', null, title),
        buttonProps
          ? React.createElement(
              'button',
              {
                'data-testid': buttonProps.testID,
                onClick: buttonProps.onPress,
                type: 'button',
              },
              buttonProps.children,
            )
          : null,
      ),
    ListView: ({
      ListEmptyComponent,
      data,
      keyExtractor,
      renderItem,
    }: {
      ListEmptyComponent?: ReactNode;
      data: IExportTransactionHistoryTask[];
      keyExtractor: (item: IExportTransactionHistoryTask) => string;
      renderItem: (info: { item: IExportTransactionHistoryTask }) => ReactNode;
    }) =>
      data.length
        ? React.createElement(
            'div',
            null,
            data.map((item) =>
              React.createElement(
                'div',
                { key: keyExtractor(item) },
                renderItem({ item }),
              ),
            ),
          )
        : ListEmptyComponent,
    Page,
    Skeleton,
    Stack: Container,
    useMedia: () => ({ gtMd: false }),
  };
});

function renderTaskList() {
  return render(
    <BulkExportHistoryTaskList
      navigation={{ push: jest.fn() } as never}
      route={{} as never}
    />,
  );
}

describe('BulkExportHistoryTaskList', () => {
  beforeEach(() => {
    mockIsLoggedIn = false;
    mockUser.onekeyUserId = undefined;
    mockUser.primeSubscription = { isActive: false };
    mockLoginOneKeyId.mockReset();
    mockLoginOneKeyId.mockResolvedValue(undefined);
    mockFetchExportTransactionHistoryTasks.mockReset();
    mockFetchExportTransactionHistoryTasks.mockResolvedValue({ list: [] });
    mockUseBulkExportHistoryTaskPolling.mockReset();
    mockSyncFromScene.mockClear();
  });

  it('shows a sign-in empty state until OneKey ID login, then loads history without Prime', async () => {
    const { rerender } = renderTaskList();

    expect(screen.getByText(ETranslations.export_history__title)).toBeTruthy();
    expect(
      screen.getByText(ETranslations.sign_in_to_onekey_id__title),
    ).toBeTruthy();
    expect(screen.getByTestId('bulk-export-history-task-list-sign-in')).toBe(
      screen.getByText(ETranslations.global_sign_in),
    );
    expect(mockFetchExportTransactionHistoryTasks).not.toHaveBeenCalled();
    expect(mockUseBulkExportHistoryTaskPolling).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByTestId('bulk-export-history-task-list-sign-in'),
    );

    expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
    expect(mockLoginOneKeyId).toHaveBeenCalledWith();

    mockIsLoggedIn = true;
    mockUser.onekeyUserId = 'user-a';
    rerender(
      <BulkExportHistoryTaskList
        navigation={{ push: jest.fn() } as never}
        route={{} as never}
      />,
    );

    await waitFor(() => {
      expect(mockFetchExportTransactionHistoryTasks).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText(ETranslations.global_no_data)).toBeTruthy();
    });
    expect(
      screen.queryByText(ETranslations.sign_in_to_onekey_id__title),
    ).toBeNull();
    expect(screen.queryByText(ETranslations.global_sign_in)).toBeNull();
  });

  it('unmounts history on logout so a late response cannot redisplay records', async () => {
    const task = createTask({ id: 11, status: 'processing' });
    mockIsLoggedIn = true;
    mockUser.onekeyUserId = 'user-a';
    mockFetchExportTransactionHistoryTasks.mockResolvedValue({
      list: [task],
    });

    const { rerender } = renderTaskList();

    await waitFor(() => {
      expect(screen.getByTestId('bulk-export-history-task-11')).toBeTruthy();
    });
    expect(mockUseBulkExportHistoryTaskPolling).toHaveBeenCalled();

    mockIsLoggedIn = false;
    mockUser.onekeyUserId = undefined;
    mockUseBulkExportHistoryTaskPolling.mockClear();
    rerender(
      <BulkExportHistoryTaskList
        navigation={{ push: jest.fn() } as never}
        route={{} as never}
      />,
    );

    expect(screen.queryByTestId('bulk-export-history-task-11')).toBeNull();
    expect(
      screen.getByText(ETranslations.sign_in_to_onekey_id__title),
    ).toBeTruthy();
    expect(mockUseBulkExportHistoryTaskPolling).not.toHaveBeenCalled();

    let resolveFetch:
      | ((value: { list: IExportTransactionHistoryTask[] }) => void)
      | undefined;
    mockFetchExportTransactionHistoryTasks.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    mockIsLoggedIn = true;
    mockUser.onekeyUserId = 'user-a';
    rerender(
      <BulkExportHistoryTaskList
        navigation={{ push: jest.fn() } as never}
        route={{} as never}
      />,
    );

    await waitFor(() => {
      expect(resolveFetch).toBeDefined();
    });

    mockIsLoggedIn = false;
    mockUser.onekeyUserId = undefined;
    mockUseBulkExportHistoryTaskPolling.mockClear();
    rerender(
      <BulkExportHistoryTaskList
        navigation={{ push: jest.fn() } as never}
        route={{} as never}
      />,
    );

    await act(async () => {
      resolveFetch?.({ list: [task] });
    });

    expect(screen.queryByTestId('bulk-export-history-task-11')).toBeNull();
    expect(
      screen.getByText(ETranslations.sign_in_to_onekey_id__title),
    ).toBeTruthy();
    expect(mockUseBulkExportHistoryTaskPolling).not.toHaveBeenCalled();
  });

  it('remounts the list when the OneKey ID changes', async () => {
    const taskA = createTask({ id: 21 });
    const taskB = createTask({ id: 22 });
    mockIsLoggedIn = true;
    mockUser.onekeyUserId = 'user-a';
    mockFetchExportTransactionHistoryTasks.mockResolvedValue({
      list: [taskA],
    });

    const { rerender } = renderTaskList();

    await waitFor(() => {
      expect(screen.getByTestId('bulk-export-history-task-21')).toBeTruthy();
    });
    expect(mockFetchExportTransactionHistoryTasks).toHaveBeenCalledTimes(1);

    mockUser.onekeyUserId = 'user-b';
    mockFetchExportTransactionHistoryTasks.mockResolvedValue({
      list: [taskB],
    });
    rerender(
      <BulkExportHistoryTaskList
        navigation={{ push: jest.fn() } as never}
        route={{} as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('bulk-export-history-task-22')).toBeTruthy();
    });
    expect(screen.queryByTestId('bulk-export-history-task-21')).toBeNull();
    expect(mockFetchExportTransactionHistoryTasks).toHaveBeenCalledTimes(2);
  });
});
