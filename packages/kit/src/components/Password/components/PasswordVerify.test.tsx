/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import {
  EPasswordMode,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';

import { inAppStateLockDialogProps } from '../../../views/Setting/hooks';

import PasswordVerify from './PasswordVerify';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

// jest maps every `@onekeyhq/components/...` specifier onto one shared mock
// module, so this single factory also has to answer the deep
// `src/hooks/useForm` import — served by the real react-hook-form, because this
// suite drives the form instance the component actually builds.
jest.mock('@onekeyhq/components', () => {
  const { createElement, forwardRef } =
    jest.requireActual<typeof import('react')>('react');
  const host = (name: string) => {
    const Host = forwardRef<unknown, { children?: ReactNode }>(
      ({ children }, ref) => createElement(name, { ref }, children),
    );
    Host.displayName = name;
    return Host;
  };
  const Form: any = ({ children }: { children?: unknown }) => children;
  Form.Field = ({ children }: { children?: unknown }) => children;
  const dialogConfirm = jest.fn();
  return {
    __dialogConfirm: dialogConfirm,
    Dialog: { confirm: dialogConfirm },
    Form,
    IconButton: () => null,
    Input: () => null,
    Portal: {
      Constant: {
        APP_STATE_LOCK_CONTAINER_OVERLAY: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      },
    },
    SizableText: host('span'),
    Stack: host('div'),
    XStack: host('div'),
    YStack: host('div'),
    onVisibilityStateChange: () => () => {},
    useForm: jest.requireActual('react-hook-form').useForm,
  };
});

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  usePasswordPersistManualLockStateAtom: () => [{ manualLocking: false }],
}));

jest.mock('@onekeyhq/shared/src/biologyAuth', () => ({
  __esModule: true,
  default: {
    isSupportBiologyAuth: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target: unknown, key: string) => key }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: { page: { biologyAuthDebug: jest.fn(), resetApp: jest.fn() } },
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/check-biometric-auth-changed',
  () => ({
    checkBiometricAuthChanged: jest.fn().mockResolvedValue(true),
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const platformEnv = {
    isNativeIOS: true,
    isDesktopMac: false,
    isExtensionUiSidePanel: false,
    isExtensionUiPopup: false,
    isNative: true,
    symbol: 'native',
  };
  return { __esModule: true, default: platformEnv };
});

jest.mock('@onekeyhq/shared/src/utils/resetUtils', () => ({
  __esModule: true,
  default: { endResetting: jest.fn(), startResetting: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => {
  const setBiologyAuthEnable = jest.fn().mockResolvedValue(undefined);
  return {
    __esModule: true,
    __setBiologyAuthEnable: setBiologyAuthEnable,
    default: {
      serviceApp: { isAppLocked: jest.fn(), resetApp: jest.fn() },
      servicePassword: { setBiologyAuthEnable },
    },
  };
});

jest.mock('../../../hooks/useBiometricAuthInfo', () => ({
  useBiometricAuthInfo: () => ({ icon: 'FaceIdOutline', title: 'Face ID' }),
}));

jest.mock('../../../hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: () => {},
}));

jest.mock('../../../views/Setting/hooks/useLanguageSelector', () => ({}));
jest.mock('../../../views/Setting/hooks/useLocaleOptions', () => ({}));

jest.mock('../hooks/useClearInputValueAfterVerified', () => ({
  useClearInputValueAfterVerified: () => ({ current: null }),
}));

jest.mock('./PassCodeInput', () => ({
  __esModule: true,
  default: () => null,
}));

function getMocks() {
  return {
    dialogConfirm: jest.requireMock('@onekeyhq/components')
      .__dialogConfirm as jest.Mock,
    setBiologyAuthEnable: jest.requireMock(
      '../../../background/instance/backgroundApiProxy',
    ).__setBiologyAuthEnable as jest.Mock,
  };
}

// The warning is fired from a `setTimeout(..., 50)` inside an async effect:
// drain both the microtask queue and that timer.
async function flush() {
  await act(async () => {
    // The effect awaits three promises before it schedules that timer, so keep
    // alternating between draining microtasks and advancing the clock.
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
      jest.advanceTimersByTime(100);
    }
  });
}

function renderVerify(props?: { inAppStateLock?: boolean }) {
  return render(
    <PasswordVerify
      authType={[]}
      isEnable
      passwordMode={EPasswordMode.PASSWORD}
      status={{ value: EPasswordVerifyStatus.DEFAULT }}
      onPasswordChange={() => {}}
      onBiologyAuth={() => {}}
      onInputPasswordAuth={() => {}}
      {...props}
    />,
  );
}

describe('PasswordVerify biometric-changed warning', () => {
  beforeEach(() => {
    // `flush()` advances the clock from inside `act(async …)`. Faking
    // `queueMicrotask` too would drain React's own act bookkeeping early and
    // burn its one-shot "act without await" warning on a false positive.
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the warning inside the lock overlay on the lock screen', async () => {
    renderVerify({ inAppStateLock: true });
    await flush();

    expect(getMocks().setBiologyAuthEnable).toHaveBeenCalledWith(false);
    expect(getMocks().dialogConfirm).toHaveBeenCalledWith(
      expect.objectContaining(inAppStateLockDialogProps),
    );
  });

  it('leaves the warning in the default portal everywhere else', async () => {
    renderVerify();
    await flush();

    expect(getMocks().setBiologyAuthEnable).toHaveBeenCalledWith(false);
    // The lock overlay container only exists while the lock screen is mounted,
    // so aiming any other PasswordVerify at it would drop the dialog.
    expect(getMocks().dialogConfirm).toHaveBeenCalledWith(
      expect.not.objectContaining({
        portalContainer: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      }),
    );
    const props = getMocks().dialogConfirm.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(props.sheetProps).toBeUndefined();
    // It keeps the top-level overlay it used before the lock-screen props
    // existed, so it still clears a native modal page on iOS.
    expect(props.isOverTopAllViews).toBe(true);
  });
});
