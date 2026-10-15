/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, fireEvent, render, waitFor } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IIdentityExitPlan,
  IIdentityExitPlanId,
  IIdentityExitReceipt,
} from '@onekeyhq/shared/types/prime/identityExitTypes';

import { SectionFieldItem } from './SectionFieldItem';

type ITestDialog = {
  title: string;
  description: string;
  renderContent: ReactNode;
  onClose: () => void;
};

const mockPrepareExit = jest.fn<Promise<IIdentityExitPlan>, [unknown]>();
const mockExecuteExit = jest.fn<Promise<IIdentityExitReceipt>, [unknown]>();
const mockUpdateSetting = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockToastError = jest.fn<void, unknown[]>();
const mockClose = jest.fn<Promise<void>, []>();
const mockShowDialog = jest.fn((options: ITestDialog) => {
  mockClose.mockImplementation(async () => options.onClose());
  return { close: mockClose };
});
let mockTestEndpoint = false;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/shared/src/locale', () =>
  jest.requireActual<
    typeof import('@onekeyhq/shared/src/locale/enum/translations')
  >('@onekeyhq/shared/src/locale/enum/translations'),
);
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { prime: { subscription: { onekeyIdLogout: jest.fn() } } },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceIdentityExit: {
      prepareIdentityExit: (intent: unknown) => mockPrepareExit(intent),
      executeIdentityExit: (options: unknown) => mockExecuteExit(options),
    },
    serviceDevSetting: {
      updateDevSetting: (...args: unknown[]) => mockUpdateSetting(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [
    { enabled: true, settings: { enableTestEndpoint: mockTestEndpoint } },
  ],
}));
jest.mock('./DevSettingsSearchContext', () => ({
  useMatchesDevSearch: () => true,
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Toast: { error: (...args: unknown[]) => mockToastError(...args) },
    Checkbox: ({
      value,
      onChange,
      label,
    }: {
      value: boolean;
      onChange: (value: boolean) => void;
      label: string;
    }) =>
      React.createElement('input', {
        type: 'checkbox',
        checked: value,
        'aria-label': label,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.checked),
      }),
    Dialog: {
      show: (options: ITestDialog) => mockShowDialog(options),
      Footer: ({
        onConfirm,
        onCancel,
        confirmButtonProps,
      }: {
        onConfirm: (options: {
          close: () => Promise<void>;
          preventClose: () => void;
        }) => Promise<void>;
        onCancel: () => void;
        confirmButtonProps: { disabled: boolean };
      }) =>
        React.createElement(
          'div',
          null,
          React.createElement('button', { onClick: onCancel }, 'Cancel'),
          React.createElement(
            'button',
            {
              disabled: confirmButtonProps.disabled,
              onClick: () =>
                void onConfirm({ close: mockClose, preventClose: jest.fn() }),
            },
            'Confirm',
          ),
        ),
    },
  };
});

function TestSwitch({
  value,
  onChange,
}: {
  value?: boolean;
  onChange?: (value: boolean) => Promise<void>;
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      aria-checked={Boolean(value)}
      checked={Boolean(value)}
      onChange={(event) => void onChange?.(event.target.checked)}
    />
  );
}

async function openEnvironmentDialog() {
  const view = render(
    <SectionFieldItem name="enableTestEndpoint" title="API Switch">
      <TestSwitch />
    </SectionFieldItem>,
  );
  fireEvent.click(view.getByRole('switch'));
  await waitFor(() => expect(mockShowDialog).toHaveBeenCalledTimes(1));
  const options = mockShowDialog.mock.calls[0][0];
  expect(options.title).toBe(
    ETranslations.log_out_onekey_id_and_keyless__title,
  );
  expect(options.description).toContain(ETranslations.log_out_wallet_desc);
  expect(mockUpdateSetting).not.toHaveBeenCalled();
  render(options.renderContent);
  return view;
}

describe('API environment switch confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTestEndpoint = false;
    mockPrepareExit.mockResolvedValue({
      status: 'ready',
      planId: 'environment-exit' as IIdentityExitPlanId,
      expiresAt: Number.MAX_SAFE_INTEGER,
      presentation: { type: 'switchEnvironment' },
      confirmation: { type: 'keylessRemovalAcknowledgement' },
    });
    mockExecuteExit.mockResolvedValue({
      status: 'completed',
      oneKeyIdLoggedOut: true,
      removedWalletId: 'keyless-wallet',
    });
  });
  afterEach(async () => {
    await act(async () => {
      await mockClose();
    });
  });

  test.each([false, true])(
    'requires the existing logout acknowledgement before switching from test=%s',
    async (wasTest) => {
      mockTestEndpoint = wasTest;
      const view = await openEnvironmentDialog();
      expect(mockPrepareExit).toHaveBeenCalledWith({
        type: 'switchEnvironment',
        scene: 'devSettings',
      });
      expect(view.getByText('Confirm')).toHaveProperty('disabled', true);
      fireEvent.click(view.getByRole('checkbox'));
      fireEvent.click(view.getByText('Confirm'));
      await waitFor(() =>
        expect(mockUpdateSetting).toHaveBeenCalledWith(
          'enableTestEndpoint',
          !wasTest,
        ),
      );
      expect(mockExecuteExit).toHaveBeenCalledWith({
        planId: 'environment-exit',
        acknowledgement: 'keylessWalletRemoval',
      });
      expect(mockExecuteExit.mock.invocationCallOrder[0]).toBeLessThan(
        mockUpdateSetting.mock.invocationCallOrder[0],
      );
    },
  );

  test('keeps the environment and identities when the dialog is cancelled', async () => {
    const view = await openEnvironmentDialog();
    fireEvent.click(view.getByText('Cancel'));
    await waitFor(() => expect(mockClose).toHaveBeenCalled());
    expect(mockExecuteExit).not.toHaveBeenCalled();
    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });

  test('waits for logout to finish and ignores repeated switch clicks', async () => {
    let finishLogout!: (receipt: IIdentityExitReceipt) => void;
    mockExecuteExit.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLogout = resolve;
        }),
    );
    const view = await openEnvironmentDialog();
    fireEvent.click(view.getByRole('switch'));
    expect(mockPrepareExit).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByRole('checkbox'));
    fireEvent.click(view.getByText('Confirm'));
    await waitFor(() => expect(mockExecuteExit).toHaveBeenCalledTimes(1));
    expect(mockUpdateSetting).not.toHaveBeenCalled();
    await act(async () => {
      finishLogout({ status: 'completed', oneKeyIdLoggedOut: true });
    });
    expect(mockUpdateSetting).toHaveBeenCalledTimes(1);
  });

  test.each(['cancelled', 'blocked'] as const)(
    'keeps the environment when logout is %s',
    async (status) => {
      jest.spyOn(console, 'error').mockImplementation();
      mockExecuteExit.mockResolvedValueOnce(
        status === 'cancelled'
          ? { status }
          : { status, code: 'STATE_CHANGED', message: 'Identity changed' },
      );
      const view = await openEnvironmentDialog();
      fireEvent.click(view.getByRole('checkbox'));
      fireEvent.click(view.getByText('Confirm'));
      await waitFor(() => expect(mockClose).toHaveBeenCalled());
      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledTimes(
        status === 'blocked' ? 1 : 0,
      );
      jest.restoreAllMocks();
    },
  );
  test('shows an error when the guarded environment write fails after logout', async () => {
    jest.spyOn(console, 'error').mockImplementation();
    mockUpdateSetting.mockRejectedValueOnce(
      new Error('Keyless wallet changed during logout'),
    );
    const view = await openEnvironmentDialog();
    fireEvent.click(view.getByRole('checkbox'));
    fireEvent.click(view.getByText('Confirm'));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(view.getByRole('switch')).toHaveProperty('checked', false);
    jest.restoreAllMocks();
  });
});
