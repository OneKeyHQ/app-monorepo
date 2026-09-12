/**
 * @jest-environment jsdom
 */

import { inAppStateLockDialogProps, useResetApp } from '.';

import { act, renderHook } from '@testing-library/react';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const MockComponent = () => null;
  const dialogShow = jest.fn();
  return {
    __dialogShow: dialogShow,
    Dialog: {
      Form: MockComponent,
      FormField: MockComponent,
      show: dialogShow,
    },
    Input: MockComponent,
    Portal: {
      Constant: {
        APP_STATE_LOCK_CONTAINER_OVERLAY: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      },
    },
  };
});

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_reset: 'global_reset',
    reset_app_desc: 'reset_app_desc',
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: {
      page: {
        resetApp: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const platformEnv = {
    isExtensionUiPopup: false,
    isNative: false,
  };
  return {
    __esModule: true,
    __platformEnv: platformEnv,
    default: platformEnv,
  };
});

jest.mock('@onekeyhq/shared/src/utils/resetUtils', () => ({
  __esModule: true,
  default: {
    endResetting: jest.fn(),
    startResetting: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => {
  const isAppLocked = jest.fn();
  return {
    __esModule: true,
    __isAppLocked: isAppLocked,
    default: {
      serviceApp: {
        isAppLocked,
        resetApp: jest.fn(),
      },
    },
  };
});

jest.mock('./useLanguageSelector', () => ({}));
jest.mock('./useLocaleOptions', () => ({}));

function getMocks() {
  return {
    dialogShow: jest.requireMock('@onekeyhq/components')
      .__dialogShow as jest.Mock,
    isAppLocked: jest.requireMock(
      '../../../background/instance/backgroundApiProxy',
    ).__isAppLocked as jest.Mock,
  };
}

describe('inAppStateLockDialogProps', () => {
  it('renders lock-screen dialogs inside the lock overlay on every platform', () => {
    expect(inAppStateLockDialogProps).toMatchObject({
      isOverTopAllViews: false,
      portalContainer: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
    });
  });

  it('stops the sheet form of a lock-screen dialog from portalling to the body', () => {
    expect(inAppStateLockDialogProps.sheetProps).toMatchObject({
      portalProps: { passThrough: true },
    });
  });
});

describe('useResetApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.requireMock(
      '@onekeyhq/shared/src/platformEnv',
    ).__platformEnv.isNative = false;
    getMocks().isAppLocked.mockResolvedValue(true);
  });

  it('opens the lock-screen reset dialog with the lock overlay props', async () => {
    const { result } = renderHook(() => useResetApp({ inAppStateLock: true }));

    await act(async () => {
      await result.current();
    });

    expect(getMocks().dialogShow).toHaveBeenCalledWith(
      expect.objectContaining(inAppStateLockDialogProps),
    );
  });

  it('leaves an unlocked reset dialog outside the lock overlay', async () => {
    const { result } = renderHook(() => useResetApp());

    await act(async () => {
      await result.current();
    });

    expect(getMocks().dialogShow).toHaveBeenCalledWith(
      expect.not.objectContaining({
        portalContainer: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      }),
    );
  });

  it('keeps the native top-level overlay for an unlocked reset dialog', async () => {
    // Settings → Reset opens from a native modal page on iOS; without this the
    // dialog renders underneath it.
    jest.requireMock(
      '@onekeyhq/shared/src/platformEnv',
    ).__platformEnv.isNative = true;
    const { result } = renderHook(() => useResetApp());

    await act(async () => {
      await result.current();
    });

    expect(getMocks().dialogShow).toHaveBeenCalledWith(
      expect.objectContaining({ isOverTopAllViews: true }),
    );
  });

  it('still hands the lock screen its own container on native', async () => {
    jest.requireMock(
      '@onekeyhq/shared/src/platformEnv',
    ).__platformEnv.isNative = true;
    const { result } = renderHook(() => useResetApp({ inAppStateLock: true }));

    await act(async () => {
      await result.current();
    });

    // The lock-screen props must win over the native default above.
    expect(getMocks().dialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverTopAllViews: false,
        portalContainer: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      }),
    );
  });
});
