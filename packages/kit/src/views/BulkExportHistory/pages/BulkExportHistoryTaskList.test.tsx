/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalBulkExportHistoryParamList } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';

import BulkExportHistoryTaskList from './BulkExportHistoryTaskList';

const HISTORY_BOUNDARY_TEST_ID = 'bulk-export-history-history-boundary';
const mockLoginOneKeyId = jest.fn<Promise<void>, []>();
let mockIsLoggedIn = false;
const mockUser: {
  onekeyUserId?: string;
  primeSubscription?: { isActive: boolean };
} = {
  onekeyUserId: undefined,
  primeSubscription: { isActive: false },
};

type ITaskListProps = IPageScreenProps<
  IModalBulkExportHistoryParamList,
  EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList
>;

const taskListProps: ITaskListProps = {
  navigation: { push: jest.fn() } as unknown as ITaskListProps['navigation'],
  route: {
    key: 'bulk-export-history-task-list',
    name: EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList,
  },
};

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

// Remaining mocks only break import-time coupling from the unmounted list tree.
jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerBase',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/views/ChainSelector/hooks/useNetworkOptions',
  () => ({}),
);
jest.mock('../../Staking/components/PageFrame', () => ({}));
jest.mock('../components/BulkExportHistoryDownloadButton', () => ({}));
jest.mock('../components/BulkExportHistoryNetworkAvatars', () => ({}));
jest.mock('../hooks/useBulkExportHistoryTasks', () => ({}));
jest.mock('./BulkExportHistoryTaskStatus', () => ({}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AccountSelectorProviderMirror: () => {
      const [mountedOneKeyUserId] = React.useState(mockUser.onekeyUserId);
      return React.createElement('div', {
        'data-mounted-onekey-user-id': mountedOneKeyUserId,
        'data-testid': HISTORY_BOUNDARY_TEST_ID,
      });
    },
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function Box({ children }: { children?: ReactNode }) {
    return React.createElement('div', null, children);
  }
  const Page = Object.assign(Box, {
    Body: Box,
    Header: ({ title }: { title?: string }) =>
      React.createElement('span', null, title),
  });
  return {
    Empty: ({
      buttonProps,
      description,
      title,
    }: {
      buttonProps?: {
        children?: ReactNode;
        onPress?: () => void;
        testID?: string;
      };
      description?: ReactNode;
      title?: ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement('span', null, title),
        React.createElement('span', null, description),
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
    Page,
  };
});

function renderTaskList() {
  return render(<BulkExportHistoryTaskList {...taskListProps} />);
}

describe('BulkExportHistoryTaskList', () => {
  beforeEach(() => {
    mockIsLoggedIn = false;
    mockUser.onekeyUserId = undefined;
    mockUser.primeSubscription = { isActive: false };
    mockLoginOneKeyId.mockReset();
    mockLoginOneKeyId.mockResolvedValue(undefined);
  });

  it('shows the sign-in empty state and does not mount history until OneKey ID login', () => {
    renderTaskList();

    expect(screen.getByText(ETranslations.export_history__title)).toBeTruthy();
    expect(
      screen.getByText(ETranslations.sign_in_to_onekey_id__title),
    ).toBeTruthy();
    expect(
      screen.getByText(ETranslations.export_history_sign_in__desc),
    ).toBeTruthy();
    expect(screen.getByTestId('bulk-export-history-task-list-sign-in')).toBe(
      screen.getByText(ETranslations.global_sign_in),
    );
    expect(screen.queryByTestId(HISTORY_BOUNDARY_TEST_ID)).toBeNull();

    fireEvent.click(
      screen.getByTestId('bulk-export-history-task-list-sign-in'),
    );

    expect(mockLoginOneKeyId).toHaveBeenCalledTimes(1);
    expect(mockLoginOneKeyId).toHaveBeenCalledWith();
  });

  it('mounts history after sign-in, remounts on OneKey ID change, and unmounts on logout', () => {
    const { rerender } = renderTaskList();

    mockIsLoggedIn = true;
    mockUser.onekeyUserId = 'user-a';
    rerender(<BulkExportHistoryTaskList {...taskListProps} />);

    expect(
      screen.getByTestId(HISTORY_BOUNDARY_TEST_ID).dataset.mountedOnekeyUserId,
    ).toBe('user-a');
    expect(
      screen.queryByText(ETranslations.export_history_sign_in__desc),
    ).toBeNull();

    mockUser.onekeyUserId = 'user-b';
    rerender(<BulkExportHistoryTaskList {...taskListProps} />);

    expect(
      screen.getByTestId(HISTORY_BOUNDARY_TEST_ID).dataset.mountedOnekeyUserId,
    ).toBe('user-b');

    mockIsLoggedIn = false;
    mockUser.onekeyUserId = undefined;
    rerender(<BulkExportHistoryTaskList {...taskListProps} />);

    expect(screen.queryByTestId(HISTORY_BOUNDARY_TEST_ID)).toBeNull();
    expect(
      screen.getByText(ETranslations.export_history_sign_in__desc),
    ).toBeTruthy();
    expect(
      screen.getByTestId('bulk-export-history-task-list-sign-in'),
    ).toBeTruthy();
  });
});
