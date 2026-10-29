/**
 * @jest-environment jsdom
 */

import type { ComponentProps } from 'react';

import assert from 'node:assert/strict';

import { act, render } from '@testing-library/react';

import { biologyAuthNativeError } from '@onekeyhq/shared/src/biologyAuth/error';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  BIOLOGY_AUTH_ABORTED_ERROR,
  BIOLOGY_AUTH_CANCEL_ERROR,
  EPasswordMode,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useResetApp } from '../../../views/Setting/hooks';
import PasswordVerify from '../components/PasswordVerify';
import usePasswordProtection from '../hooks/usePasswordProtection';

import PasswordVerifyContainer from './PasswordVerifyContainer';

const mockAtomState: {
  biologyAuthInfo: { authType: number[]; isSupport: boolean };
  passwordPersist: { webAuthCredentialId?: string };
} = {
  biologyAuthInfo: { authType: [1], isSupport: true },
  passwordPersist: {},
};
const mockWebAuth = {
  verifiedPasswordWebAuth: jest.fn(),
  checkWebAuth: jest.fn(),
};

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
    setting: { page: { biologyAuthDebug: jest.fn(), resetApp: jest.fn() } },
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
  usePasswordBiologyAuthInfoAtom: () => [mockAtomState.biologyAuthInfo],
  usePasswordModeAtom: () => ['password'],
  usePasswordPersistAtom: () => [mockAtomState.passwordPersist],
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
      getCachedPassword: jest.fn().mockResolvedValue(undefined),
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
  useWebAuthActions: () => mockWebAuth,
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

beforeEach(() => {
  mockAtomState.biologyAuthInfo = { authType: [1], isSupport: true };
  mockAtomState.passwordPersist = {};
});

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
        .spyOn(backgroundApiProxy.servicePassword, 'verifyPasswordFromInput')
        .mockResolvedValue('verified-password');
      await act(async () => {
        captured().onInputPasswordAuth({
          password: 'wallet-password',
          passCode: '',
        });
      });
      expect(onVerifyRes).toHaveBeenCalledWith('verified-password');
      expect(captured().passwordMode).toBe(EPasswordMode.PASSWORD);
    },
  );

  it('counts a native biometric failure and asks for another try', async () => {
    jest
      .spyOn(backgroundApiProxy.servicePassword, 'verifyPassword')
      .mockRejectedValue(
        Object.assign(new Error('Verification failed'), {
          name: 'OneKeyAppError',
          cause: biologyAuthNativeError,
        }),
      );
    render(<PasswordVerifyContainer onVerifyRes={jest.fn()} />);
    await act(async () => {
      await captured().onBiologyAuth();
    });
    expect(captured().status).toEqual({
      value: EPasswordVerifyStatus.RETRY,
      message: 'Verification failed',
    });
    expect(countAttempt).toHaveBeenCalledTimes(1);
  });

  it.each([0, 2])(
    'treats a dismissed prompt as a silent retry with %s previous attempts',
    async (attempts) => {
      const protection = jest
        .mocked(usePasswordProtection)
        .getMockImplementation();
      assert(protection);
      jest.mocked(usePasswordProtection).mockReturnValue({
        ...protection(false),
        verifyPeriodBiologyAuthAttempts: attempts,
      });
      jest
        .spyOn(backgroundApiProxy.servicePassword, 'verifyPassword')
        .mockRejectedValue(
          Object.assign(new Error(''), {
            name: BIOLOGY_AUTH_CANCEL_ERROR,
            cause: biologyAuthNativeError,
          }),
        );
      render(<PasswordVerifyContainer onVerifyRes={jest.fn()} />);
      await act(async () => {
        await captured().onBiologyAuth();
      });
      expect(captured().status).toEqual({
        value: EPasswordVerifyStatus.RETRY,
      });
      expect(countAttempt).not.toHaveBeenCalled();
      expect(setBiologyEnabled).not.toHaveBeenCalled();
    },
  );

  it.each([
    [0, { value: EPasswordVerifyStatus.RETRY }, 1, 0],
    [
      2,
      { value: EPasswordVerifyStatus.RETRY, message: 'auth_biometric_failed' },
      0,
      1,
    ],
  ])(
    'counts a dismissed passkey prompt with %s previous attempts',
    async (attempts, status, counted, disabled) => {
      platformEnv.isDesktopWin = false;
      mockAtomState.biologyAuthInfo = { authType: [1], isSupport: false };
      mockAtomState.passwordPersist = { webAuthCredentialId: 'credential-id' };
      mockWebAuth.verifiedPasswordWebAuth.mockRejectedValue(
        Object.assign(new Error(''), { name: BIOLOGY_AUTH_CANCEL_ERROR }),
      );
      const protection = jest
        .mocked(usePasswordProtection)
        .getMockImplementation();
      assert(protection);
      jest.mocked(usePasswordProtection).mockReturnValue({
        ...protection(false),
        verifyPeriodBiologyAuthAttempts: attempts,
      });
      render(<PasswordVerifyContainer onVerifyRes={jest.fn()} />);
      await act(async () => {
        await captured().onBiologyAuth();
      });
      expect(mockWebAuth.verifiedPasswordWebAuth).toHaveBeenCalledTimes(1);
      expect(captured().status).toEqual(status);
      expect(countAttempt).toHaveBeenCalledTimes(counted);
      expect(setBiologyEnabled).toHaveBeenCalledTimes(disabled);
    },
  );

  it('does not change interrupted biometric handling on other platforms', async () => {
    platformEnv.isDesktopWin = false;
    jest
      .spyOn(backgroundApiProxy.servicePassword, 'verifyPassword')
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
      value: EPasswordVerifyStatus.RETRY,
      message: 'Original native message',
    });
    expect(countAttempt).toHaveBeenCalledTimes(1);
  });
});

describe('manual passcode failure feedback', () => {
  const setCooldown = jest.fn();

  function mockProtection(
    overrides: Partial<ReturnType<typeof usePasswordProtection>> = {},
  ) {
    jest.mocked(usePasswordProtection).mockReturnValue({
      verifyPeriodBiologyEnable: true,
      verifyPeriodBiologyAuthAttempts: 0,
      setVerifyPeriodBiologyAuthAttempts: jest.fn(),
      setVerifyPeriodBiologyEnable: jest.fn(),
      unlockPeriodPasswordArray: [],
      passwordErrorProtectionTimeMinutesSurplus: 0,
      passwordErrorAttempts: 0,
      alertText: '',
      setPasswordPersist: jest.fn(),
      setUnlockPeriodPasswordArray: jest.fn(),
      setPasswordErrorProtectionTimeMinutesSurplus: setCooldown,
      enablePasswordErrorProtection: false,
      isPasswordErrorProtectionEnabled: false,
      isProtectionTime: false,
      ...overrides,
    });
  }

  async function submitFailing(
    name: string,
    props: Partial<ComponentProps<typeof PasswordVerifyContainer>> = {},
  ) {
    jest
      .spyOn(backgroundApiProxy.servicePassword, 'verifyPasswordFromInput')
      .mockRejectedValue(Object.assign(new Error('failed'), { name }));
    render(<PasswordVerifyContainer onVerifyRes={jest.fn()} {...props} />);
    await act(async () => {
      await Promise.resolve(
        captured().onInputPasswordAuth({
          password: 'wrong-password',
          passCode: '',
        }),
      );
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    platformEnv.isDesktopWin = false;
    mockProtection();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([EOneKeyErrorClassNames.WrongPassword, 'OneKeyLocalError'])(
    'asks for another try after %s',
    async (name) => {
      await submitFailing(name);
      expect(captured().status).toEqual({
        value: EPasswordVerifyStatus.RETRY,
        message: 'auth_passcode_retry__msg',
      });
    },
  );

  it('keeps a secure-storage outage as an error', async () => {
    await submitFailing(EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable);
    expect(captured().status.value).toBe(EPasswordVerifyStatus.ERROR);
  });

  it('warns about the reset from the fifth wrong passcode', async () => {
    mockProtection({
      isPasswordErrorProtectionEnabled: true,
      passwordErrorAttempts: 4,
    });
    await submitFailing(EOneKeyErrorClassNames.WrongPassword);
    expect(captured().status).toEqual({
      value: EPasswordVerifyStatus.ERROR,
      message: 'auth_passcode_reset_warning__msg',
    });
    expect(setCooldown).toHaveBeenCalledWith(2);
  });

  it('keeps the reset warning for a repeated wrong passcode without a new cooldown', async () => {
    mockProtection({
      isPasswordErrorProtectionEnabled: true,
      passwordErrorAttempts: 5,
      unlockPeriodPasswordArray: ['wrong-password'],
    });
    await submitFailing(EOneKeyErrorClassNames.WrongPassword);
    expect(captured().status).toEqual({
      value: EPasswordVerifyStatus.ERROR,
      message: 'auth_passcode_reset_warning__msg',
    });
    expect(setCooldown).not.toHaveBeenCalled();
  });

  it('keeps the tenth wrong passcode an error when the reset fails', async () => {
    const resetApp = jest.fn().mockResolvedValue(false);
    jest.mocked(useResetApp).mockReturnValue(resetApp);
    mockProtection({
      isPasswordErrorProtectionEnabled: true,
      passwordErrorAttempts: 9,
    });
    await submitFailing(EOneKeyErrorClassNames.WrongPassword, { name: 'lock' });
    expect(resetApp).toHaveBeenCalledTimes(1);
    expect(captured().status).toEqual({
      value: EPasswordVerifyStatus.ERROR,
      message: 'settings_reset_app_description',
    });
  });
});
