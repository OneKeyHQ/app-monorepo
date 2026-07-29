/** @jest-environment jsdom */

import { Dialog } from '@onekeyhq/components';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  showKeylessOAuthRefreshRecoveryDialog,
  showOneKeyIdOAuthAccountMismatchDialog,
} from './AccountMismatchDialog';

import type { IntlShape } from 'react-intl';

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    Description: 'DialogDescription',
    Footer: 'DialogFooter',
    show: jest.fn(() => ({
      close: jest.fn(),
      getForm: jest.fn(),
      isExist: jest.fn(() => true),
    })),
  },
  SizableText: 'SizableText',
  Toast: {
    error: jest.fn(),
  },
  YStack: 'YStack',
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceCloudBackup: {
      logoutFromGoogleDrive: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: false,
    isNativeIOS: false,
  },
}));

const mockFormatMessage = jest.fn(({ id }: { id: string }) => id);
const intl = {
  formatMessage: mockFormatMessage,
} as unknown as IntlShape;

const mockedDialogShow = Dialog.show as jest.MockedFunction<typeof Dialog.show>;

describe('showKeylessOAuthRefreshRecoveryDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('offers retry and provider reauthentication', async () => {
    const resultPromise = showKeylessOAuthRefreshRecoveryDialog({
      intl,
      provider: EOAuthSocialLoginProvider.Google,
    });
    const options = mockedDialogShow.mock.calls[0][0];

    expect(options).toEqual(
      expect.objectContaining({
        title: ETranslations.global_connection_failed,
        description: ETranslations.keyless_verify_identity_desc,
        showCancelButton: true,
        onConfirmText: ETranslations.global_retry,
        onCancelText: ETranslations.continue_with_social_platform,
      }),
    );
    expect(mockFormatMessage).toHaveBeenCalledWith(
      {
        id: ETranslations.keyless_verify_identity_desc,
      },
      { provider: 'Google' },
    );
    expect(mockFormatMessage).toHaveBeenCalledWith(
      {
        id: ETranslations.continue_with_social_platform,
      },
      { platform: 'Google' },
    );

    (options.onConfirm as () => void)();

    await expect(resultPromise).resolves.toBe('retry');
  });

  test('returns reauthenticate when the fallback action is selected', async () => {
    const resultPromise = showKeylessOAuthRefreshRecoveryDialog({
      intl,
      provider: EOAuthSocialLoginProvider.Apple,
    });
    const options = mockedDialogShow.mock.calls[0][0];

    expect(options.onCancelText).toBe(
      ETranslations.continue_with_social_platform,
    );
    expect(mockFormatMessage).toHaveBeenCalledWith(
      {
        id: ETranslations.continue_with_social_platform,
      },
      { platform: 'Apple' },
    );
    (options.onCancel as () => void)();

    await expect(resultPromise).resolves.toBe('reauthenticate');
  });

  test('returns dismiss when the dialog is closed', async () => {
    const resultPromise = showKeylessOAuthRefreshRecoveryDialog({
      intl,
    });
    const options = mockedDialogShow.mock.calls[0][0];

    expect(options.onCancelText).toBe(
      ETranslations.continue_with_social_platform,
    );
    expect(mockFormatMessage).toHaveBeenCalledWith({
      id: ETranslations.google_or_apple__label,
    });
    expect(mockFormatMessage).toHaveBeenCalledWith(
      {
        id: ETranslations.continue_with_social_platform,
      },
      { platform: ETranslations.google_or_apple__label },
    );
    await options.onClose?.();

    await expect(resultPromise).resolves.toBe('dismiss');
  });
});

describe('showOneKeyIdOAuthAccountMismatchDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses the shared localized copy and directs provider mismatch to the linked provider', async () => {
    const resultPromise = showOneKeyIdOAuthAccountMismatchDialog({
      intl,
      mismatchedProvider: EOAuthSocialLoginProvider.Apple,
      continueProvider: EOAuthSocialLoginProvider.Google,
    });
    const options = mockedDialogShow.mock.calls[0][0];

    expect(options).toEqual(
      expect.objectContaining({
        title: ETranslations.keyless_wallet_verify_pin_account_mismatch,
        description:
          ETranslations.onekey_id_oauth_reauth_account_mismatch__desc,
        showCancelButton: false,
        onConfirmText: ETranslations.continue_with_social_platform,
      }),
    );
    expect(options.onCancelText).toBeUndefined();
    expect(options.onCancel).toBeUndefined();
    expect(mockFormatMessage).toHaveBeenCalledWith(
      {
        id: ETranslations.onekey_id_oauth_reauth_account_mismatch__desc,
      },
      { provider: 'Apple' },
    );
    expect(mockFormatMessage).toHaveBeenCalledWith(
      { id: ETranslations.continue_with_social_platform },
      { platform: 'Google' },
    );

    (options.onConfirm as () => void)();

    await expect(resultPromise).resolves.toBe(true);
  });

  test('uses the same copy when the provider is correct but the account is not linked', async () => {
    const resultPromise = showOneKeyIdOAuthAccountMismatchDialog({
      intl,
      mismatchedProvider: EOAuthSocialLoginProvider.Google,
      continueProvider: EOAuthSocialLoginProvider.Google,
    });
    const options = mockedDialogShow.mock.calls[0][0];

    expect(options).toEqual(
      expect.objectContaining({
        description:
          ETranslations.onekey_id_oauth_reauth_account_mismatch__desc,
        onConfirmText: ETranslations.continue_with_social_platform,
      }),
    );
    expect(mockFormatMessage).toHaveBeenCalledWith(
      {
        id: ETranslations.onekey_id_oauth_reauth_account_mismatch__desc,
      },
      { provider: 'Google' },
    );
    expect(mockFormatMessage).toHaveBeenCalledWith(
      { id: ETranslations.continue_with_social_platform },
      { platform: 'Google' },
    );

    await options.onClose?.();

    await expect(resultPromise).resolves.toBe(false);
  });
});
