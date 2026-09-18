/** @jest-environment jsdom */

import { Fragment, createElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { render, waitFor } from '@testing-library/react';

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyIdLoginWithLocalKeylessPrepareStatus } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import {
  EOneKeyIdIdentityType,
  EOneKeyIdOAuthProvider,
} from '@onekeyhq/shared/types/prime/primeTypes';

import {
  OneKeyIdLegacyOAuthBindPrompt,
  showOneKeyIdLegacyOAuthBindDialog,
  showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade,
} from './OneKeyIdLegacyOAuthBind';
import { clearOneKeyIdLegacyOAuthBindCaches } from './oneKeyIdLocalKeylessPrepareCache';

type IAccountSwitchResult = 'switched' | 'cancelled' | 'failed';

type IDialogContentProps = {
  presentation: 'dialog';
  onBeforeShowNestedDialog: () => Promise<void>;
  onBeforeShowAccountSwitchDialog: () => Promise<void>;
  onAccountSwitchResult: (result: IAccountSwitchResult) => Promise<void>;
};

type IDialogFooterProps = {
  showConfirmButton: boolean;
  showCancelButton: boolean;
};

type IDialogStackProps = {
  children: [ReactElement, ReactElement<IDialogFooterProps>];
};

type IDialogOptions = {
  onCancel: () => void;
  onClose: () => void;
  onOpen?: () => void;
  renderContent: ReactElement<IDialogContentProps>;
};

let mockCurrentDialogOptions: IDialogOptions | undefined;
const mockDialogClose = jest.fn<Promise<void>, [unknown?]>(async () => {
  mockCurrentDialogOptions?.onClose();
});
const mockDialogShow = jest.fn<
  { close: typeof mockDialogClose },
  [IDialogOptions]
>((options) => {
  mockCurrentDialogOptions = options;
  options.onOpen?.();
  return { close: mockDialogClose };
});
const mockIsLegacyOAuthBindRequired = jest.fn<Promise<boolean>, []>(
  async () => true,
);
const mockClaimCredentialUpgradePrompt = jest.fn<
  Promise<
    | { status: 'claimed'; claimId: string }
    | { status: 'retryable' }
    | { status: 'skip' }
  >,
  [{ onekeyUserId: string }]
>(async () => ({ status: 'claimed', claimId: 'claim-1' }));
const mockCompleteCredentialUpgradePrompt = jest.fn<
  Promise<boolean>,
  [{ onekeyUserId: string; claimId: string }]
>(async () => true);
const mockReleaseCredentialUpgradePrompt = jest.fn<
  Promise<boolean>,
  [{ onekeyUserId: string; claimId: string }]
>(async () => true);
const mockEnsureKeylessCredentialReady = jest.fn(async () => ({
  status: 'ready' as const,
  hasLocalKeylessWallet: true as const,
}));
const mockPrepareOneKeyIdLoginWithLocalKeyless = jest.fn(async () => ({
  status: EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless,
}));
const mockApiFetchPrimeUserInfo = jest.fn(async () => undefined);
const mockLogOneKeyIdLoginFailureReason = jest.fn();
const mockYStack = jest.fn((_props: unknown) => null);
const mockButton = jest.fn((_props: unknown) => null);
const mockGetOneKeyIdOAuthBindProviders = jest.fn(() => [
  EOAuthSocialLoginProvider.Google,
  EOAuthSocialLoginProvider.Apple,
]);
let mockOneKeyAuthUser:
  | {
      onekeyUserId?: string;
      onekeyAccount?: {
        identities?: {
          identityType: EOneKeyIdIdentityType;
          oauthProvider?: EOneKeyIdOAuthProvider;
        }[];
      };
    }
  | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, string>) =>
      values ? `${id}:${JSON.stringify(values)}` : id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: (props: unknown) => mockButton(props),
  Dialog: {
    Footer: () => null,
    show: (options: IDialogOptions) => mockDialogShow(options),
  },
  Icon: () => null,
  SizableText: () => null,
  Stack: ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children),
  Toast: { success: jest.fn() },
  XStack: () => null,
  YStack: (props: { children?: ReactNode }) => {
    mockYStack(props);
    return createElement(Fragment, null, props.children);
  },
}));

jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/extOneKeyIdAuthExpandTab',
  () => ({
    redirectKeylessOneKeyIdAuthToExtExpandTab: jest.fn(),
    redirectOneKeyIdAuthToExtExpandTab: jest.fn(),
    shouldRunOneKeyIdAuthInExtExpandTab: () => false,
  }),
);

jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow',
  () => ({ useIdentityExitFlow: () => ({ run: jest.fn() }) }),
);

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ user: mockOneKeyAuthUser }),
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfErrorDisable: jest.fn(),
    withErrorAutoToast: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/utils/timerUtils',
  ) as { default: Record<string, unknown> };
  return {
    __esModule: true,
    default: {
      ...actual.default,
      wait: jest.fn(async () => undefined),
    },
  };
});

jest.mock('../oneKeyIdLoginToastUtils', () => ({
  getSanitizedAuthErrorText: (error: unknown) => String(error),
  logOneKeyIdLoginFailureReason: (...args: unknown[]) => {
    mockLogOneKeyIdLoginFailureReason(...args);
  },
  showOneKeyIdLoginSuccessToast: jest.fn(),
  throwLocalizedOneKeyIdLoginError: jest.fn(),
}));

jest.mock('../useOneKeyIdLocalKeylessOAuth', () => ({
  useOneKeyIdLocalKeylessOAuth: () => ({}),
}));

jest.mock('./oneKeyIdOAuthBindProviders', () => ({
  getOneKeyIdOAuthBindProviders: () => mockGetOneKeyIdOAuthBindProviders(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceKeylessWallet: {
      ensureKeylessCredentialReadyForOneKeyIdBind: () =>
        mockEnsureKeylessCredentialReady(),
      prepareOneKeyIdLoginWithLocalKeyless: () =>
        mockPrepareOneKeyIdLoginWithLocalKeyless(),
    },
    servicePrime: {
      apiFetchPrimeUserInfo: () => mockApiFetchPrimeUserInfo(),
      claimOneKeyIdOAuthBindPrompt: (params: { onekeyUserId: string }) =>
        mockClaimCredentialUpgradePrompt(params),
      completeOneKeyIdOAuthBindPrompt: (params: {
        onekeyUserId: string;
        claimId: string;
      }) => mockCompleteCredentialUpgradePrompt(params),
      isLegacyOneKeyIdOAuthBindRequired: () => mockIsLegacyOAuthBindRequired(),
      releaseOneKeyIdOAuthBindPrompt: (params: {
        onekeyUserId: string;
        claimId: string;
      }) => mockReleaseCredentialUpgradePrompt(params),
    },
  },
}));

function getDialogContentProps(): IDialogContentProps {
  const options = mockDialogShow.mock.calls[0]?.[0];
  if (!options) {
    throw new OneKeyLocalError('Expected the OAuth bind dialog to be shown');
  }
  return options.renderContent.props;
}

async function flushMicrotasks(times = 5) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function startRequiredKeylessBind(onBindSuccess: () => Promise<void>) {
  const resultPromise = showOneKeyIdLegacyOAuthBindDialog({
    type: 'required-for-keyless',
    provider: EOAuthSocialLoginProvider.Google,
    onBindSuccess,
  });
  await Promise.resolve();
  return { resultPromise };
}

function wasInlineBindCardRendered() {
  return mockYStack.mock.calls.some(
    ([props]) => (props as { p?: string }).p === '$4',
  );
}

function wasBoundStatusRendered() {
  return mockYStack.mock.calls.some(
    ([props]) => (props as { overflow?: string }).overflow === 'hidden',
  );
}

function isBindProviderButtonEnabled(provider: EOAuthSocialLoginProvider) {
  return mockButton.mock.calls.some(([props]) => {
    const buttonProps = props as { disabled?: boolean; testID?: string };
    return (
      buttonProps.testID === `onekey-id-bind-oauth-${provider}-btn` &&
      buttonProps.disabled === false
    );
  });
}

async function waitForInlineBindCardReady() {
  await waitFor(() => {
    expect(wasInlineBindCardRendered()).toBe(true);
    expect(isBindProviderButtonEnabled(EOAuthSocialLoginProvider.Google)).toBe(
      true,
    );
  });
}

describe('OneKeyIdLegacyOAuthBindPrompt readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearOneKeyIdLegacyOAuthBindCaches();
    mockOneKeyAuthUser = {
      onekeyUserId: 'onekey-user-a',
      onekeyAccount: {
        identities: [{ identityType: EOneKeyIdIdentityType.LegacyEmail }],
      },
    };
  });

  it('keeps the inline bind guidance ready when profile refresh fails', async () => {
    const profileError = new OneKeyLocalError('profile unavailable');
    mockApiFetchPrimeUserInfo.mockRejectedValueOnce(profileError);

    render(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />);

    await waitForInlineBindCardReady();
    expect(mockEnsureKeylessCredentialReady).toHaveBeenCalledTimes(1);
    expect(mockApiFetchPrimeUserInfo).toHaveBeenCalledTimes(1);
    expect(mockLogOneKeyIdLoginFailureReason).toHaveBeenCalledWith(
      expect.stringContaining(
        'OneKeyIdLegacyOAuthBindPrompt profile refresh failed:',
      ),
      profileError,
    );
  });

  it('keeps the inline bind card mounted when the page loses and regains focus', async () => {
    const { rerender } = render(
      <OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />,
    );

    await waitForInlineBindCardReady();
    mockYStack.mockClear();
    mockEnsureKeylessCredentialReady.mockClear();
    mockApiFetchPrimeUserInfo.mockClear();

    rerender(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused={false} />);
    expect(wasInlineBindCardRendered()).toBe(true);
    expect(mockEnsureKeylessCredentialReady).not.toHaveBeenCalled();
    expect(mockApiFetchPrimeUserInfo).not.toHaveBeenCalled();

    rerender(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />);
    expect(wasInlineBindCardRendered()).toBe(true);
    await waitFor(() => {
      expect(mockEnsureKeylessCredentialReady).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the inline bind card when a profile refresh writes empty identities', async () => {
    const { rerender } = render(
      <OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />,
    );

    await waitForInlineBindCardReady();
    mockOneKeyAuthUser = {
      onekeyUserId: 'onekey-user-a',
      onekeyAccount: {
        identities: [],
      },
    };
    mockYStack.mockClear();
    rerender(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />);

    expect(wasInlineBindCardRendered()).toBe(true);
  });

  it('switches to the linked status when an OAuth identity arrives', async () => {
    const { rerender } = render(
      <OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />,
    );

    await waitForInlineBindCardReady();
    mockOneKeyAuthUser = {
      onekeyUserId: 'onekey-user-a',
      onekeyAccount: {
        identities: [
          { identityType: EOneKeyIdIdentityType.LegacyEmail },
          {
            identityType: EOneKeyIdIdentityType.OAuth,
            oauthProvider: EOneKeyIdOAuthProvider.Google,
          },
        ],
      },
    };
    mockYStack.mockClear();
    rerender(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />);

    expect(wasInlineBindCardRendered()).toBe(false);
    expect(wasBoundStatusRendered()).toBe(true);
  });

  it('keeps Google and Apple enabled after the bind card remounts', async () => {
    const { unmount } = render(
      <OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />,
    );

    await waitFor(() => {
      expect(
        isBindProviderButtonEnabled(EOAuthSocialLoginProvider.Google),
      ).toBe(true);
      expect(isBindProviderButtonEnabled(EOAuthSocialLoginProvider.Apple)).toBe(
        true,
      );
    });
    unmount();
    mockButton.mockClear();

    render(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />);

    expect(isBindProviderButtonEnabled(EOAuthSocialLoginProvider.Google)).toBe(
      true,
    );
    expect(isBindProviderButtonEnabled(EOAuthSocialLoginProvider.Apple)).toBe(
      true,
    );
  });

  it('keeps the inline bind card when a profile write drops the user id', async () => {
    const { rerender } = render(
      <OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />,
    );

    await waitForInlineBindCardReady();
    mockOneKeyAuthUser = {
      onekeyAccount: undefined,
    };
    mockYStack.mockClear();
    rerender(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />);

    expect(wasInlineBindCardRendered()).toBe(true);
  });

  it('keeps the inline bind card after remount when identities are unknown', async () => {
    const { unmount } = render(
      <OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />,
    );

    await waitForInlineBindCardReady();
    unmount();
    mockOneKeyAuthUser = {
      onekeyUserId: 'onekey-user-a',
      onekeyAccount: {
        identities: [],
      },
    };
    mockYStack.mockClear();
    render(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />);

    expect(wasInlineBindCardRendered()).toBe(true);
  });

  it('hides the inline bind card after logout', async () => {
    const { rerender } = render(
      <OneKeyIdLegacyOAuthBindPrompt isLoggedIn isFocused />,
    );

    await waitForInlineBindCardReady();
    mockYStack.mockClear();
    rerender(<OneKeyIdLegacyOAuthBindPrompt isLoggedIn={false} isFocused />);

    expect(wasInlineBindCardRendered()).toBe(false);
  });
});

describe('showOneKeyIdLegacyOAuthBindDialog account switch handoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearOneKeyIdLegacyOAuthBindCaches();
    mockCurrentDialogOptions = undefined;
    mockOneKeyAuthUser = undefined;
  });

  it('resumes required Keyless flow only after the account switch succeeds', async () => {
    const onBindSuccess = jest.fn<Promise<void>, []>(async () => {});
    const { resultPromise } = await startRequiredKeylessBind(onBindSuccess);
    const contentProps = getDialogContentProps();

    await contentProps.onBeforeShowAccountSwitchDialog();
    expect(onBindSuccess).not.toHaveBeenCalled();

    await contentProps.onAccountSwitchResult('switched');

    await expect(resultPromise).resolves.toBe(true);
    expect(onBindSuccess).toHaveBeenCalledTimes(1);
  });

  it('suppresses the default dialog footer actions', async () => {
    const onBindSuccess = jest.fn<Promise<void>, []>(async () => {});
    const { resultPromise } = await startRequiredKeylessBind(onBindSuccess);
    const options = mockDialogShow.mock.calls[0]?.[0];
    if (!options) {
      throw new OneKeyLocalError('Expected the OAuth bind dialog to be shown');
    }
    const Content = options.renderContent.type as (
      props: IDialogContentProps,
    ) => ReactElement<IDialogStackProps>;
    const stack = Content(options.renderContent.props);
    const footer = stack.props.children[1];

    expect(footer.props).toMatchObject({
      showConfirmButton: false,
      showCancelButton: false,
    });

    options.onCancel();
    await expect(resultPromise).resolves.toBe(false);
  });

  it.each<IAccountSwitchResult>(['cancelled', 'failed'])(
    'does not resume required Keyless flow when switching is %s',
    async (accountSwitchResult) => {
      const onBindSuccess = jest.fn<Promise<void>, []>(async () => {});
      const { resultPromise } = await startRequiredKeylessBind(onBindSuccess);
      const contentProps = getDialogContentProps();

      await contentProps.onBeforeShowAccountSwitchDialog();
      await contentProps.onAccountSwitchResult(accountSwitchResult);

      await expect(resultPromise).resolves.toBe(false);
      expect(onBindSuccess).not.toHaveBeenCalled();
    },
  );

  it('keeps the existing Keyless logout handoff cancelled', async () => {
    const onBindSuccess = jest.fn<Promise<void>, []>(async () => {});
    const { resultPromise } = await startRequiredKeylessBind(onBindSuccess);
    const contentProps = getDialogContentProps();

    await contentProps.onBeforeShowNestedDialog();

    await expect(resultPromise).resolves.toBe(false);
    expect(onBindSuccess).not.toHaveBeenCalled();
  });

  it('preserves the optional bind result when an account switch succeeds', async () => {
    const resultPromise = showOneKeyIdLegacyOAuthBindDialog({
      type: 'check-required',
      provider: EOAuthSocialLoginProvider.Google,
    });
    await Promise.resolve();
    await Promise.resolve();
    const contentProps = getDialogContentProps();

    await contentProps.onBeforeShowAccountSwitchDialog();
    await contentProps.onAccountSwitchResult('switched');

    await expect(resultPromise).resolves.toBe(false);
  });

  it('gives a required Keyless bind priority over an optional claim in preparation', async () => {
    const optionalClaim = createDeferred<{
      status: 'claimed';
      claimId: string;
    }>();
    mockClaimCredentialUpgradePrompt.mockImplementationOnce(
      () => optionalClaim.promise,
    );
    const optionalResult = showOneKeyIdLegacyOAuthBindDialog({
      type: 'credential-upgrade',
      onekeyUserId: 'onekey-user-a',
    });
    await flushMicrotasks();

    const onBindSuccess = jest.fn<Promise<void>, []>(async () => {});
    const requiredResult = showOneKeyIdLegacyOAuthBindDialog({
      type: 'required-for-keyless',
      provider: EOAuthSocialLoginProvider.Google,
      onBindSuccess,
    });
    await flushMicrotasks();
    expect(mockDialogShow).toHaveBeenCalledTimes(1);

    optionalClaim.resolve({ status: 'claimed', claimId: 'optional-claim' });
    await expect(optionalResult).resolves.toBe('retryable');
    expect(mockReleaseCredentialUpgradePrompt).toHaveBeenCalledWith({
      onekeyUserId: 'onekey-user-a',
      claimId: 'optional-claim',
    });

    mockCurrentDialogOptions?.onCancel();
    await expect(requiredResult).resolves.toBe(false);
  });
});

describe('showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearOneKeyIdLegacyOAuthBindCaches();
    mockCurrentDialogOptions = undefined;
  });

  it('shows for a legacy OneKey ID without requiring a local Keyless credential', async () => {
    mockClaimCredentialUpgradePrompt.mockResolvedValueOnce({ status: 'skip' });

    await expect(
      showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade({
        onekeyUserId: 'user-1',
      }),
    ).resolves.toBe(false);
    expect(mockDialogShow).not.toHaveBeenCalled();

    mockClaimCredentialUpgradePrompt.mockResolvedValueOnce({
      status: 'claimed',
      claimId: 'claim-2',
    });
    const resultPromise =
      showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade({
        onekeyUserId: 'user-1',
      });
    await flushMicrotasks();

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    expect(mockCompleteCredentialUpgradePrompt).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      claimId: 'claim-2',
    });
    mockCurrentDialogOptions?.onCancel();
    await expect(resultPromise).resolves.toBe(false);
  });

  it('retries a transient credential-upgrade claim in the current session', async () => {
    mockClaimCredentialUpgradePrompt
      .mockResolvedValueOnce({ status: 'retryable' })
      .mockResolvedValueOnce({ status: 'claimed', claimId: 'claim-2' });

    const resultPromise =
      showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade({
        onekeyUserId: 'user-1',
      });
    await flushMicrotasks(10);

    expect(mockClaimCredentialUpgradePrompt).toHaveBeenCalledTimes(2);
    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    mockCurrentDialogOptions?.onCancel();
    await expect(resultPromise).resolves.toBe(false);
  });

  it('releases the reminder claim when the app locks before presentation', async () => {
    let skipCheckCount = 0;
    const shouldSkip = jest.fn(() => {
      skipCheckCount += 1;
      return skipCheckCount >= 2;
    });

    await expect(
      showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade({
        onekeyUserId: 'user-1',
        shouldSkip,
      }),
    ).resolves.toBe(false);

    expect(mockClaimCredentialUpgradePrompt).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
    });
    expect(mockReleaseCredentialUpgradePrompt).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      claimId: 'claim-1',
    });
    expect(mockCompleteCredentialUpgradePrompt).not.toHaveBeenCalled();
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it('does not consume the claim when the account changes before onOpen', async () => {
    let didAccountChange = false;
    mockDialogShow.mockImplementationOnce((options) => {
      mockCurrentDialogOptions = options;
      return { close: mockDialogClose };
    });
    const resultPromise =
      showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade({
        onekeyUserId: 'user-1',
        shouldSkip: () => didAccountChange,
      });
    await flushMicrotasks();
    didAccountChange = true;
    mockCurrentDialogOptions?.onOpen?.();

    await expect(resultPromise).resolves.toBe(false);
    expect(mockCompleteCredentialUpgradePrompt).not.toHaveBeenCalled();
    expect(mockReleaseCredentialUpgradePrompt).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      claimId: 'claim-1',
    });
  });

  it('releases the reminder claim when dialog presentation fails', async () => {
    const presentationError = new OneKeyLocalError(
      'dialog presentation failed',
    );
    mockDialogShow.mockImplementationOnce(() => {
      throw presentationError;
    });

    await expect(
      showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade({
        onekeyUserId: 'user-1',
      }),
    ).rejects.toBe(presentationError);

    expect(mockCompleteCredentialUpgradePrompt).not.toHaveBeenCalled();
    expect(mockReleaseCredentialUpgradePrompt).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      claimId: 'claim-1',
    });
  });
});
