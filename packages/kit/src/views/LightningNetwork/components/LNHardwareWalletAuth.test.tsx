/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import WalletContentWithAuth from '@onekeyhq/kit/src/views/Home/pages/WalletContentWithAuth';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import enCatalog from '@onekeyhq/shared/src/locale/json/en_US.json';

import LNHardwareWalletAuth from './LNHardwareWalletAuth';

type IParams = { accountId: string; networkId: string };
// Match existing IntlProvider tests: the generated catalog contains the real
// production messages exercised here, not the mock-only global message IDs.
const messages: Record<string, string> = enCatalog;
const mockCheckAuth = jest.fn<Promise<boolean>, [IParams]>();
const mockExchangeToken = jest.fn<Promise<void>, [IParams]>();
const mockToastError = jest.fn<void, [unknown]>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true, isRuntimeBrowser: true },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const visible = {
    resolve: () => undefined,
    reset: () => undefined,
    promise: Promise.resolve(),
  };
  type IProps = { children?: ReactNode; testID?: string };
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise: () => visible,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    Stack: ({ children, testID }: IProps) =>
      createElement('div', { 'data-testid': testID }, children),
    Spinner: () => createElement('span', { role: 'status' }, 'Loading'),
    Empty: ({
      title,
      description,
      buttonProps,
    }: {
      title: string;
      description?: string;
      buttonProps: {
        children: ReactNode;
        onPress: () => void;
        loading?: boolean;
      };
    }) =>
      createElement(
        'section',
        {},
        createElement('h2', {}, title),
        description ? createElement('p', {}, description) : null,
        createElement(
          'button',
          {
            onClick: buttonProps.onPress,
            disabled: buttonProps.loading,
            'aria-busy': !!buttonProps.loading,
          },
          buttonProps.children,
        ),
      ),
    Toast: { error: (params: unknown) => mockToastError(params) },
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceLightning: {
      checkAuth: (params: IParams) => mockCheckAuth(params),
      exchangeToken: (params: IParams) => mockExchangeToken(params),
    },
  },
}));

const hwAccountId = "hw-local--m/44'/81297820149147'/0'";
const hdAccountId = "hd-local--m/44'/81297820149147'/0'/0/0";
const networkId = 'lightning--0';

function renderAccount(accountId: string, network = networkId) {
  return render(
    <IntlProvider locale="en-US" messages={messages}>
      <WalletContentWithAuth accountId={accountId} networkId={network}>
        <div>Authorized wallet content</div>
      </WalletContentWithAuth>
    </IntlProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckAuth.mockRejectedValue(
    new OneKeyLocalError('Synthetic auth required'),
  );
  mockExchangeToken.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test.each([hwAccountId, hdAccountId])(
  'automatic authentication checks for %s never exchange tokens',
  async (accountId) => {
    renderAccount(accountId);
    await screen.findByRole('button');
    expect(mockCheckAuth).toHaveBeenCalledTimes(1);
    expect(mockCheckAuth).toHaveBeenCalledWith({ accountId, networkId });
    expect(mockExchangeToken).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(screen.queryByText('Authorized wallet content')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  },
);

test('a software account offers explicit continuation without hardware instructions', async () => {
  renderAccount(hdAccountId);
  await screen.findByRole('button', { name: 'Continue' });
  expect(screen.queryByText(/hardware wallet/i)).toBeNull();
  expect(mockExchangeToken).not.toHaveBeenCalled();
});

test('a hardware account retains the existing explicit hardware authorization control', async () => {
  renderAccount(hwAccountId);
  await screen.findByRole('button', { name: 'Connect hardware wallet' });
  expect(mockExchangeToken).not.toHaveBeenCalled();
});

test('an explicit false auth result cannot expose wallet content', async () => {
  mockCheckAuth.mockResolvedValue(false);
  renderAccount(hdAccountId);
  await screen.findByRole('button', { name: 'Continue' });
  expect(screen.queryByText('Authorized wallet content')).toBeNull();
  expect(mockExchangeToken).not.toHaveBeenCalled();
});

test('successful explicit authorization rechecks before showing wallet content', async () => {
  jest.useFakeTimers();
  renderAccount(hdAccountId);
  const button = await screen.findByRole('button', { name: 'Continue' });
  mockCheckAuth.mockResolvedValue(true);
  await act(async () => {
    fireEvent.click(button);
  });
  expect(mockExchangeToken).toHaveBeenCalledTimes(1);
  expect(mockExchangeToken).toHaveBeenCalledWith({
    accountId: hdAccountId,
    networkId,
  });
  expect(screen.queryByText('Authorized wallet content')).toBeNull();
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  await screen.findByText('Authorized wallet content');
  expect(mockCheckAuth).toHaveBeenCalledTimes(2);
  expect(mockToastError).not.toHaveBeenCalled();
});

test('cancelling explicit authorization restores the button without retry or a stuck spinner', async () => {
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  let cancelAuthorization: (reason: unknown) => void = () => undefined;
  mockExchangeToken.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        cancelAuthorization = reject;
      }),
  );
  renderAccount(hdAccountId);
  const button = await screen.findByRole('button', { name: 'Continue' });
  await act(async () => {
    fireEvent.click(button);
  });
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.hasAttribute('disabled')).toBe(true);
  fireEvent.click(button);
  expect(mockExchangeToken).toHaveBeenCalledTimes(1);
  await act(async () =>
    cancelAuthorization(new OneKeyLocalError('Synthetic cancellation')),
  );
  await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('false'));
  expect(button.hasAttribute('disabled')).toBe(false);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(mockExchangeToken).toHaveBeenCalledTimes(1);
  expect(mockCheckAuth).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText('Authorized wallet content')).toBeNull();
  expect(mockToastError).toHaveBeenCalledTimes(1);
});

test.each([
  { accountId: hwAccountId, network: 'evm--1' },
  { accountId: 'external--lightning', network: networkId },
  { accountId: 'watching--lightning', network: networkId },
  { accountId: 'imported--lightning', network: networkId },
])(
  'unrelated wallet content remains available for %j',
  ({ accountId, network }) => {
    renderAccount(accountId, network);
    expect(screen.getByText('Authorized wallet content')).not.toBeNull();
    expect(mockCheckAuth).not.toHaveBeenCalled();
    expect(mockExchangeToken).not.toHaveBeenCalled();
  },
);

test('an existing valid authorization displays children without opening a wallet prompt', async () => {
  mockCheckAuth.mockResolvedValue(true);
  render(
    <IntlProvider locale="en-US" messages={messages}>
      <LNHardwareWalletAuth accountId={hwAccountId} networkId={networkId}>
        <div>Authorized wallet content</div>
      </LNHardwareWalletAuth>
    </IntlProvider>,
  );
  await screen.findByText('Authorized wallet content');
  expect(mockExchangeToken).not.toHaveBeenCalled();
  expect(screen.queryByRole('button')).toBeNull();
});

test('switching accounts cannot retain the previous account authorization while the new check is pending', async () => {
  mockCheckAuth.mockResolvedValueOnce(true);
  const { rerender } = renderAccount(hwAccountId);
  await screen.findByText('Authorized wallet content');
  let rejectNewCheck: (reason: unknown) => void = () => undefined;
  mockCheckAuth.mockImplementationOnce(
    () =>
      new Promise<boolean>((_resolve, reject) => {
        rejectNewCheck = reject;
      }),
  );
  rerender(
    <IntlProvider locale="en-US" messages={messages}>
      <WalletContentWithAuth accountId={hdAccountId} networkId={networkId}>
        <div>Authorized wallet content</div>
      </WalletContentWithAuth>
    </IntlProvider>,
  );
  try {
    expect(screen.queryByText('Authorized wallet content')).toBeNull();
    expect(screen.getByRole('status')).not.toBeNull();
  } finally {
    await act(async () =>
      rejectNewCheck(new OneKeyLocalError('Synthetic auth required')),
    );
  }
  await screen.findByRole('button', { name: 'Continue' });
  expect(mockExchangeToken).not.toHaveBeenCalled();
});

test('a late cancelled authorization cannot show errors or retry in a newly selected account', async () => {
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  let cancelOldAuthorization: (reason: unknown) => void = () => undefined;
  mockExchangeToken.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, reject) => {
        cancelOldAuthorization = reject;
      }),
  );
  const { rerender } = renderAccount(hwAccountId);
  const button = await screen.findByRole('button', {
    name: 'Connect hardware wallet',
  });
  await act(async () => {
    fireEvent.click(button);
  });
  expect(mockExchangeToken).toHaveBeenCalledWith({
    accountId: hwAccountId,
    networkId,
  });
  rerender(
    <IntlProvider locale="en-US" messages={messages}>
      <WalletContentWithAuth accountId={hdAccountId} networkId={networkId}>
        <div>Authorized wallet content</div>
      </WalletContentWithAuth>
    </IntlProvider>,
  );
  await screen.findByRole('button', { name: 'Continue' });
  await act(async () =>
    cancelOldAuthorization(
      new OneKeyLocalError('Synthetic stale cancellation'),
    ),
  );
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(mockToastError).not.toHaveBeenCalled();
  expect(mockExchangeToken).toHaveBeenCalledTimes(1);
  expect(mockCheckAuth).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('Authorized wallet content')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Continue' }).getAttribute('aria-busy'),
  ).toBe('false');
});

test('a late successful authorization cannot schedule another check after leaving its account', async () => {
  jest.useFakeTimers();
  let finishOldAuthorization: () => void = () => undefined;
  mockExchangeToken.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishOldAuthorization = resolve;
      }),
  );
  const { rerender } = renderAccount(hwAccountId);
  const button = await screen.findByRole('button', {
    name: 'Connect hardware wallet',
  });
  await act(async () => {
    fireEvent.click(button);
  });
  rerender(
    <IntlProvider locale="en-US" messages={messages}>
      <WalletContentWithAuth accountId={hdAccountId} networkId={networkId}>
        <div>Authorized wallet content</div>
      </WalletContentWithAuth>
    </IntlProvider>,
  );
  await screen.findByRole('button', { name: 'Continue' });
  await act(async () => finishOldAuthorization());
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(mockCheckAuth).toHaveBeenCalledTimes(2);
  expect(mockCheckAuth).toHaveBeenLastCalledWith({
    accountId: hdAccountId,
    networkId,
  });
  expect(mockExchangeToken).toHaveBeenCalledTimes(1);
  expect(mockToastError).not.toHaveBeenCalled();
  expect(screen.queryByText('Authorized wallet content')).toBeNull();
});
