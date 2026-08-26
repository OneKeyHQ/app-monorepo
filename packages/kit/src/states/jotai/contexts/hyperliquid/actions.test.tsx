/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react';
import { createStore } from 'jotai';

import {
  perpsActiveAccountIsAgentReadyAtom,
  perpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useHyperliquidActions } from './actions';
import { ProviderJotaiContextHyperliquid } from './atoms';

type IDialogOptions = {
  onClose?: () => void;
  renderContent?: ReactNode;
};

type IDialogMockInstance = {
  close: jest.Mock<Promise<void>, []>;
  getForm: () => undefined;
  isExist: () => boolean;
};

const mockDialogClose = jest.fn<Promise<void>, []>(async () => undefined);
const mockDialogShow = jest.fn<IDialogMockInstance, [IDialogOptions]>();
const mockRefreshHyperLiquidAgentPasswordStatus = jest.fn<
  Promise<{
    isPasswordSet: boolean;
    requiresPasswordSetupOrVerify: boolean;
  }>,
  []
>();
const mockPromptHyperLiquidAgentPasswordSetupOrVerify = jest.fn<
  Promise<void>,
  []
>();
const mockEnableTrading = jest.fn<
  Promise<IPerpsActiveAccountStatusAtom | undefined>,
  []
>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/locale/appLocale',
  ) as typeof import('@onekeyhq/shared/src/locale/appLocale');
  const appLocale = Object.create(actual.appLocale) as typeof actual.appLocale;
  appLocale.intl = {
    ...actual.appLocale.intl,
    formatMessage: ({ id }: { id?: string }) => id ?? '',
  };

  return {
    ...actual,
    appLocale,
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');

  function Container({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) {
    return React.createElement(
      'div',
      {
        'data-testid': testID,
        onClick: onPress,
      },
      children,
    );
  }

  function Button({
    children,
    disabled,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) {
    return React.createElement(
      'button',
      {
        'data-testid': testID,
        disabled,
        onClick: onPress,
        type: 'button',
      },
      children,
    );
  }

  return {
    Button,
    Dialog: {
      Header: Container,
      Title: Container,
      show: (options: IDialogOptions) => mockDialogShow(options),
    },
    Icon: Container,
    SizableText: Container,
    Toast: {
      error: jest.fn(),
      success: jest.fn(),
    },
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      enableTrading: () => mockEnableTrading(),
    },
    servicePassword: {
      promptHyperLiquidAgentPasswordSetupOrVerify: () =>
        mockPromptHyperLiquidAgentPasswordSetupOrVerify(),
      refreshHyperLiquidAgentPasswordStatus: () =>
        mockRefreshHyperLiquidAgentPasswordStatus(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: {
    toastIfError: jest.fn(),
  },
}));

jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/Guide/perpGuideData',
  () => ({
    CONTEXTUAL_ARTICLE_IDS: {
      enableTrading: 'enable-trading',
    },
    buildHelpUrl: (path: string) => path,
    openGuideUrl: jest.fn(),
  }),
);

function buildPerpsAccountStatus(
  canTrade: boolean,
): IPerpsActiveAccountStatusAtom {
  return {
    canTrade,
    canCreateAddress: false,
    accountNotSupport: false,
    accountAddress: '0xabc',
    details: {
      activatedOk: true,
      agentOk: canTrade,
      referralCodeOk: true,
      builderFeeOk: true,
      internalRebateBoundOk: true,
      abstractionOk: true,
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createWrapper() {
  const store = createStore();

  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextHyperliquid store={store}>
        {children}
      </ProviderJotaiContextHyperliquid>
    );
  };
}

describe('useHyperliquidActions.ensureTradingEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDialogShow.mockReturnValue({
      close: mockDialogClose,
      getForm: () => undefined,
      isExist: () => true,
    });
    mockRefreshHyperLiquidAgentPasswordStatus.mockResolvedValue({
      isPasswordSet: true,
      requiresPasswordSetupOrVerify: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies the Agent password before enabling trading', async () => {
    const passwordDeferred = createDeferred<void>();
    const enabledStatus = buildPerpsAccountStatus(true);
    const callOrder: string[] = [];
    jest
      .spyOn(perpsActiveAccountIsAgentReadyAtom, 'get')
      .mockResolvedValue({ isAgentReady: false });
    jest
      .spyOn(perpsActiveAccountStatusAtom, 'get')
      .mockResolvedValue(buildPerpsAccountStatus(false));
    mockPromptHyperLiquidAgentPasswordSetupOrVerify.mockImplementation(
      async () => {
        callOrder.push('password');
        await passwordDeferred.promise;
      },
    );
    mockEnableTrading.mockImplementation(async () => {
      callOrder.push('enableTrading');
      return enabledStatus;
    });

    const { result } = renderHook(() => useHyperliquidActions(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.current.ensureTradingEnabled(),
    ).rejects.toThrow();
    await waitFor(() => expect(mockDialogShow).toHaveBeenCalledTimes(1));

    const dialogOptions = mockDialogShow.mock.calls[0]?.[0];
    const dialogContent = dialogOptions?.renderContent;
    expect(dialogContent).toBeTruthy();
    const dialog = render(dialogContent as ReactElement);

    fireEvent.click(dialog.getByTestId('perp-enable-trading-steps-continue'));

    await waitFor(() =>
      expect(
        mockPromptHyperLiquidAgentPasswordSetupOrVerify,
      ).toHaveBeenCalledTimes(1),
    );
    expect(mockEnableTrading).not.toHaveBeenCalled();
    expect(callOrder).toEqual(['password']);

    await act(async () => {
      passwordDeferred.resolve();
      await passwordDeferred.promise;
    });

    await waitFor(() => expect(mockEnableTrading).toHaveBeenCalledTimes(1));
    expect(callOrder).toEqual(['password', 'enableTrading']);
  });
});
