/**
 * @jest-environment jsdom
 */

import { useResetApp } from '.';

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
    platformEnv: jest.requireMock('@onekeyhq/shared/src/platformEnv')
      .__platformEnv as {
      isNative: boolean;
    },
  };
}

describe('useResetApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = getMocks();
    mocks.isAppLocked.mockResolvedValue(true);
    mocks.platformEnv.isNative = false;
  });

  it('keeps the desktop lock-screen reset dialog inside its portal', async () => {
    const { result } = renderHook(() => useResetApp({ inAppStateLock: true }));

    await act(async () => {
      await result.current();
    });

    expect(getMocks().dialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverTopAllViews: false,
        portalContainer: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      }),
    );
  });

  it('preserves the native over-top rendering behavior', async () => {
    getMocks().platformEnv.isNative = true;
    const { result } = renderHook(() => useResetApp({ inAppStateLock: true }));

    await act(async () => {
      await result.current();
    });

    expect(getMocks().dialogShow).toHaveBeenCalledWith(
      expect.objectContaining({
        isOverTopAllViews: true,
        portalContainer: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      }),
    );
  });
});
