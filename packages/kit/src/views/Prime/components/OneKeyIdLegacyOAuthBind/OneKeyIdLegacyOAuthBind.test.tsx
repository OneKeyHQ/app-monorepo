/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  showOneKeyIdLegacyOAuthBindDialog,
  showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade,
} from './OneKeyIdLegacyOAuthBind';

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
  Promise<{ status: 'claimed'; claimId: string } | { status: 'skip' }>,
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

jest.mock('@onekeyhq/components', () => ({
  Button: () => null,
  Dialog: {
    Footer: () => null,
    show: (options: IDialogOptions) => mockDialogShow(options),
  },
  Icon: () => null,
  SizableText: () => null,
  Stack: () => null,
  Toast: { success: jest.fn() },
  XStack: () => null,
  YStack: () => null,
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
  useOneKeyAuth: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfErrorDisable: jest.fn(),
    withErrorAutoToast: jest.fn(),
  },
}));

jest.mock('../oneKeyIdLoginToastUtils', () => ({
  showOneKeyIdLoginSuccessToast: jest.fn(),
}));

jest.mock('../useOneKeyIdLocalKeylessOAuth', () => ({
  useOneKeyIdLocalKeylessOAuth: () => ({}),
}));

jest.mock('./oneKeyIdOAuthBindProviders', () => ({
  getOneKeyIdOAuthBindProviders: () => [],
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
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

async function startRequiredKeylessBind(onBindSuccess: () => Promise<void>) {
  const resultPromise = showOneKeyIdLegacyOAuthBindDialog({
    type: 'required-for-keyless',
    provider: EOAuthSocialLoginProvider.Google,
    onBindSuccess,
  });
  await Promise.resolve();
  return { resultPromise };
}

describe('showOneKeyIdLegacyOAuthBindDialog account switch handoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentDialogOptions = undefined;
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
});

describe('showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
