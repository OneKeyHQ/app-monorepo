/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';

import { useIdentityExitFlow } from '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IIdentityExitPlan,
  IIdentityExitPlanId,
  IIdentityExitReceipt,
} from '@onekeyhq/shared/types/prime/identityExitTypes';

import { SectionFieldItem } from './SectionFieldItem';

const mockPrepareExit = jest.fn<Promise<IIdentityExitPlan>, [unknown]>();
const mockExecuteExit = jest.fn<Promise<IIdentityExitReceipt>, [unknown]>();
const mockUpdateSetting = jest
  .fn<Promise<void>, unknown[]>()
  .mockResolvedValue(undefined);
const mockToastError = jest.fn<void, unknown[]>();
const mockClose = jest.fn<Promise<void>, []>();
type IDialogOptions = {
  onClose: () => void;
  title: string;
  renderContent: ReactNode;
};
const mockShowDialog = jest.fn((options: IDialogOptions) => {
  mockClose.mockImplementation(async () => options.onClose());
  return { close: mockClose };
});
let mockTestEndpoint = false;
let mockDeveloperMode = true;

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
    {
      enabled: mockDeveloperMode,
      settings: { enableTestEndpoint: mockTestEndpoint },
    },
  ],
}));
jest.mock('./DevSettingsSearchContext', () => ({
  useMatchesDevSearch: () => true,
}));
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: (...args: unknown[]) => mockToastError(...args) },
  Dialog: {
    show: (options: IDialogOptions) => mockShowDialog(options),
    Footer: ({
      onConfirm,
      onConfirmText,
    }: {
      onConfirm: (params: {
        preventClose: () => void;
        close: () => Promise<void>;
      }) => Promise<void>;
      onConfirmText: string;
    }) => (
      <button
        type="button"
        onClick={() =>
          void onConfirm({ preventClose: () => undefined, close: mockClose })
        }
      >
        {onConfirmText}
      </button>
    ),
  },
}));

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

function triggerEnvironmentSwitch() {
  const view = render(
    <SectionFieldItem name="enableTestEndpoint" title="API Switch">
      <TestSwitch />
    </SectionFieldItem>,
  );
  fireEvent.click(view.getByRole('switch'));
  return view;
}

describe('API environment switch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTestEndpoint = false;
    mockDeveloperMode = true;
    mockPrepareExit.mockResolvedValue({
      status: 'ready',
      planId: 'environment-exit' as IIdentityExitPlanId,
      expiresAt: Number.MAX_SAFE_INTEGER,
      presentation: { type: 'switchEnvironment' },
      confirmation: { type: 'normal' },
    });
    mockExecuteExit.mockResolvedValue({
      status: 'completed',
      oneKeyIdLoggedOut: true,
      removedWalletId: 'keyless-wallet',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([false, true])(
    'switches from test=%s after the required confirmation',
    async (wasTest) => {
      mockTestEndpoint = wasTest;
      triggerEnvironmentSwitch();
      if (wasTest) {
        await waitFor(() => expect(mockShowDialog).toHaveBeenCalledTimes(1));
        expect(mockExecuteExit).not.toHaveBeenCalled();
        expect(mockUpdateSetting).not.toHaveBeenCalled();
        const { renderContent, title } = mockShowDialog.mock.calls[0][0];
        expect(title).toBe(ETranslations.prime_onekeyid_log_out);
        const dialog = render(renderContent);
        fireEvent.click(
          dialog.getByRole('button', { name: ETranslations.prime_log_out }),
        );
      }
      await waitFor(() => expect(mockUpdateSetting).toHaveBeenCalled());
      expect(mockPrepareExit).toHaveBeenCalledWith({
        type: 'switchEnvironment',
        scene: 'devSettings',
      });
      expect(mockShowDialog).toHaveBeenCalledTimes(wasTest ? 1 : 0);
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        'enableTestEndpoint',
        !wasTest,
      );
      expect(mockExecuteExit).toHaveBeenCalledWith({
        planId: 'environment-exit',
        acknowledgement: 'oneKeyIdLogout',
      });
      expect(mockExecuteExit.mock.invocationCallOrder[0]).toBeLessThan(
        mockUpdateSetting.mock.invocationCallOrder[0],
      );
    },
  );

  test('keeps the test environment when the user dismisses confirmation', async () => {
    mockTestEndpoint = true;
    const view = triggerEnvironmentSwitch();
    await waitFor(() => expect(mockShowDialog).toHaveBeenCalledTimes(1));
    await act(async () => mockClose());
    expect(mockExecuteExit).not.toHaveBeenCalled();
    expect(mockUpdateSetting).not.toHaveBeenCalled();
    expect(view.getByRole('switch')).toHaveProperty('checked', true);
  });

  test('updates the environment when identity exit is already completed', async () => {
    mockPrepareExit.mockResolvedValueOnce({
      status: 'completed',
      receipt: { status: 'completed', oneKeyIdLoggedOut: true },
    });
    triggerEnvironmentSwitch();
    await waitFor(() => expect(mockUpdateSetting).toHaveBeenCalledTimes(1));
    expect(mockExecuteExit).not.toHaveBeenCalled();
    expect(mockShowDialog).not.toHaveBeenCalled();
  });

  test('waits for logout to finish and ignores repeated switch clicks', async () => {
    let finishLogout!: (receipt: IIdentityExitReceipt) => void;
    mockExecuteExit.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLogout = resolve;
        }),
    );
    const view = triggerEnvironmentSwitch();
    await waitFor(() => expect(mockExecuteExit).toHaveBeenCalledTimes(1));
    fireEvent.click(view.getByRole('switch'));
    expect(mockPrepareExit).toHaveBeenCalledTimes(1);
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
      triggerEnvironmentSwitch();
      await waitFor(() => expect(mockExecuteExit).toHaveBeenCalledTimes(1));
      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledTimes(
        status === 'blocked' ? 1 : 0,
      );
    },
  );
  test('shows an error when the guarded environment write fails after logout', async () => {
    jest.spyOn(console, 'error').mockImplementation();
    mockUpdateSetting.mockRejectedValueOnce(
      new Error('Keyless wallet changed during logout'),
    );
    const view = triggerEnvironmentSwitch();
    await waitFor(() => expect(mockExecuteExit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(view.getByRole('switch')).toHaveProperty('checked', false);
  });

  test('keeps the environment when executing logout fails', async () => {
    jest.spyOn(console, 'error').mockImplementation();
    mockExecuteExit.mockRejectedValueOnce(new Error('Logout failed'));
    triggerEnvironmentSwitch();
    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    expect(mockUpdateSetting).not.toHaveBeenCalled();
    expect(mockShowDialog).not.toHaveBeenCalled();
  });

  test('keeps the Keyless removal confirmation for a destructive plan', async () => {
    mockTestEndpoint = true;
    mockPrepareExit.mockResolvedValueOnce({
      status: 'ready',
      planId: 'environment-exit' as IIdentityExitPlanId,
      expiresAt: Number.MAX_SAFE_INTEGER,
      presentation: { type: 'switchEnvironment' },
      confirmation: { type: 'keylessRemovalAcknowledgement' },
    });
    triggerEnvironmentSwitch();
    await waitFor(() => expect(mockShowDialog).toHaveBeenCalledTimes(1));
    expect(mockExecuteExit).not.toHaveBeenCalled();
    await mockClose();
  });

  test.each([false, true])(
    'keeps the confirmation for profile logout with skipConfirmation=%s',
    async (skipConfirmation) => {
      const { result } = renderHook(useIdentityExitFlow);
      const exitPromise = result.current.run(
        { type: 'logoutOneKeyId', scene: 'profile' },
        { skipConfirmation },
      );
      await waitFor(() => expect(mockShowDialog).toHaveBeenCalledTimes(1));
      expect(mockExecuteExit).not.toHaveBeenCalled();
      await mockClose();
      await expect(exitPromise).resolves.toEqual({ status: 'cancelled' });
    },
  );

  test('keeps the confirmation when developer mode is disabled', async () => {
    mockDeveloperMode = false;
    const { result } = renderHook(useIdentityExitFlow);
    const exitPromise = result.current.run(
      { type: 'switchEnvironment', scene: 'devSettings' },
      { skipConfirmation: true },
    );
    await waitFor(() => expect(mockShowDialog).toHaveBeenCalledTimes(1));
    expect(mockExecuteExit).not.toHaveBeenCalled();
    await mockClose();
    await expect(exitPromise).resolves.toEqual({ status: 'cancelled' });
  });
});
