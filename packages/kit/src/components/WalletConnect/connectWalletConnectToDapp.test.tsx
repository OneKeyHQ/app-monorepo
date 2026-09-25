/** @jest-environment jsdom */

import { cloneElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { act, cleanup, render, screen } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EDAppConnectionModal,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

import { navigateModalFromBackground } from '../../provider/navigateModalFromBackground';

import {
  closeWalletConnectConnectionProgress,
  connectWalletConnectToDapp,
} from './connectWalletConnectToDapp';

const pairingUri = `wc:${'1'.repeat(64)}@2?relay-protocol=irn&symKey=${'2'.repeat(64)}`;
const secondPairingUri = `wc:${'3'.repeat(64)}@2?relay-protocol=irn&symKey=${'4'.repeat(64)}`;

const mockConnect = jest.fn<Promise<void>, [string]>();
const mockNavigate = jest.fn<void, unknown[]>();
const mockGetDiagnostics = jest.fn<Promise<typeof mockSnapshot>, []>();
const mockPlatform = platformEnv;
let mockSnapshot = {
  connected: false,
  connecting: false,
  providerConnecting: false,
  connectionAttempts: 12,
  lastFailedConnectionAttempt: 12,
  connectionSuccesses: 2,
  relaySwitchPending: false,
  relayUrl: 'wss://relay.walletconnect.com',
};

type IDialogOptions = {
  showExitButton: boolean;
  onClose: () => void;
  renderContent: ReactElement;
};

const mockDialogs: {
  options: IDialogOptions;
  close: jest.Mock<Promise<void>, []>;
}[] = [];

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    YStack: Stack,
    XStack: Stack,
    SizableText: Stack,
    Icon: () => null,
    Spinner: () => <span>Loading</span>,
    useTheme: () => ({ text: { val: '#ffffff' } }),
    Dialog: {
      show: (options: IDialogOptions) => {
        const close = jest.fn(async () => {
          options.onClose();
        });
        mockDialogs.push({ options, close });
        return { close };
      },
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    walletConnect: {
      connectToDapp: (uri: string) => mockConnect(uri),
    },
    serviceWalletConnect: {
      getWalletSideDiagnostics: () => mockGetDiagnostics(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockSnapshot }),
}));

jest.mock('@onekeyhq/shared/src/appGlobals', () => ({
  __esModule: true,
  default: {
    $navigationRef: {
      current: {
        navigate: (...args: unknown[]) => mockNavigate(...args),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/platformEnv')
  >('@onekeyhq/shared/src/platformEnv');
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      isNative: true,
      runtimeRole: actual.ERuntimeRole.Standalone,
    },
  };
});

jest.mock('@onekeyhq/shared/src/walletConnect/constant', () => ({
  WALLET_CONNECT_RELAY_URL: 'wss://relay.walletconnect.com',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: () => 'Connecting...',
  }),
}));

function deferred() {
  let resolve = () => {};
  let reject = (_error: Error) => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockPlatform.isNative = true;
  mockSnapshot = {
    connected: false,
    connecting: false,
    providerConnecting: false,
    connectionAttempts: 12,
    lastFailedConnectionAttempt: 12,
    connectionSuccesses: 2,
    relaySwitchPending: false,
    relayUrl: 'wss://relay.walletconnect.com',
  };
  mockConnect.mockReset().mockResolvedValue(undefined);
  mockNavigate.mockReset();
  mockGetDiagnostics.mockReset().mockImplementation(async () => mockSnapshot);
});

afterEach(() => {
  cleanup();
  for (const dialog of mockDialogs) dialog.options.onClose();
  mockDialogs.length = 0;
});

it('keeps web/desktop/extension connections silent', async () => {
  mockPlatform.isNative = false;
  await connectWalletConnectToDapp(pairingUri);

  expect(mockConnect).toHaveBeenCalledWith(pairingUri);
  expect(mockGetDiagnostics).not.toHaveBeenCalled();
  expect(mockDialogs).toHaveLength(0);
});

it.each([
  { name: 'a normal web URL', uri: 'https://example.com' },
  { name: 'a transfer URI', uri: 'ethereum:0x1234?value=10' },
  { name: 'an unrelated app deep link', uri: 'onekey-wallet://market' },
  { name: 'a WalletConnect wake-up link', uri: 'onekey-wallet://wc' },
  { name: 'an incomplete WalletConnect URI', uri: 'wc:' },
  {
    name: 'a session request link without pairing credentials',
    uri: `wc:${'1'.repeat(64)}@2?requestId=1&sessionTopic=${'3'.repeat(64)}`,
  },
  { name: 'a V1 URI', uri: pairingUri.replace('@2?', '@1?') },
  { name: 'a malformed version', uri: pairingUri.replace('@2?', '@2invalid?') },
  {
    name: 'an invalid topic',
    uri: pairingUri.replace('1'.repeat(64), 'invalid'),
  },
  { name: 'an invalid pairing key', uri: pairingUri.replace(/2+$/, 'invalid') },
  {
    name: 'a missing relay protocol',
    uri: pairingUri.replace('relay-protocol=irn&', ''),
  },
])('keeps $name out of the loading flow', async ({ uri }) => {
  await connectWalletConnectToDapp(uri);

  expect(mockDialogs).toHaveLength(0);
  expect(mockGetDiagnostics).not.toHaveBeenCalled();
  // Existing SDK validation/error handling remains authoritative.
  expect(mockConnect).toHaveBeenCalledWith(uri);
});

it('does not show a dialog for an already connected socket', async () => {
  mockSnapshot.connected = true;
  await connectWalletConnectToDapp(pairingUri);

  expect(mockConnect).toHaveBeenCalledTimes(1);
  expect(mockDialogs).toHaveLength(0);
});

it('counts only this interaction and updates the relay during fallback', async () => {
  await connectWalletConnectToDapp(pairingUri);
  const content = mockDialogs[0].options.renderContent;
  const view = render(content);
  expect(
    screen.getByTestId('walletconnect-connection-status').textContent,
  ).toBe('Connecting... (0/10)');

  mockSnapshot = {
    ...mockSnapshot,
    connectionAttempts: 18,
    relayUrl: 'wss://relay.walletconnect.org',
  };
  view.rerender(cloneElement(content));
  expect(
    screen.getByTestId('walletconnect-connection-status').textContent,
  ).toBe('Connecting... (6/10)');
  expect(screen.getByTestId('walletconnect-connection-relay').textContent).toBe(
    'wss://relay.walletconnect.org',
  );
});

it('includes an ongoing restoration attempt after an explicit user trigger', async () => {
  mockSnapshot.connecting = true;
  await connectWalletConnectToDapp(pairingUri);
  mockSnapshot = { ...mockSnapshot, connectionAttempts: 13 };
  render(mockDialogs[0].options.renderContent);

  expect(
    screen.getByTestId('walletconnect-connection-status').textContent,
  ).toBe('Connecting... (2/10)');
});

it('closes on socket success before pairing finishes', async () => {
  const pairing = deferred();
  mockConnect.mockReturnValue(pairing.promise);
  const connecting = connectWalletConnectToDapp(pairingUri);
  await act(async () => {});
  const dialog = mockDialogs[0];
  mockSnapshot = { ...mockSnapshot, connected: true, connectionSuccesses: 3 };
  await act(async () => {
    render(dialog.options.renderContent);
  });

  expect(dialog.close).toHaveBeenCalledTimes(1);
  pairing.resolve();
  await connecting;
});

it('also closes when the socket connected and disconnected between polls', async () => {
  await connectWalletConnectToDapp(pairingUri);
  mockSnapshot = { ...mockSnapshot, connectionSuccesses: 3 };
  await act(async () => {
    render(mockDialogs[0].options.renderContent);
  });

  expect(mockDialogs[0].close).toHaveBeenCalledTimes(1);
});

it('allows dismissal without cancelling pairing or reopening on retries', async () => {
  const pairing = deferred();
  mockConnect.mockReturnValue(pairing.promise);
  const connecting = connectWalletConnectToDapp(pairingUri);
  await act(async () => {});
  const dialog = mockDialogs[0];
  expect(dialog.options.showExitButton).toBe(true);
  const view = render(dialog.options.renderContent);
  dialog.options.onClose();
  view.unmount();
  mockSnapshot = { ...mockSnapshot, connectionAttempts: 20 };
  pairing.resolve();
  await connecting;

  expect(mockConnect).toHaveBeenCalledTimes(1);
  expect(mockDialogs).toHaveLength(1);
  expect(dialog.close).not.toHaveBeenCalled();
});

it('uses one dialog for concurrent explicit triggers', async () => {
  await Promise.all([
    connectWalletConnectToDapp(pairingUri),
    connectWalletConnectToDapp(secondPairingUri),
  ]);

  expect(mockDialogs).toHaveLength(1);
  expect(mockConnect).toHaveBeenCalledTimes(2);
});

it.each(['manual', 'connected'] as const)(
  'invalidates pending diagnostics after %s dismissal and permits a new scan',
  async (dismissal) => {
    const firstRead = deferred();
    const secondRead = deferred();
    const oldSnapshot = { ...mockSnapshot };
    mockGetDiagnostics
      .mockImplementationOnce(async () => {
        await firstRead.promise;
        return oldSnapshot;
      })
      .mockImplementationOnce(async () => {
        await secondRead.promise;
        return oldSnapshot;
      });
    const first = connectWalletConnectToDapp(pairingUri);
    const second = connectWalletConnectToDapp(secondPairingUri);
    firstRead.resolve();
    await first;
    const dialog = mockDialogs[0];
    if (dismissal === 'manual') {
      dialog.options.onClose();
    } else {
      mockSnapshot = {
        ...mockSnapshot,
        connected: true,
        connectionSuccesses: 3,
      };
      await act(async () => {
        render(dialog.options.renderContent);
      });
      expect(dialog.close).toHaveBeenCalledTimes(1);
    }

    secondRead.resolve();
    await second;
    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(mockDialogs).toHaveLength(1);

    mockSnapshot = { ...mockSnapshot, connected: false };
    await connectWalletConnectToDapp(pairingUri);
    expect(mockDialogs).toHaveLength(2);
    expect(mockConnect).toHaveBeenCalledTimes(3);
  },
);

it('closes on a rejected pairing and preserves its error', async () => {
  const error = new Error('Pairing expired');
  mockConnect.mockRejectedValue(error);
  await expect(connectWalletConnectToDapp(pairingUri)).rejects.toBe(error);

  expect(mockDialogs[0].close).toHaveBeenCalledTimes(1);
});

it('allows a new pairing after automatic dialog closure fails without an onClose callback', async () => {
  await connectWalletConnectToDapp(pairingUri);
  const first = mockDialogs[0];
  first.close.mockRejectedValue(new Error('Dialog close failed'));
  await expect(closeWalletConnectConnectionProgress()).resolves.toBeUndefined();
  await connectWalletConnectToDapp(secondPairingUri);
  expect(mockDialogs).toHaveLength(2);
  first.options.onClose();
  await closeWalletConnectConnectionProgress();
  expect(mockDialogs[1].close).toHaveBeenCalledTimes(1);
});

it('preserves a pairing failure even if closing its loading also fails', async () => {
  const pairing = deferred();
  mockConnect.mockReturnValueOnce(pairing.promise);
  const connecting = connectWalletConnectToDapp(pairingUri);
  const result = connecting.catch((error: unknown) => error);
  await act(async () => {});
  mockDialogs[0].close.mockRejectedValue(new Error('Dialog close failed'));
  const error = new Error('Pairing expired');
  pairing.reject(error);
  expect(await result).toBe(error);
  await connectWalletConnectToDapp(secondPairingUri);
  expect(mockDialogs).toHaveLength(2);
});

it('returns the pairing error without waiting for an unresponsive dialog close', async () => {
  const pairing = deferred();
  mockConnect.mockReturnValueOnce(pairing.promise);
  const connecting = connectWalletConnectToDapp(pairingUri);
  const result = connecting.catch((error: unknown) => error);
  await act(async () => {});
  mockDialogs[0].close.mockReturnValue(deferred().promise);
  const error = new Error('Pairing expired');
  pairing.reject(error);
  expect(await result).toBe(error);
  await connectWalletConnectToDapp(secondPairingUri);
  expect(mockDialogs).toHaveLength(2);
});

it('does not let an older pairing failure close a new dialog', async () => {
  const first = deferred();
  mockConnect.mockReturnValueOnce(first.promise);
  const connecting = connectWalletConnectToDapp(pairingUri);
  const rejected = connecting.catch((error: unknown) => error);
  await act(async () => {});
  mockDialogs[0].options.onClose();
  await connectWalletConnectToDapp(secondPairingUri);
  const error = new Error('Pairing expired');
  first.reject(error);
  expect(await rejected).toBe(error);

  expect(mockDialogs).toHaveLength(2);
  expect(mockDialogs[1].close).not.toHaveBeenCalled();
});

it('waits for the tenth attempt to finish, then dismisses without cancelling the connection', async () => {
  const pairing = deferred();
  mockConnect.mockReturnValue(pairing.promise);
  const connecting = connectWalletConnectToDapp(pairingUri);
  await act(async () => {});
  const dialog = mockDialogs[0];
  const content = dialog.options.renderContent;
  const view = render(content);
  mockSnapshot = {
    ...mockSnapshot,
    connectionAttempts: 22,
    lastFailedConnectionAttempt: 21,
    connecting: true,
  };
  view.rerender(cloneElement(content));
  expect(
    screen.getByTestId('walletconnect-connection-status').textContent,
  ).toBe('Connecting... (10/10)');
  expect(dialog.close).not.toHaveBeenCalled();

  mockSnapshot = { ...mockSnapshot, lastFailedConnectionAttempt: 22 };
  await act(async () => view.rerender(cloneElement(content)));
  expect(dialog.close).toHaveBeenCalledTimes(1);
  view.unmount();

  // Later SDK retries keep running without resurrecting the dismissed dialog.
  mockSnapshot = { ...mockSnapshot, connectionAttempts: 28 };
  expect(mockDialogs).toHaveLength(1);
  pairing.resolve();
  await connecting;
  expect(mockConnect).toHaveBeenCalledTimes(1);

  await connectWalletConnectToDapp(secondPairingUri);
  expect(mockDialogs).toHaveLength(2);
  render(mockDialogs[1].options.renderContent);
  expect(
    screen.getByTestId('walletconnect-connection-status').textContent,
  ).toBe('Connecting... (1/10)');
});

it('dismisses if polling skips beyond the tenth attempt', async () => {
  await connectWalletConnectToDapp(pairingUri);
  mockSnapshot = { ...mockSnapshot, connectionAttempts: 25 };
  await act(async () => render(mockDialogs[0].options.renderContent));
  expect(
    screen.getByTestId('walletconnect-connection-status').textContent,
  ).toBe('Connecting... (10/10)');
  expect(mockDialogs[0].close).toHaveBeenCalledTimes(1);
});

const proposalNavigation = {
  screen: ERootRoutes.iOSFullScreen,
  params: {
    screen: EModalRoutes.DAppConnectionModal,
    params: {
      screen: EDAppConnectionModal.WalletConnectSessionProposalModal,
      params: { query: 'proposal' },
    },
  },
};

it.each(['success', 'rejection', 'pending'] as const)(
  'dismisses progress independently of navigation with a %s close result',
  async (result) => {
    await connectWalletConnectToDapp(pairingUri);
    const dialog = mockDialogs[0];
    if (result === 'rejection') {
      dialog.close.mockRejectedValue(new Error('Dialog close failed'));
    } else if (result === 'pending') {
      dialog.close.mockReturnValue(deferred().promise);
    }
    expect(
      appEventBus.listenerCount(
        EAppEventBusNames.NavigateModalFromBackgroundThread,
      ),
    ).toBe(0);
    appEventBus.emit(
      EAppEventBusNames.WalletConnectCloseConnectionProgress,
      undefined,
    );
    await act(async () => {});
    expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();

    await connectWalletConnectToDapp(secondPairingUri);
    expect(mockDialogs).toHaveLength(2);
  },
);

it('invalidates pending progress through the close-only signal without a navigation listener', async () => {
  const reading = deferred();
  mockGetDiagnostics.mockReturnValueOnce(
    reading.promise.then(() => mockSnapshot),
  );
  const connecting = connectWalletConnectToDapp(pairingUri);
  appEventBus.emit(
    EAppEventBusNames.WalletConnectCloseConnectionProgress,
    undefined,
  );
  reading.resolve();
  await connecting;
  expect(mockDialogs).toHaveLength(0);
  expect(mockConnect).toHaveBeenCalledWith(pairingUri);
  expect(mockNavigate).not.toHaveBeenCalled();

  await connectWalletConnectToDapp(secondPairingUri);
  expect(mockDialogs).toHaveLength(1);
});

it.each([ERootRoutes.Modal, ERootRoutes.iOSFullScreen])(
  'navigates to a proposal in %s immediately while loading closes asynchronously',
  async (root) => {
    const pairing = deferred();
    mockConnect.mockReturnValue(pairing.promise);
    const connecting = connectWalletConnectToDapp(pairingUri);
    await act(async () => {});
    const dialog = mockDialogs[0];
    const closing = deferred();
    dialog.close.mockImplementation(async () => {
      await closing.promise;
      dialog.options.onClose();
    });
    const navigation = { ...proposalNavigation, screen: root };
    navigateModalFromBackground(navigation);
    expect(mockNavigate).toHaveBeenCalledWith(root, navigation.params);
    await act(async () => {});

    expect(mockSnapshot.connected).toBe(false);
    expect(dialog.close).toHaveBeenCalledTimes(1);
    closing.resolve();
    await act(async () => {});
    expect(mockNavigate).toHaveBeenCalledTimes(1);

    // Dismissing progress never waits for or cancels the SDK pairing promise.
    pairing.resolve();
    await connecting;
    expect(mockConnect).toHaveBeenCalledTimes(1);
  },
);

it('navigates immediately without closing twice when socket polling is already closing loading', async () => {
  await connectWalletConnectToDapp(pairingUri);
  const dialog = mockDialogs[0];
  const closing = deferred();
  dialog.close.mockImplementation(async () => {
    await closing.promise;
    dialog.options.onClose();
  });
  mockSnapshot = { ...mockSnapshot, connected: true };
  render(dialog.options.renderContent);
  navigateModalFromBackground(proposalNavigation);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  await act(async () => {});

  expect(dialog.close).toHaveBeenCalledTimes(1);
  closing.resolve();
  await act(async () => {});
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('never blocks proposal navigation if closing loading never settles', async () => {
  await connectWalletConnectToDapp(pairingUri);
  const dialog = mockDialogs[0];
  dialog.close.mockReturnValue(deferred().promise);
  expect(navigateModalFromBackground(proposalNavigation)).toBeUndefined();
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  await act(async () => {});
  expect(dialog.close).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('contains a loading close failure without affecting proposal navigation', async () => {
  await connectWalletConnectToDapp(pairingUri);
  const dialog = mockDialogs[0];
  dialog.close.mockRejectedValue(new Error('Dialog close failed'));
  navigateModalFromBackground(proposalNavigation);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  await act(async () => {});
  expect(dialog.close).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('prevents a late diagnostics read from opening loading over the proposal, but allows a new scan', async () => {
  const reading = deferred();
  mockGetDiagnostics.mockReturnValueOnce(
    reading.promise.then(() => mockSnapshot),
  );
  const connecting = connectWalletConnectToDapp(pairingUri);
  navigateModalFromBackground(proposalNavigation);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  await act(async () => {});
  reading.resolve();
  await connecting;
  expect(mockDialogs).toHaveLength(0);
  expect(mockConnect).toHaveBeenCalledWith(pairingUri);

  await connectWalletConnectToDapp(secondPairingUri);
  expect(mockDialogs).toHaveLength(1);
});

it('opens a proposal normally after the user manually dismisses loading', async () => {
  await connectWalletConnectToDapp(pairingUri);
  const dialog = mockDialogs[0];
  dialog.options.onClose();
  navigateModalFromBackground(proposalNavigation);
  await act(async () => {});

  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(dialog.close).not.toHaveBeenCalled();
  expect(mockDialogs).toHaveLength(1);
});

it.each([
  {
    name: 'a signing request',
    screen: ERootRoutes.Modal,
    modal: EModalRoutes.DAppConnectionModal,
    page: EDAppConnectionModal.SignMessageModal,
    native: true,
  },
  {
    name: 'an injected-provider connection request',
    screen: ERootRoutes.Modal,
    modal: EModalRoutes.DAppConnectionModal,
    page: EDAppConnectionModal.ConnectionModal,
    native: true,
  },
  {
    name: 'another modal flow',
    screen: ERootRoutes.Modal,
    modal: EModalRoutes.SettingModal,
    page: EDAppConnectionModal.WalletConnectSessionProposalModal,
    native: true,
  },
  {
    name: 'another root route',
    screen: ERootRoutes.Main,
    modal: EModalRoutes.DAppConnectionModal,
    page: EDAppConnectionModal.WalletConnectSessionProposalModal,
    native: true,
  },
  {
    name: 'a non-native proposal',
    screen: ERootRoutes.Modal,
    modal: EModalRoutes.DAppConnectionModal,
    page: EDAppConnectionModal.WalletConnectSessionProposalModal,
    native: false,
  },
])('does not dismiss progress for $name', async (route) => {
  await connectWalletConnectToDapp(pairingUri);
  mockPlatform.isNative = route.native;
  const navigation = {
    screen: route.screen,
    params: { screen: route.modal, params: { screen: route.page } },
  };
  navigateModalFromBackground(navigation);
  await act(async () => {});

  expect(mockDialogs[0].close).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith(route.screen, navigation.params);
});
