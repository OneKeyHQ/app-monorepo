/**
 * @jest-environment jsdom
 */

import type { ComponentProps, ReactNode } from 'react';

import assert from 'node:assert/strict';

import { act, render } from '@testing-library/react';

import {
  EPasswordMode,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';

import { inAppStateLockDialogProps } from '../../../views/Setting/hooks';

import PasswordVerify from './PasswordVerify';

import type { UseFormReturn } from 'react-hook-form';

interface ICaptured {
  form: UseFormReturn<{ password: string; passCode: string }>;
  input: { addOns: { onPress: () => void | Promise<void>; testID?: string }[] };
  icon: { onPress: () => void };
  passCode: {
    onPinCodeChange: (value: string) => void;
    onComplete: () => void;
  };
  active?: () => void;
  visibility?: (visible: boolean) => void;
}
interface IComponentMocks {
  __captured: ICaptured;
  __dialogConfirm: jest.Mock<void, [Record<string, unknown>]>;
}
type IBooleanMock = jest.Mock<Promise<boolean>, []>;

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
  const capture = {} as ICaptured;
  const Form = Object.assign(
    ({ children, form }: { children?: ReactNode; form: ICaptured['form'] }) => {
      capture.form = form;
      return children ?? null;
    },
    { Field: ({ children }: { children?: ReactNode }) => children ?? null },
  );
  const dialogConfirm = jest.fn();
  return {
    __dialogConfirm: dialogConfirm,
    __captured: capture,
    Dialog: { confirm: dialogConfirm },
    Form,
    IconButton: (props: ICaptured['icon']) => {
      capture.icon = props;
      return createElement('button', {
        'data-testid': 'biometric-icon',
        onClick: props.onPress,
      });
    },
    Input: (props: ICaptured['input']) => {
      capture.input = props;
      return createElement('input', { 'data-testid': 'password-input' });
    },
    Portal: {
      Constant: {
        APP_STATE_LOCK_CONTAINER_OVERLAY: 'APP_STATE_LOCK_CONTAINER_OVERLAY',
      },
    },
    SizableText: host('span'),
    Stack: host('div'),
    XStack: host('div'),
    YStack: host('div'),
    onVisibilityStateChange: (callback: (visible: boolean) => void) => {
      capture.visibility = callback;
      return () => {
        capture.visibility = undefined;
      };
    },
    useForm:
      jest.requireActual<typeof import('react-hook-form')>('react-hook-form')
        .useForm,
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
  const checkBiometricAuthChanged = jest.fn().mockResolvedValue(false);
  return {
    __esModule: true,
    __checkBiometricAuthChanged: checkBiometricAuthChanged,
    default: {
      serviceApp: { isAppLocked: jest.fn(), resetApp: jest.fn() },
      servicePassword: { checkBiometricAuthChanged },
    },
  };
});

jest.mock('../../../hooks/useBiometricAuthInfo', () => ({
  useBiometricAuthInfo: () => ({ icon: 'FaceIdOutline', title: 'Face ID' }),
}));

jest.mock('../../../hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: (callback: (() => void) | undefined) => {
    jest.requireMock<IComponentMocks>(
      '@onekeyhq/components',
    ).__captured.active = callback;
  },
}));

jest.mock('../../../views/Setting/hooks/useLanguageSelector', () => ({}));
jest.mock('../../../views/Setting/hooks/useLocaleOptions', () => ({}));

jest.mock('../hooks/useClearInputValueAfterVerified', () => ({
  useClearInputValueAfterVerified: () => ({ current: null }),
}));

jest.mock('./PassCodeInput', () => ({
  __esModule: true,
  default: (props: ICaptured['passCode']) => {
    jest.requireMock<IComponentMocks>(
      '@onekeyhq/components',
    ).__captured.passCode = props;
    return null;
  },
}));

function getMocks() {
  return {
    dialogConfirm: jest.requireMock<IComponentMocks>('@onekeyhq/components')
      .__dialogConfirm,
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

function renderVerify(props?: Partial<ComponentProps<typeof PasswordVerify>>) {
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
    bgCheck().mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the warning inside the lock overlay on the lock screen', async () => {
    renderVerify({ inAppStateLock: true });
    await flush();

    expect(bgCheck()).toHaveBeenCalledTimes(1);
    expect(getMocks().dialogConfirm).toHaveBeenCalledWith(
      expect.objectContaining(inAppStateLockDialogProps),
    );
  });

  it('leaves the warning in the default portal everywhere else', async () => {
    renderVerify();
    await flush();

    expect(bgCheck()).toHaveBeenCalledTimes(1);
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
    // The default portal, where the passcode prompt that raises it already
    // is — no window overlay of its own, which on iOS would also put it
    // above the lock screen and the toast layer.
    expect(props.isOverTopAllViews).toBeUndefined();
  });

  it('does not register Windows reactivation as an automatic Hello retry', async () => {
    const platformEnv = jest.requireMock<
      typeof import('@onekeyhq/shared/src/platformEnv')
    >('@onekeyhq/shared/src/platformEnv').default;
    const originalPlatform = {
      isNativeIOS: platformEnv.isNativeIOS,
      isDesktopWin: platformEnv.isDesktopWin,
    };
    Object.assign(platformEnv, { isNativeIOS: false, isDesktopWin: true });
    try {
      const onBiologyAuth = jest.fn();
      renderVerify({ onBiologyAuth });
      await flush();
      expect(onBiologyAuth).toHaveBeenCalledTimes(1);
      expect(captured().active).toBeUndefined();
    } finally {
      Object.assign(platformEnv, originalPlatform);
    }
  });
});

function captured(): ICaptured {
  return jest.requireMock<IComponentMocks>('@onekeyhq/components').__captured;
}
function bgCheck(): IBooleanMock {
  return jest.requireMock<{ __checkBiometricAuthChanged: IBooleanMock }>(
    '../../../background/instance/backgroundApiProxy',
  ).__checkBiometricAuthChanged;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('PasswordVerify biometric safety guard', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
    jest.clearAllMocks();
    bgCheck().mockResolvedValue(false);

    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(['support', 'sdk', 'disable'] as const)(
    'blocks all biometric entrances after %s failure while password remains usable',
    async (failure) => {
      const onBiologyAuth = jest.fn();
      const onInputPasswordAuth = jest.fn();
      bgCheck().mockRejectedValue(new Error(`${failure} failed`));
      const view = renderVerify({ onBiologyAuth, onInputPasswordAuth });
      const manual = captured().input.addOns[0].onPress;
      await flush();
      await act(async () => {
        void manual();
        captured().active?.();
        captured().visibility?.(true);
      });
      await flush();
      expect(onBiologyAuth).not.toHaveBeenCalled();
      expect(getMocks().dialogConfirm).not.toHaveBeenCalled();
      expect(view.getByText('auth_biometric_failed')).toBeTruthy();
      await act(async () => {
        captured().form.setValue('password', 'still-usable');
      });
      await act(async () => {
        const passwordAction = captured().input.addOns.find(
          (item) => item.testID === 'verifying-password',
        );
        assert(passwordAction, 'Password submission action is missing');
        await passwordAction.onPress();
      });
      expect(onInputPasswordAuth).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'still-usable' }),
        undefined,
      );
      // The same failure blocks the passcode manual entrance, without blocking completion.
      view.unmount();
      renderVerify({
        passwordMode: EPasswordMode.PASSCODE,
        onBiologyAuth,
        onInputPasswordAuth,
      });
      const passcodeManual = captured().icon.onPress;
      await flush();
      await act(async () => {
        passcodeManual();
        captured().active?.();
        captured().visibility?.(true);
        captured().passCode.onPinCodeChange('123456');
        captured().passCode.onComplete();
      });
      await flush();
      expect(onBiologyAuth).not.toHaveBeenCalled();
      expect(onInputPasswordAuth).toHaveBeenCalledWith(
        expect.objectContaining({ passCode: '123456' }),
        undefined,
      );
    },
  );

  it('coalesces check and entire authentication challenge across automatic and manual entrances', async () => {
    const check = deferred<boolean>();
    const challenge = deferred<void>();
    bgCheck().mockReturnValue(check.promise);
    const onBiologyAuth = jest.fn().mockReturnValue(challenge.promise);
    renderVerify({ onBiologyAuth });
    await act(async () => {
      void captured().input.addOns[0].onPress();
      captured().active?.();
      captured().visibility?.(true);
    });
    expect(bgCheck()).toHaveBeenCalledTimes(1);
    await act(async () => {
      check.resolve(false);
    });
    expect(onBiologyAuth).toHaveBeenCalledTimes(1);
    await act(async () => {
      void captured().input.addOns[0].onPress();
    });
    expect(onBiologyAuth).toHaveBeenCalledTimes(1);
    await act(async () => {
      challenge.resolve();
    });
    await act(async () => {
      void captured().input.addOns[0].onPress();
    });
    expect(onBiologyAuth).toHaveBeenCalledTimes(2);
  });

  it('does not check or show errors when biometrics are disabled', async () => {
    const onBiologyAuth = jest.fn();
    const view = renderVerify({ onBiologyAuth, isEnable: false });
    await act(async () => {
      captured().visibility?.(true);
    });
    expect(bgCheck()).not.toHaveBeenCalled();
    expect(onBiologyAuth).not.toHaveBeenCalled();
    expect(view.queryByText('auth_biometric_failed')).toBeNull();
  });

  it('allows a new guarded attempt after manual verification clears an unavailable check', async () => {
    bgCheck()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue(false);
    const onBiologyAuth = jest.fn();
    const props = {
      onBiologyAuth,
      pageMode: true,
    };
    const view = renderVerify(props);
    await flush();
    expect(view.getByText('auth_biometric_failed')).toBeTruthy();
    view.rerender(
      <PasswordVerify
        authType={[]}
        isEnable
        passwordMode={EPasswordMode.PASSWORD}
        status={{ value: EPasswordVerifyStatus.VERIFIED }}
        onPasswordChange={() => {}}
        onInputPasswordAuth={() => {}}
        {...props}
      />,
    );
    expect(view.queryByText('auth_biometric_failed')).toBeNull();
    await act(async () => {
      void captured().input.addOns[0].onPress();
    });
    expect(bgCheck()).toHaveBeenCalledTimes(2);
    expect(onBiologyAuth).toHaveBeenCalledTimes(1);
  });

  it('ignores an old check after manual verification starts a new generation', async () => {
    const oldCheck = deferred<boolean>();
    bgCheck().mockReturnValueOnce(oldCheck.promise).mockResolvedValue(false);
    const onBiologyAuth = jest.fn();
    const props = {
      authType: [],
      isEnable: true,
      passwordMode: EPasswordMode.PASSWORD,
      onPasswordChange: () => {},
      onInputPasswordAuth: () => {},
      onBiologyAuth,
    };
    const view = renderVerify(props);
    view.rerender(
      <PasswordVerify
        {...props}
        status={{ value: EPasswordVerifyStatus.VERIFIED }}
      />,
    );
    await act(async () => {
      void captured().input.addOns[0].onPress();
    });
    expect(bgCheck()).toHaveBeenCalledTimes(2);
    expect(onBiologyAuth).not.toHaveBeenCalled();
    await act(async () => {
      oldCheck.resolve(true);
    });
    await flush();
    expect(getMocks().dialogConfirm).not.toHaveBeenCalled();
    expect(view.queryByText('auth_biometric_failed')).toBeNull();
  });

  it.each([EPasswordMode.PASSWORD, EPasswordMode.PASSCODE])(
    'allows a fresh pageMode %s manual request after verification',
    async (passwordMode) => {
      const onBiologyAuth = jest.fn();
      renderVerify({
        pageMode: true,
        passwordMode,
        status: { value: EPasswordVerifyStatus.VERIFIED },
        onBiologyAuth,
      });
      await act(async () => {
        if (passwordMode === EPasswordMode.PASSWORD)
          await captured().input.addOns[0].onPress();
        else captured().icon.onPress();
      });
      expect(bgCheck()).toHaveBeenCalledTimes(1);
      expect(onBiologyAuth).toHaveBeenCalledTimes(1);
    },
  );

  it.each([EPasswordMode.PASSWORD, EPasswordMode.PASSCODE])(
    'blocks a non-pageMode %s manual request after verification',
    async (passwordMode) => {
      const onBiologyAuth = jest.fn();
      renderVerify({
        pageMode: false,
        passwordMode,
        status: { value: EPasswordVerifyStatus.VERIFIED },
        onBiologyAuth,
      });
      await act(async () => {
        if (passwordMode === EPasswordMode.PASSWORD)
          await captured().input.addOns[0].onPress();
        else captured().icon.onPress();
      });
      expect(onBiologyAuth).not.toHaveBeenCalled();
    },
  );

  it.each([EPasswordMode.PASSWORD, EPasswordMode.PASSCODE])(
    'blocks a pending pageMode %s request when verification completes',
    async (passwordMode) => {
      const check = deferred<boolean>();
      bgCheck().mockReturnValue(check.promise);
      const onBiologyAuth = jest.fn();
      const props: Omit<ComponentProps<typeof PasswordVerify>, 'status'> = {
        authType: [],
        isEnable: true,
        pageMode: true,
        passwordMode,
        onPasswordChange: () => {},
        onBiologyAuth,
        onInputPasswordAuth: () => {},
      };
      const view = renderVerify(props);
      await act(async () => {
        if (passwordMode === EPasswordMode.PASSWORD)
          void captured().input.addOns[0].onPress();
        else captured().icon.onPress();
      });
      expect(bgCheck()).toHaveBeenCalledTimes(1);
      view.rerender(
        <PasswordVerify
          {...props}
          status={{ value: EPasswordVerifyStatus.VERIFIED }}
        />,
      );
      await act(async () => {
        check.resolve(false);
      });
      expect(onBiologyAuth).not.toHaveBeenCalled();
    },
  );

  it.each(['disabled', 'input', 'verifying', 'verified', 'unmounted'] as const)(
    'does not authenticate after pending check becomes %s',
    async (change) => {
      const check = deferred<boolean>();
      bgCheck().mockReturnValue(check.promise);
      const onBiologyAuth = jest.fn();
      const view = renderVerify({ onBiologyAuth });
      await act(async () => {
        await Promise.resolve();
      });
      if (change === 'input')
        await act(async () => {
          captured().form.setValue('password', 'typing');
        });
      else if (change === 'unmounted') view.unmount();
      else {
        let latestStatus = EPasswordVerifyStatus.DEFAULT;
        if (change === 'verifying')
          latestStatus = EPasswordVerifyStatus.VERIFYING;
        if (change === 'verified')
          latestStatus = EPasswordVerifyStatus.VERIFIED;
        view.rerender(
          <PasswordVerify
            authType={[]}
            isEnable={change !== 'disabled'}
            passwordMode={EPasswordMode.PASSWORD}
            status={{
              value: latestStatus,
            }}
            onPasswordChange={() => {}}
            onBiologyAuth={onBiologyAuth}
            onInputPasswordAuth={() => {}}
          />,
        );
      }
      await act(async () => {
        check.resolve(false);
      });
      expect(onBiologyAuth).not.toHaveBeenCalled();
    },
  );
  it('treats unsupported biometrics as unavailable without disabling the setting', async () => {
    bgCheck().mockRejectedValue(new Error('unsupported'));
    const onBiologyAuth = jest.fn();
    const view = renderVerify({ onBiologyAuth });
    await flush();
    expect(bgCheck()).toHaveBeenCalledTimes(1);
    expect(onBiologyAuth).not.toHaveBeenCalled();
    expect(view.getByText('auth_biometric_failed')).toBeTruthy();
  });

  it('coalesces entrances while background settings persistence completes', async () => {
    const disabling = deferred<void>();
    bgCheck().mockReturnValue(disabling.promise.then(() => true));
    const onBiologyAuth = jest.fn();
    renderVerify({ onBiologyAuth });
    const manual = captured().input.addOns[0].onPress;
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      void manual();
      captured().active?.();
      captured().visibility?.(true);
    });
    expect(bgCheck()).toHaveBeenCalledTimes(1);
    expect(onBiologyAuth).not.toHaveBeenCalled();
    expect(getMocks().dialogConfirm).not.toHaveBeenCalled();
    await act(async () => {
      disabling.resolve();
    });
    await flush();
    expect(getMocks().dialogConfirm).toHaveBeenCalledTimes(1);
    await act(async () => {
      void manual();
      captured().active?.();
      captured().visibility?.(true);
    });
    expect(onBiologyAuth).not.toHaveBeenCalled();
  });
});
