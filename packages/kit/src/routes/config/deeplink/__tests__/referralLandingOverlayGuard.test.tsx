import type { ReactElement } from 'react';
import { isValidElement } from 'react';

import { CommonActions } from '@react-navigation/native';

import {
  Dialog,
  Toast,
  closeAllDialogInstances,
  getDialogInstances,
  getFormInstances,
  isNativeTablet,
  rootNavigationRef,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  hasReferralBlockingOverlayOpen,
  showReferralBlockingOverlayToast,
} from '../referralLandingOverlayGuard';

const mockToastCloses: jest.Mock[] = [];

jest.mock('@onekeyhq/components', () => ({
  Button: 'Button',
  Dialog: {
    show: jest.fn(() => ({
      close: jest.fn(),
      getForm: jest.fn(),
      isExist: jest.fn(() => true),
    })),
  },
  Toast: {
    message: jest.fn(() => {
      const close = jest.fn();
      mockToastCloses.push(close);
      return {
        close,
      };
    }),
  },
  closeAllDialogInstances: jest.fn(() => Promise.resolve()),
  getFormInstances: jest.fn(() => []),
  getDialogInstances: jest.fn(() => []),
  isNativeTablet: jest.fn(() => false),
  rootNavigationRef: {
    current: {
      dispatch: jest.fn(),
      getRootState: jest.fn(),
    },
  },
}));

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((payload) => ({ payload, type: 'RESET' })),
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      formatMessage: jest.fn(({ id }) => `translated:${id}`),
    },
  },
}));

type IRootRoute = {
  key?: string;
  name: ERootRoutes;
};

type IRootState = {
  index: number;
  routes: IRootRoute[];
};

const mockedToastMessage = Toast.message as jest.MockedFunction<
  typeof Toast.message
>;
const mockedCloseAllDialogInstances =
  closeAllDialogInstances as jest.MockedFunction<
    typeof closeAllDialogInstances
  >;
const mockedDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;
const mockedGetFormInstances = getFormInstances as jest.MockedFunction<
  typeof getFormInstances
>;
const mockedGetDialogInstances = getDialogInstances as jest.MockedFunction<
  typeof getDialogInstances
>;
const mockedRootNavigationRef =
  rootNavigationRef as typeof rootNavigationRef & {
    current: {
      dispatch: jest.Mock;
      getRootState: jest.MockedFunction<() => IRootState | undefined>;
    };
  };
const mockedCommonActionsReset = CommonActions.reset as jest.MockedFunction<
  typeof CommonActions.reset
>;
const mockedIsNativeTablet = isNativeTablet as jest.MockedFunction<
  typeof isNativeTablet
>;

function setRootRoutes(
  routes: Array<ERootRoutes | IRootRoute>,
  index = routes.length - 1,
) {
  mockedRootNavigationRef.current.getRootState.mockReturnValue({
    index,
    routes: routes.map((route) =>
      typeof route === 'string' ? { name: route } : route,
    ),
  });
}

function getLatestToastContinueHandler() {
  const toastProps = mockedToastMessage.mock.calls.at(-1)?.[0];
  const actions = toastProps?.actions;
  expect(isValidElement<{ onPress: () => void }>(actions)).toBe(true);
  return (actions as ReactElement<{ onPress: () => void }>).props.onPress;
}

function createFormInstance({
  defaultValues,
  values,
}: {
  defaultValues: Record<string, string>;
  values: Record<string, string>;
}) {
  return {
    formState: {
      defaultValues,
    },
    getValues: jest.fn(() => values),
  } as unknown as ReturnType<typeof getFormInstances>[number];
}

async function flushAsyncTasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('referralLandingOverlayGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToastCloses.splice(0);
    mockedCloseAllDialogInstances.mockResolvedValue(undefined);
    mockedGetFormInstances.mockReturnValue([]);
    mockedGetDialogInstances.mockReturnValue([]);
    mockedIsNativeTablet.mockReturnValue(false);
    mockedRootNavigationRef.current.dispatch.mockReset();
    mockedRootNavigationRef.current.dispatch.mockImplementation((action) => {
      const payload = (action as { payload?: IRootState }).payload;
      if (payload) {
        mockedRootNavigationRef.current.getRootState.mockReturnValue(payload);
      }
    });
    mockedCommonActionsReset.mockImplementation((payload) => ({
      payload,
      type: 'RESET',
    }));
    setRootRoutes([ERootRoutes.Main], 0);
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not block when no dialog or root overlay is open', () => {
    expect(hasReferralBlockingOverlayOpen()).toBe(false);
    expect(showReferralBlockingOverlayToast({ onContinue: jest.fn() })).toBe(
      false,
    );
    expect(mockedToastMessage).not.toHaveBeenCalled();
  });

  it('blocks supported root overlay routes only', () => {
    const blockingRoutes = [
      ERootRoutes.Modal,
      ERootRoutes.iOSFullScreen,
      ERootRoutes.FullScreenPush,
      ERootRoutes.WebView,
      ERootRoutes.Onboarding,
      ERootRoutes.PermissionWebDevice,
    ];

    for (const route of blockingRoutes) {
      setRootRoutes([ERootRoutes.Main, route]);
      expect(hasReferralBlockingOverlayOpen()).toBe(true);
    }

    setRootRoutes([ERootRoutes.Onboarding], 0);
    expect(hasReferralBlockingOverlayOpen()).toBe(false);

    setRootRoutes([ERootRoutes.Main, ERootRoutes.NotFound]);
    expect(hasReferralBlockingOverlayOpen()).toBe(false);
  });

  it('blocks when any dialog instance is open', () => {
    mockedGetDialogInstances.mockReturnValue([
      {
        close: jest.fn(),
        getForm: jest.fn(),
        isExist: jest.fn(() => true),
      },
    ]);

    expect(hasReferralBlockingOverlayOpen()).toBe(true);
  });

  it('closes blocking overlays before continuing referral binding', async () => {
    const order: string[] = [];
    setRootRoutes([ERootRoutes.Main, ERootRoutes.WebView, ERootRoutes.Modal]);
    mockedCloseAllDialogInstances.mockImplementation(async () => {
      order.push('closeDialogs');
    });
    mockedRootNavigationRef.current.dispatch.mockImplementation(() => {
      order.push('resetRootOverlay');
      setRootRoutes([ERootRoutes.Main], 0);
    });
    jest.spyOn(timerUtils, 'wait').mockImplementation(async () => {
      order.push('wait');
    });
    const onContinue = jest.fn(async () => {
      order.push('continue');
    });

    expect(showReferralBlockingOverlayToast({ onContinue })).toBe(true);
    expect(mockedToastMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        actionsAlign: 'left',
        duration: 60 * 60 * 1000,
        message: `translated:${ETranslations.referral_close_current_popup_desc}`,
        title: `translated:${ETranslations.referral_close_current_popup_title}`,
      }),
    );

    getLatestToastContinueHandler()();
    await flushAsyncTasks();

    expect(mockedCloseAllDialogInstances).toHaveBeenCalledTimes(1);
    expect(mockedCommonActionsReset).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 0,
        routes: [{ name: ERootRoutes.Main }],
      }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      'closeDialogs',
      'resetRootOverlay',
      'wait',
      'continue',
    ]);
  });

  it('hides the close action on tablets', () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    mockedIsNativeTablet.mockReturnValue(true);

    expect(showReferralBlockingOverlayToast({ onContinue: jest.fn() })).toBe(
      true,
    );

    const toastProps = mockedToastMessage.mock.calls.at(-1)?.[0];
    expect(toastProps?.actions).toBeUndefined();
    expect(toastProps?.actionsAlign).toBeUndefined();
  });

  it('asks for confirmation before closing dirty form dialogs', async () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    mockedGetFormInstances.mockReturnValue([
      createFormInstance({
        defaultValues: { name: 'old' },
        values: { name: 'new' },
      }),
    ]);
    mockedCloseAllDialogInstances.mockImplementation(async () => {
      setRootRoutes([ERootRoutes.Main], 0);
    });
    const onContinue = jest.fn();

    showReferralBlockingOverlayToast({ onContinue });
    getLatestToastContinueHandler()();
    await flushAsyncTasks();

    expect(mockedDialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        description: `translated:${ETranslations.global_close_confirm_description}`,
        showCancelButton: true,
        showConfirmButton: true,
        showFooter: true,
        title: `translated:${ETranslations.global_close}`,
      }),
    );
    expect(mockedCloseAllDialogInstances).not.toHaveBeenCalled();

    const confirmDirtyClose = mockedDialogShow.mock.calls.at(-1)?.[0]
      .onConfirm as (() => void) | undefined;
    confirmDirtyClose?.();
    await flushAsyncTasks();

    expect(mockedCloseAllDialogInstances).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('keeps dirty form dialogs open when close confirmation is canceled', async () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    mockedGetFormInstances.mockReturnValue([
      createFormInstance({
        defaultValues: { name: 'old' },
        values: { name: 'new' },
      }),
    ]);
    const onContinue = jest.fn();

    showReferralBlockingOverlayToast({ onContinue });
    getLatestToastContinueHandler()();
    await flushAsyncTasks();

    const cancelDirtyClose = mockedDialogShow.mock.calls.at(-1)?.[0]
      .onCancel as (() => void) | undefined;
    cancelDirtyClose?.();
    await flushAsyncTasks();

    expect(mockedCloseAllDialogInstances).not.toHaveBeenCalled();
    expect(mockedCommonActionsReset).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('ignores stale toast continue actions after a newer referral toast is shown', async () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    const onFirstContinue = jest.fn();
    const onSecondContinue = jest.fn();

    showReferralBlockingOverlayToast({ onContinue: onFirstContinue });
    const firstContinue = getLatestToastContinueHandler();

    showReferralBlockingOverlayToast({ onContinue: onSecondContinue });
    const secondContinue = getLatestToastContinueHandler();

    firstContinue();
    await flushAsyncTasks();
    expect(onFirstContinue).not.toHaveBeenCalled();

    secondContinue();
    await flushAsyncTasks();
    expect(onSecondContinue).toHaveBeenCalledTimes(1);
  });

  it('does not let a stale toast action close a newer referral toast', async () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);

    showReferralBlockingOverlayToast({ onContinue: jest.fn() });
    const firstContinue = getLatestToastContinueHandler();
    showReferralBlockingOverlayToast({ onContinue: jest.fn() });

    expect(mockToastCloses).toHaveLength(2);
    expect(mockToastCloses[0]).toHaveBeenCalledTimes(1);
    expect(mockToastCloses[1]).not.toHaveBeenCalled();

    firstContinue();
    await flushAsyncTasks();

    expect(mockedCloseAllDialogInstances).not.toHaveBeenCalled();
    expect(mockToastCloses[0]).toHaveBeenCalledTimes(2);
    expect(mockToastCloses[1]).not.toHaveBeenCalled();
  });

  it('does not continue a stale referral when a newer referral can navigate immediately', async () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    let resolveCloseDialogs: (() => void) | undefined;
    mockedCloseAllDialogInstances.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCloseDialogs = resolve;
        }),
    );
    const onFirstContinue = jest.fn();
    const onSecondContinue = jest.fn();

    showReferralBlockingOverlayToast({ onContinue: onFirstContinue });
    const firstContinue = getLatestToastContinueHandler();
    firstContinue();
    await Promise.resolve();

    setRootRoutes([ERootRoutes.Main], 0);
    expect(
      showReferralBlockingOverlayToast({ onContinue: onSecondContinue }),
    ).toBe(false);
    resolveCloseDialogs?.();
    await flushAsyncTasks();

    expect(onFirstContinue).not.toHaveBeenCalled();
    expect(mockedCommonActionsReset).not.toHaveBeenCalled();
  });

  it('does not close overlays when the caller is stale before pressing the toast action', async () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    const onContinue = jest.fn();

    showReferralBlockingOverlayToast({
      shouldContinue: () => false,
      onContinue,
    });

    getLatestToastContinueHandler()();
    await flushAsyncTasks();

    expect(mockedCloseAllDialogInstances).not.toHaveBeenCalled();
    expect(mockedCommonActionsReset).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('does not reset overlays when the caller becomes stale while dialogs are closing', async () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    let shouldContinue = true;
    mockedCloseAllDialogInstances.mockImplementation(async () => {
      shouldContinue = false;
    });
    const onContinue = jest.fn();

    showReferralBlockingOverlayToast({
      shouldContinue: () => shouldContinue,
      onContinue,
    });

    getLatestToastContinueHandler()();
    await flushAsyncTasks();

    expect(mockedCloseAllDialogInstances).toHaveBeenCalledTimes(1);
    expect(mockedCommonActionsReset).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('does not reset a newer referral modal after becoming stale during dialog closing', async () => {
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    let resolveCloseDialogs: (() => void) | undefined;
    mockedCloseAllDialogInstances.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCloseDialogs = resolve;
        }),
    );
    const onFirstContinue = jest.fn();

    showReferralBlockingOverlayToast({ onContinue: onFirstContinue });
    const firstContinue = getLatestToastContinueHandler();
    firstContinue();
    await Promise.resolve();

    showReferralBlockingOverlayToast({ onContinue: jest.fn() });
    setRootRoutes([ERootRoutes.Main, ERootRoutes.Modal]);
    resolveCloseDialogs?.();
    await flushAsyncTasks();

    expect(mockedCommonActionsReset).not.toHaveBeenCalled();
    expect(onFirstContinue).not.toHaveBeenCalled();
  });

  it('does not remove root overlays opened after the toast action starts', async () => {
    setRootRoutes([
      { key: 'main', name: ERootRoutes.Main },
      { key: 'old-modal', name: ERootRoutes.Modal },
    ]);
    mockedCloseAllDialogInstances.mockImplementation(async () => {
      setRootRoutes([
        { key: 'main', name: ERootRoutes.Main },
        { key: 'old-modal', name: ERootRoutes.Modal },
        { key: 'new-webview', name: ERootRoutes.WebView },
      ]);
    });
    const onContinue = jest.fn();

    showReferralBlockingOverlayToast({ onContinue });
    getLatestToastContinueHandler()();
    await flushAsyncTasks();

    expect(mockedCommonActionsReset).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 1,
        routes: [
          expect.objectContaining({ name: ERootRoutes.Main }),
          expect.objectContaining({ name: ERootRoutes.WebView }),
        ],
      }),
    );
    expect(onContinue).not.toHaveBeenCalled();
  });
});
