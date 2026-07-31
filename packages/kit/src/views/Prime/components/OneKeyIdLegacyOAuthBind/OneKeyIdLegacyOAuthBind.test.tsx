/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { showOneKeyIdLegacyOAuthBindDialog } from './OneKeyIdLegacyOAuthBind';

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
  return { close: mockDialogClose };
});
const mockIsLegacyOAuthBindRequired = jest.fn<Promise<boolean>, []>(
  async () => true,
);

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
      isLegacyOneKeyIdOAuthBindRequired: () => mockIsLegacyOAuthBindRequired(),
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
