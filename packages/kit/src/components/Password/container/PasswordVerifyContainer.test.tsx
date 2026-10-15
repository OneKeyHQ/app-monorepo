/**
 * @jest-environment jsdom
 */

import type { ComponentProps } from 'react';

import assert from 'node:assert/strict';

import { act, render } from '@testing-library/react';

import { biologyAuthNativeError } from '@onekeyhq/shared/src/biologyAuth/error';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  BIOLOGY_AUTH_ABORTED_ERROR,
  BIOLOGY_AUTH_CANCEL_ERROR,
  EPasswordMode,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import PasswordVerify from '../components/PasswordVerify';
import usePasswordProtection from '../hooks/usePasswordProtection';

import PasswordVerifyContainer from './PasswordVerifyContainer';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children: import('react').ReactNode }) => children,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktopWin: true },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({
  __esModule: true,
  default: {
    isErrorByClassName: ({
      error,
      className,
    }: {
      error: Error;
      className: string;
    }) => error.name === className,
  },
}));
jest.mock('@onekeyhq/shared/src/keyboard', () => ({}));
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target: unknown, key: string) => key }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: { page: { biologyAuthDebug: jest.fn() } },
    app: { webembed: { webembedApiNotReady: jest.fn() } },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/password', () => ({
  usePasswordAtom: () =>
    jest.requireActual<typeof import('react')>('react').useState({
      passwordVerifyStatus: { value: 'default' },
    }),
  usePasswordBiologyAuthInfoAtom: () => [{ authType: [1], isSupport: true }],
  usePasswordModeAtom: () => ['password'],
  usePasswordPersistAtom: () => [{}],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsPersistAtom: () => [{ isBiologyAuthSwitchOn: true }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/localDb', () => ({
  useLocalDbOpenErrorAtom: () => [{}],
}));
jest.mock(
  '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils',
  () => ({
    biologyAuthUtils: { hasPassword: jest.fn().mockResolvedValue(true) },
  }),
);
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: {
      verifyPassword: jest.fn(),
      verifyPasswordFromInput: jest.fn(),
      resetPasswordStatus: jest.fn(),
      waitPasswordEncryptorReady: jest.fn().mockResolvedValue(undefined),
    },
  },
}));
jest.mock('../../../hooks/useBiometricAuthInfo', () => ({
  useBiometricAuthInfo: () => ({ title: 'Windows Hello' }),
}));
jest.mock('../../../views/Setting/hooks', () => ({
  useResetApp: jest.fn(),
}));
jest.mock('../../BiologyAuthComponent/hooks/useWebAuthActions', () => ({
  useWebAuthActions: () => ({}),
}));
jest.mock('../components/PasswordVerify', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('../hooks/usePasswordProtection', () => ({
  __esModule: true,
  default: jest.fn(),
}));

function captured(): ComponentProps<typeof PasswordVerify> {
  const props = jest.mocked(PasswordVerify).mock.calls.at(-1)?.[0];
  assert(props, 'Password verification props were not captured');
  return props;
}

describe('Windows Hello interrupted challenge handling', () => {
  const countAttempt = jest.fn();
  const setBiologyEnabled = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    platformEnv.isDesktopWin = true;
    jest.mocked(usePasswordProtection).mockReturnValue({
      verifyPeriodBiologyEnable: true,
      verifyPeriodBiologyAuthAttempts: 0,
      setVerifyPeriodBiologyAuthAttempts: countAttempt,
      setVerifyPeriodBiologyEnable: setBiologyEnabled,
      unlockPeriodPasswordArray: [],
      passwordErrorProtectionTimeMinutesSurplus: 0,
      passwordErrorAttempts: 0,
      alertText: '',
      setPasswordPersist: jest.fn(),
      setUnlockPeriodPasswordArray: jest.fn(),
      setPasswordErrorProtectionTimeMinutesSurplus: jest.fn(),
      enablePasswordErrorProtection: true,
      isPasswordErrorProtectionEnabled: false,
      isProtectionTime: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([0, 2])(
    'keeps an interrupted challenge neutral with %s previous attempts',
    async (attempts) => {
      const protection = jest
        .mocked(usePasswordProtection)
        .getMockImplementation();
      assert(protection);
      jest.mocked(usePasswordProtection).mockReturnValue({
        ...protection(false),
        verifyPeriodBiologyAuthAttempts: attempts,
      });
      const verifyPassword = jest
        .spyOn(backgroundApiProxy.servicePassword, 'verifyPassword')
        .mockRejectedValue(
          Object.assign(new Error(''), {
            name: BIOLOGY_AUTH_ABORTED_ERROR,
            cause: biologyAuthNativeError,
          }),
        );
      const onVerifyRes = jest.fn();
      render(<PasswordVerifyContainer onVerifyRes={onVerifyRes} pageMode />);
      await act(async () => {
        await captured().onBiologyAuth();
      });
      expect(captured().status).toEqual({
        value: EPasswordVerifyStatus.DEFAULT,
      });
      expect(countAttempt).not.toHaveBeenCalled();
      expect(setBiologyEnabled).not.toHaveBeenCalled();
      expect(onVerifyRes).not.toHaveBeenCalled();
      expect(verifyPassword).toHaveBeenCalledTimes(1);
      await act(async () => {
        await captured().onBiologyAuth();
      });
      expect(verifyPassword).toHaveBeenCalledTimes(2);
      jest
        .mocked(backgroundApiProxy.servicePassword.verifyPasswordFromInput)
        .mockResolvedValue('verified-password');
      await act(async () => {
        await captured().onInputPasswordAuth({
          password: 'wallet-password',
          passCode: '',
        });
      });
      expect(onVerifyRes).toHaveBeenCalledWith('verified-password');
      expect(captured().passwordMode).toBe(EPasswordMode.PASSWORD);
    },
  );

  it.each(['OneKeyAppError', BIOLOGY_AUTH_CANCEL_ERROR])(
    'preserves the existing attempt protection for %s',
    async (name) => {
      jest
        .mocked(backgroundApiProxy.servicePassword.verifyPassword)
        .mockRejectedValue(
          Object.assign(new Error('Verification failed'), {
            name,
            cause: biologyAuthNativeError,
          }),
        );
      render(<PasswordVerifyContainer onVerifyRes={jest.fn()} />);
      await act(async () => {
        await captured().onBiologyAuth();
      });
      expect(captured().status.value).toBe(EPasswordVerifyStatus.ERROR);
      expect(countAttempt).toHaveBeenCalledTimes(1);
    },
  );

  it('does not change interrupted biometric handling on other platforms', async () => {
    platformEnv.isDesktopWin = false;
    jest
      .mocked(backgroundApiProxy.servicePassword.verifyPassword)
      .mockRejectedValue(
        Object.assign(new Error('Original native message'), {
          name: BIOLOGY_AUTH_ABORTED_ERROR,
          cause: biologyAuthNativeError,
        }),
      );
    render(<PasswordVerifyContainer onVerifyRes={jest.fn()} />);
    await act(async () => {
      await captured().onBiologyAuth();
    });
    expect(captured().status).toEqual({
      value: EPasswordVerifyStatus.ERROR,
      message: 'Original native message',
    });
    expect(countAttempt).toHaveBeenCalledTimes(1);
  });
});
