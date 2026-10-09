/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import { Dialog } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { registerWebAuth } from '@onekeyhq/shared/src/webAuth';
import { BIOLOGY_AUTH_CANCEL_ERROR } from '@onekeyhq/shared/types/password';

import { useWebAuthActions } from './useWebAuthActions';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn() },
  Toast: { error: jest.fn() },
}));
jest.mock(
  '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils',
  () => ({
    biologyAuthUtils: { savePasswordForPasskey: jest.fn() },
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  usePasswordPersistAtom: () => [
    { webAuthCredentialId: 'fixture-old-id' },
    jest.fn(),
  ],
  usePasswordModeAtom: () => ['password'],
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtension: false },
}));
jest.mock('@onekeyhq/shared/src/webAuth', () => ({
  registerWebAuth: jest.fn(),
  verifiedWebAuth: jest.fn(),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePassword: {
      checkPasswordSet: jest.fn().mockResolvedValue(false),
      getCachedPassword: jest.fn().mockResolvedValue('synthetic-fixture-value'),
      setSkipPrfCache: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

type IConfirmation = {
  overlayLevel: string;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
};

describe('passkey re-enrollment confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const error = new Error('Synthetic unavailable credential');
    error.name = BIOLOGY_AUTH_CANCEL_ERROR;
    (registerWebAuth as jest.Mock).mockRejectedValueOnce(error);
    (registerWebAuth as jest.Mock).mockResolvedValue('fixture-new-id');
  });

  it.each([false, true])(
    'waits for secure confirmation before creating a credential (extension=%s)',
    async (isExtension) => {
      Object.assign(platformEnv, { isExtension });
      const { result } = renderHook(() => useWebAuthActions());
      let completed = false;
      let enrollment: Promise<string | undefined>;
      act(() => {
        enrollment = result.current.setWebAuthEnable(true).then((value) => {
          completed = true;
          return value;
        });
      });
      await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
      const confirmation = (Dialog.show as jest.Mock).mock
        .calls[0][0] as IConfirmation;
      expect(confirmation.overlayLevel).toBe('secure');
      expect(completed).toBe(false);
      expect(registerWebAuth).toHaveBeenCalledTimes(1);
      await act(async () => {
        confirmation.onConfirm();
        expect(await enrollment).toBe('fixture-new-id');
      });
      expect(registerWebAuth).toHaveBeenLastCalledWith();
      expect(registerWebAuth).toHaveBeenCalledTimes(2);
    },
  );

  it('declines unavailable PRF enrollment without registering another credential', async () => {
    Object.assign(platformEnv, { isExtension: true });
    const { servicePassword } = (
      jest.requireMock('../../../background/instance/backgroundApiProxy') as {
        default: {
          servicePassword: {
            checkPasswordSet: jest.Mock;
            setSkipPrfCache: jest.Mock;
          };
        };
      }
    ).default;
    servicePassword.checkPasswordSet.mockResolvedValueOnce(true);
    const { biologyAuthUtils } = jest.requireMock(
      '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils',
    ) as { biologyAuthUtils: { savePasswordForPasskey: jest.Mock } };
    const error = new Error('Synthetic unavailable credential');
    error.name = BIOLOGY_AUTH_CANCEL_ERROR;
    biologyAuthUtils.savePasswordForPasskey.mockRejectedValueOnce(error);
    const { result } = renderHook(() => useWebAuthActions());
    const enrollment = result.current.setWebAuthEnable(true);
    await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
    const confirmation = (Dialog.show as jest.Mock).mock
      .calls[0][0] as IConfirmation;
    expect(confirmation.overlayLevel).toBe('secure');
    await act(async () => {
      confirmation.onCancel();
      expect(await enrollment).toBeUndefined();
    });
    expect(biologyAuthUtils.savePasswordForPasskey).toHaveBeenCalledTimes(1);
    expect(registerWebAuth).not.toHaveBeenCalled();
    expect(servicePassword.setSkipPrfCache.mock.calls).toEqual([
      [true],
      [false],
    ]);
  });

  it.each(['onCancel', 'onClose'] as const)(
    '%s declines without creating a new credential',
    async (action) => {
      Object.assign(platformEnv, { isExtension: false });
      const { result } = renderHook(() => useWebAuthActions());
      const enrollment = result.current.setWebAuthEnable(true);
      await waitFor(() => expect(Dialog.show).toHaveBeenCalledTimes(1));
      const confirmation = (Dialog.show as jest.Mock).mock
        .calls[0][0] as IConfirmation;
      await act(async () => {
        confirmation[action]();
        expect(await enrollment).toBeUndefined();
      });
      expect(registerWebAuth).toHaveBeenCalledTimes(1);
    },
  );
});
