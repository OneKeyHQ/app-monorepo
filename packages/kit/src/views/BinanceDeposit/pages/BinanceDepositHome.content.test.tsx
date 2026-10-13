/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAssetSymbol,
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositLocalReport,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';

import { BinanceDepositTestIDs } from '../testIDs';

import BinanceDepositHome from './BinanceDepositHome';

// The page is rendered with its real sections, layout and state helpers. The
// component library is replaced by plain elements that keep `testID`,
// `disabled` and `onPress`, and the hooks that talk to the service return
// what each test puts into the objects below.

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: true, settings: {} }],
}));

jest.mock('@onekeyhq/components', () => {
  type IChildren = { children?: ReactNode };
  const Box = ({ children }: IChildren) => <div>{children}</div>;
  const Text = ({ children, testID }: IChildren & { testID?: string }) => (
    <span data-testid={testID}>{children}</span>
  );
  const PressButton = ({
    children,
    testID,
    disabled,
    onPress,
  }: IChildren & {
    testID?: string;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      type="button"
      data-testid={testID}
      disabled={Boolean(disabled)}
      onClick={onPress}
    >
      {children}
    </button>
  );
  return {
    Page: Object.assign(Box, {
      Header: ({ title }: { title: string }) => <h1>{title}</h1>,
      Body: Box,
      Container: Box,
    }),
    Alert: ({
      title,
      description,
      testID,
    }: {
      title?: string;
      description?: string;
      testID?: string;
    }) => (
      <div data-testid={testID}>
        <span>{title}</span>
        <span>{description}</span>
      </div>
    ),
    Badge: Object.assign(
      ({ children, testID }: IChildren & { testID?: string }) => (
        <span data-testid={testID}>{children}</span>
      ),
      { Text },
    ),
    Button: PressButton,
    IconButton: PressButton,
    Input: ({
      value,
      onChangeText,
      editable,
      testID,
    }: {
      value?: string;
      onChangeText?: (text: string) => void;
      editable?: boolean;
      testID?: string;
    }) => (
      <input
        data-testid={testID}
        value={value ?? ''}
        disabled={editable === false}
        onChange={(event) => onChangeText?.(event.target.value)}
      />
    ),
    Select: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
    SizableText: Text,
    Stack: Box,
    XStack: Box,
    useClipboard: () => ({ copyText: jest.fn() }),
  };
});

jest.mock('../../../components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: { network: { id: 'evm--56' } } }),
}));
jest.mock('../sendFlow', () => ({
  BINANCE_DEPOSIT_SIGN_ONLY_TEXT: 'sign only',
}));

type IMockPageState = {
  active?: IBinanceDepositSessionSnapshot;
  // What the asset list has for the asset of the session; undefined when the
  // list does not carry it.
  assetSymbol?: IBinanceDepositAssetSymbol;
  assetsLoading: boolean;
  assetsLoadFailed: boolean;
  amount: string;
  hasSentLocally: boolean;
  // The clock of the page, as the state hook hands it out.
  now: number;
};
const PAGE_NOW = 1_700_000_200_000;
const mockPage: IMockPageState = {
  assetsLoading: false,
  assetsLoadFailed: false,
  amount: '',
  hasSentLocally: false,
  now: PAGE_NOW,
};
const mockActions = {
  busyAction: undefined,
  createAddress: jest.fn(),
  createSession: jest.fn(),
  retryCreate: jest.fn(),
  openBinance: jest.fn(),
  refreshSession: jest.fn(),
  abandonSession: jest.fn(),
  acknowledgeSendAttempt: jest.fn(),
  retryReport: jest.fn(),
};
const mockSetAmount = jest.fn();
const mockReviewAndSend = jest.fn();
const mockUseSend = jest.fn();

jest.mock('../hooks/useBinanceDepositState', () => ({
  useBinanceDepositState: () => ({
    state: { active: mockPage.active, recent: [], events: [] },
    isStateUnavailable: false,
    now: mockPage.now,
    refresh: jest.fn(),
  }),
}));
jest.mock('../hooks/useBinanceDepositAssets', () => ({
  useBinanceDepositAssets: () => ({
    networks: [],
    networkNames: {},
    isLoading: mockPage.assetsLoading,
    loadFailed: mockPage.assetsLoadFailed,
    reloadAssets: jest.fn(),
    network: undefined,
    symbol: undefined,
    selectNetwork: jest.fn(),
    selectSymbol: jest.fn(),
    findSymbol: () => mockPage.assetSymbol,
  }),
}));
jest.mock('../hooks/useBinanceDepositSender', () => ({
  useBinanceDepositSender: () => ({
    sender: undefined,
    isLoading: false,
    isWatchingAccount: false,
    accountName: 'Account #1',
    createSenderAddress: jest.fn(),
  }),
}));
jest.mock('../hooks/useBinanceDepositPageLog', () => ({
  useBinanceDepositPageLog: () => ({
    pageEvents: [],
    logLinkOpen: jest.fn(),
    logSendResult: jest.fn(),
  }),
}));
jest.mock('../hooks/useBinanceDepositActions', () => ({
  useBinanceDepositActions: () => mockActions,
}));
jest.mock('../hooks/useBinanceDepositSend', () => ({
  useBinanceDepositSend: (params: unknown): unknown => {
    mockUseSend(params);
    return {
      isPreparing: false,
      amount: mockPage.amount,
      setAmount: mockSetAmount,
      notice: undefined,
      hasSentLocally: mockPage.hasSentLocally,
      reviewAndSend: mockReviewAndSend,
    };
  },
}));

const destination: IBinanceDepositAuthorizedDestination = {
  networkId: 'evm--56',
  binanceNetwork: 'BSC',
  cryptoCurrency: 'USDT',
  contractAddress: '0x55d398326f99059fF775485246999027B3197955',
  minAmount: '1',
  address: '0x000000000000000000000000000000000000dEaD',
  authorizedAt: 1_700_000_000_000,
};

function buildSession(
  patch: Partial<IBinanceDepositSessionSnapshot> = {},
): IBinanceDepositSessionSnapshot {
  return {
    localId: 'local-id-0001',
    sessionId: 'a'.repeat(64),
    accountId: "hd-1--m/44'/60'/0'/0/0",
    senderAddress: '0x1111111111111111111111111111111111111111',
    networkId: 'evm--56',
    cryptoCurrency: 'USDT',
    status: EBinanceDepositSessionStatus.INIT,
    createdAt: 1,
    updatedAt: 1,
    awaitingReturn: false,
    hasPendingNonce: false,
    bindInFlight: false,
    sessionIdMasked: 'aaaaaaaa…',
    endpointMismatch: false,
    ...patch,
  };
}

function buildAuthorized(
  patch: Partial<IBinanceDepositSessionSnapshot> = {},
): IBinanceDepositSessionSnapshot {
  return buildSession({
    status: EBinanceDepositSessionStatus.AUTHORIZED,
    destination,
    ...patch,
  });
}

function buildReport(
  patch: Partial<IBinanceDepositLocalReport> = {},
): IBinanceDepositLocalReport {
  return {
    txHash: `0x${'ab'.repeat(32)}`,
    senderAddress: '0x1111111111111111111111111111111111111111',
    status: 'PENDING',
    attempts: 1,
    updatedAt: 2,
    ...patch,
  };
}

function getButton(testID: string): HTMLButtonElement {
  return screen.getByTestId(testID);
}

function renderPage(patch: Partial<IMockPageState> = {}) {
  Object.assign(mockPage, patch);
  return render(<BinanceDepositHome />);
}

describe('BinanceDepositHome content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPage.active = undefined;
    mockPage.assetSymbol = undefined;
    mockPage.assetsLoading = false;
    mockPage.assetsLoadFailed = false;
    mockPage.amount = '';
    mockPage.hasSentLocally = false;
    mockPage.now = PAGE_NOW;
    jest.replaceProperty(platformEnv, 'isNative', true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('send section', () => {
    it('offers the transfer for an authorized session', () => {
      renderPage({ active: buildAuthorized(), amount: '5' });

      expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
        false,
      );
      expect(
        screen.queryByTestId(BinanceDepositTestIDs.sendAttemptAlert),
      ).toBeNull();
      expect(
        screen.queryByTestId(BinanceDepositTestIDs.ackSendAttemptBtn),
      ).toBeNull();

      fireEvent.click(getButton(BinanceDepositTestIDs.reviewSendBtn));
      expect(mockReviewAndSend).toHaveBeenCalledWith('5');
    });

    it('binds the amount input to the amount kept for the session', () => {
      renderPage({ active: buildAuthorized(), amount: '20' });
      const input: HTMLInputElement = screen.getByTestId(
        BinanceDepositTestIDs.amountInput,
      );
      expect(input.value).toBe('20');

      fireEvent.change(input, { target: { value: '21' } });
      expect(mockSetAmount).toHaveBeenCalledWith('21');
    });

    it('holds the transfer after a recorded signing attempt until it is acknowledged', () => {
      // The attempt is 100 seconds old: past the wait for acknowledging it.
      const { rerender } = renderPage({
        active: buildAuthorized({ sendAttemptedAt: 1_700_000_100_000 }),
        amount: '5',
      });

      const alert = screen.getByTestId(BinanceDepositTestIDs.sendAttemptAlert);
      expect(alert.textContent).toContain('may already have been broadcast');
      expect(alert.textContent).toContain('history');
      expect(alert.textContent).toContain(
        'Check the history of the sender account first.',
      );
      expect(alert.textContent).not.toContain('may still be in progress');
      expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
        true,
      );
      fireEvent.click(getButton(BinanceDepositTestIDs.reviewSendBtn));
      expect(mockReviewAndSend).not.toHaveBeenCalled();

      const ackButton = getButton(BinanceDepositTestIDs.ackSendAttemptBtn);
      expect(ackButton.textContent).toBe(
        'I checked: the previous transfer was not sent',
      );
      expect(ackButton.disabled).toBe(false);
      fireEvent.click(ackButton);
      expect(mockActions.acknowledgeSendAttempt).toHaveBeenCalledTimes(1);

      // The service cleared the mark: the next snapshot no longer has it.
      mockPage.active = buildAuthorized();
      rerender(<BinanceDepositHome />);
      expect(
        screen.queryByTestId(BinanceDepositTestIDs.sendAttemptAlert),
      ).toBeNull();
      expect(
        screen.queryByTestId(BinanceDepositTestIDs.ackSendAttemptBtn),
      ).toBeNull();
      expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
        false,
      );
    });

    it('drops the hold once the transfer has a report', () => {
      renderPage({
        active: buildAuthorized({
          sendAttemptedAt: 1_700_000_100_000,
          report: buildReport(),
        }),
      });
      expect(
        screen.queryByTestId(BinanceDepositTestIDs.sendAttemptAlert),
      ).toBeNull();
      expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
        true,
      );
    });

    describe('wait before a signing attempt can be acknowledged', () => {
      const ATTEMPTED_AT = 1_700_000_100_000;
      const HOLD_MS = BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS;
      const ACK_LABEL = 'I checked: the previous transfer was not sent';

      function renderAttempted(now: number) {
        return renderPage({
          active: buildAuthorized({ sendAttemptedAt: ATTEMPTED_AT }),
          amount: '5',
          now,
        });
      }

      function expectAckOnHold(seconds: number) {
        const ackButton = getButton(BinanceDepositTestIDs.ackSendAttemptBtn);
        expect(ackButton.disabled).toBe(true);
        expect(ackButton.textContent).toBe(
          `Wait ${seconds}s before confirming`,
        );
        fireEvent.click(ackButton);
        expect(mockActions.acknowledgeSendAttempt).not.toHaveBeenCalled();

        const alert = screen.getByTestId(
          BinanceDepositTestIDs.sendAttemptAlert,
        );
        expect(alert.textContent).toContain('may already have been broadcast');
        // Why there is a wait, for how long, and what to do after it.
        expect(alert.textContent).toContain(
          `Signing and broadcasting may still be in progress: wait ${seconds}s, then check the history of the sender account.`,
        );
        expect(alert.textContent).toContain(
          'Sending is off until you confirm below',
        );
        // The transfer itself stays off as well.
        expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
          true,
        );
      }

      it.each<[string, number, number]>([
        ['right after the attempt', 0, 90],
        ['half a minute in', 30_000, 60],
        ['one millisecond before the wait is over', HOLD_MS - 1, 1],
        // The device clock was set back after the attempt was recorded.
        ['with the device clock set back by ten seconds', -10_000, 100],
      ])(
        'keeps the confirmation off and shows the time left %s',
        (_label, elapsedMs, seconds) => {
          renderAttempted(ATTEMPTED_AT + elapsedMs);
          expectAckOnHold(seconds);
        },
      );

      it('counts down as the clock of the page moves, then offers the confirmation', () => {
        const { rerender } = renderAttempted(ATTEMPTED_AT + 88_000);
        expectAckOnHold(2);

        mockPage.now = ATTEMPTED_AT + 89_000;
        rerender(<BinanceDepositHome />);
        expectAckOnHold(1);

        // From the very moment the service accepts it.
        mockPage.now = ATTEMPTED_AT + HOLD_MS;
        rerender(<BinanceDepositHome />);
        const ackButton = getButton(BinanceDepositTestIDs.ackSendAttemptBtn);
        expect(ackButton.disabled).toBe(false);
        expect(ackButton.textContent).toBe(ACK_LABEL);
        const alert = screen.getByTestId(
          BinanceDepositTestIDs.sendAttemptAlert,
        );
        expect(alert.textContent).not.toContain('may still be in progress');
        expect(alert.textContent).toContain(
          'Check the history of the sender account first.',
        );
        fireEvent.click(ackButton);
        expect(mockActions.acknowledgeSendAttempt).toHaveBeenCalledTimes(1);
        // Acknowledging is not sending: that stays off until the mark is gone.
        expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
          true,
        );
      });

      it('asks for no wait once the transfer has a report, and still does not offer to send', () => {
        renderPage({
          active: buildAuthorized({
            sendAttemptedAt: ATTEMPTED_AT,
            report: buildReport(),
          }),
          amount: '5',
          now: ATTEMPTED_AT,
        });
        expect(
          screen.queryByTestId(BinanceDepositTestIDs.sendAttemptAlert),
        ).toBeNull();
        expect(
          screen.queryByTestId(BinanceDepositTestIDs.ackSendAttemptBtn),
        ).toBeNull();
        const sendButton = getButton(BinanceDepositTestIDs.reviewSendBtn);
        expect(sendButton.disabled).toBe(true);
        fireEvent.click(sendButton);
        expect(mockReviewAndSend).not.toHaveBeenCalled();
      });
    });

    it('shows the minimum in force and where it comes from', () => {
      const { rerender } = renderPage({ active: buildAuthorized() });
      const hint = () =>
        screen.getByTestId(BinanceDepositTestIDs.minAmountHint).textContent;
      expect(hint()).toBe('Minimum 1, set with the deposit address.');
      // The asset list does not carry the asset: the minimum released with
      // the address still applies, and the flow is told about the list.
      expect(mockUseSend).toHaveBeenLastCalledWith(
        expect.objectContaining({
          depositDust: undefined,
          requiresAddressTag: undefined,
          isAssetListReady: false,
        }),
      );
      expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
        false,
      );

      // The asset list carries a higher deposit dust for the asset.
      mockPage.assetSymbol = {
        symbol: 'USDT',
        depositDust: '5',
        requiresAddressTag: false,
      };
      rerender(<BinanceDepositHome />);
      expect(hint()).toContain('Minimum 5');
      expect(hint()).toContain('deposit dust');
      // The transfer is checked against the same value.
      expect(mockUseSend).toHaveBeenLastCalledWith(
        expect.objectContaining({
          depositDust: '5',
          requiresAddressTag: false,
          isAssetListReady: true,
        }),
      );

      // A lower one changes nothing.
      mockPage.assetSymbol = { symbol: 'USDT', depositDust: '0.01' };
      rerender(<BinanceDepositHome />);
      expect(hint()).toBe('Minimum 1, set with the deposit address.');

      mockPage.active = buildAuthorized({
        destination: { ...destination, minAmount: undefined },
      });
      rerender(<BinanceDepositHome />);
      expect(hint()).toContain('Minimum 0.01');
      expect(hint()).toContain('deposit dust');

      // Listed, and without a deposit dust: only now is there no minimum.
      mockPage.assetSymbol = { symbol: 'USDT' };
      rerender(<BinanceDepositHome />);
      expect(hint()).toBe('No minimum is set for this asset.');
      expect(mockUseSend).toHaveBeenLastCalledWith(
        expect.objectContaining({
          depositDust: undefined,
          isAssetListReady: true,
        }),
      );
      expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
        false,
      );
    });

    describe('destination without a minimum', () => {
      const withoutMinimum = () =>
        buildAuthorized({
          destination: { ...destination, minAmount: undefined },
        });
      const hint = () =>
        screen.getByTestId(BinanceDepositTestIDs.minAmountHint).textContent;

      function expectTransferOff() {
        expect(hint()).not.toContain('No minimum');
        expect(hint()).toContain('minimum deposit amount is unknown');
        expect(hint()).toContain('Reload the asset list');
        const button = getButton(BinanceDepositTestIDs.reviewSendBtn);
        expect(button.disabled).toBe(true);
        fireEvent.click(button);
        expect(mockReviewAndSend).not.toHaveBeenCalled();
        const input: HTMLInputElement = screen.getByTestId(
          BinanceDepositTestIDs.amountInput,
        );
        expect(input.disabled).toBe(true);
        expect(mockUseSend).toHaveBeenLastCalledWith(
          expect.objectContaining({ isAssetListReady: false }),
        );
      }

      it.each<[string, Partial<IMockPageState>]>([
        // Even with what an earlier load left behind for the asset.
        [
          'is still loading',
          { assetsLoading: true, assetSymbol: { symbol: 'USDT' } },
        ],
        ['could not be loaded', { assetsLoadFailed: true }],
        ['does not list the asset of the session', {}],
      ])('keeps the transfer off while the asset list %s', (_name, assets) => {
        renderPage({ active: withoutMinimum(), amount: '5', ...assets });
        expectTransferOff();
      });

      it('turns the transfer on once the asset list is there and has the asset', () => {
        const { rerender } = renderPage({
          active: withoutMinimum(),
          amount: '5',
          assetsLoading: true,
        });
        expectTransferOff();

        // Loaded: the asset is listed and has no deposit dust.
        mockPage.assetsLoading = false;
        mockPage.assetSymbol = { symbol: 'USDT' };
        rerender(<BinanceDepositHome />);
        expect(hint()).toBe('No minimum is set for this asset.');
        expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
          false,
        );
        fireEvent.click(getButton(BinanceDepositTestIDs.reviewSendBtn));
        expect(mockReviewAndSend).toHaveBeenCalledWith('5');

        // A reload that fails takes the list, and the transfer, away again.
        mockReviewAndSend.mockClear();
        mockPage.assetsLoadFailed = true;
        mockPage.assetSymbol = undefined;
        rerender(<BinanceDepositHome />);
        expectTransferOff();
      });

      it('applies the deposit dust of the listed asset', () => {
        renderPage({
          active: withoutMinimum(),
          amount: '5',
          assetSymbol: { symbol: 'USDT', depositDust: '0.99' },
        });
        expect(hint()).toContain('Minimum 0.99');
        expect(hint()).toContain('deposit dust');
        expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
          false,
        );
        expect(mockUseSend).toHaveBeenLastCalledWith(
          expect.objectContaining({
            depositDust: '0.99',
            isAssetListReady: true,
          }),
        );
      });
    });
  });

  describe('session of another server environment', () => {
    it('says so and disables everything that would reach the server', () => {
      const { rerender } = renderPage({
        active: buildSession({
          endpointMismatch: true,
          walletEndpoint: 'https://wallet.onekeytest.com',
        }),
      });

      const alert = screen.getByTestId(
        BinanceDepositTestIDs.endpointMismatchAlert,
      );
      expect(alert.textContent).toContain('another server environment');
      expect(alert.textContent).toContain('https://wallet.onekeytest.com');
      // What becomes of a return that arrives in the meantime: on iOS, which
      // is what the page runs on here, it is picked up again.
      expect(alert.textContent).toContain(
        'A return from Binance that arrives in the meantime is not taken in here.',
      );
      expect(alert.textContent).toContain(
        'On iOS it is handled again when this page is opened after the app is back on that environment.',
      );
      expect(alert.textContent).toContain(
        'If it is not, abandon this session and create a new one.',
      );
      expect(alert.textContent).not.toContain('Android');
      expect(getButton(BinanceDepositTestIDs.openBinanceBtn).disabled).toBe(
        true,
      );
      expect(getButton(BinanceDepositTestIDs.refreshBtn).disabled).toBe(true);
      expect(getButton(BinanceDepositTestIDs.retryCreateBtn).disabled).toBe(
        true,
      );
      // Abandoning is local and stays available.
      expect(getButton(BinanceDepositTestIDs.abandonBtn).disabled).toBe(false);

      // The same session on its own environment.
      mockPage.active = buildSession();
      rerender(<BinanceDepositHome />);
      expect(
        screen.queryByTestId(BinanceDepositTestIDs.endpointMismatchAlert),
      ).toBeNull();
      expect(getButton(BinanceDepositTestIDs.openBinanceBtn).disabled).toBe(
        false,
      );
      expect(getButton(BinanceDepositTestIDs.refreshBtn).disabled).toBe(false);
    });

    it('says on Android that a return that arrived in the meantime is lost', () => {
      jest.replaceProperty(platformEnv, 'isNativeAndroid', true);
      renderPage({
        active: buildSession({
          endpointMismatch: true,
          walletEndpoint: 'https://wallet.onekeytest.com',
        }),
      });

      const alert = screen.getByTestId(
        BinanceDepositTestIDs.endpointMismatchAlert,
      );
      expect(alert.textContent).toContain('another server environment');
      expect(alert.textContent).toContain('https://wallet.onekeytest.com');
      expect(alert.textContent).toContain(
        'A return from Binance that arrives in the meantime is not taken in here.',
      );
      // Switching the environment restarts the process there, so nothing
      // promises that the return is handled again.
      expect(alert.textContent).toContain(
        'On Android, switching the environment restarts the app process, so a return that arrived in the meantime cannot be recovered. If one did arrive, abandon this session and create a new one.',
      );
      expect(alert.textContent).not.toContain('handled again');
      expect(alert.textContent).not.toContain('iOS');
      expect(getButton(BinanceDepositTestIDs.abandonBtn).disabled).toBe(false);
    });

    it('disables the create replay of an unconfirmed session', () => {
      const pending = {
        status: 'LOCAL_PENDING_CREATE' as const,
        sessionId: undefined,
      };
      const { rerender } = renderPage({
        active: buildSession({ ...pending, endpointMismatch: true }),
      });
      expect(getButton(BinanceDepositTestIDs.retryCreateBtn).disabled).toBe(
        true,
      );

      mockPage.active = buildSession(pending);
      rerender(<BinanceDepositHome />);
      expect(getButton(BinanceDepositTestIDs.retryCreateBtn).disabled).toBe(
        false,
      );
    });

    it('disables the transfer and the report retry', () => {
      const { rerender } = renderPage({
        active: buildAuthorized({ endpointMismatch: true }),
        amount: '5',
      });
      expect(getButton(BinanceDepositTestIDs.reviewSendBtn).disabled).toBe(
        true,
      );

      mockPage.active = buildAuthorized({
        endpointMismatch: true,
        report: buildReport(),
      });
      rerender(<BinanceDepositHome />);
      expect(getButton(BinanceDepositTestIDs.retryReportBtn).disabled).toBe(
        true,
      );
      // A pending report still keeps the session from being abandoned.
      expect(getButton(BinanceDepositTestIDs.abandonBtn).disabled).toBe(true);
    });
  });

  describe('report retry', () => {
    it('retries a pending report of the session', () => {
      renderPage({ active: buildAuthorized({ report: buildReport() }) });
      const button = getButton(BinanceDepositTestIDs.retryReportBtn);
      expect(button.disabled).toBe(false);
      fireEvent.click(button);
      expect(mockActions.retryReport).toHaveBeenCalledTimes(1);
    });

    it('offers the retry for a failed report that only ran out of attempts', () => {
      renderPage({
        active: buildAuthorized({
          report: buildReport({
            status: 'FAILED',
            attempts: 20,
            lastErrorCode: 10_000,
          }),
        }),
      });
      const button = getButton(BinanceDepositTestIDs.retryReportBtn);
      expect(button.disabled).toBe(false);
      fireEvent.click(button);
      expect(mockActions.retryReport).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['a report the server refused for good', {}],
      ['a failed report of an abandoned session', { lastErrorCode: 10_000 }],
    ])('keeps the retry off for %s', (_name, reportPatch) => {
      renderPage({
        active: buildAuthorized({
          localClosedReason:
            'lastErrorCode' in reportPatch ? 'abandoned' : undefined,
          report: buildReport({
            status: 'FAILED',
            attempts: 1,
            lastErrorCode: EBinanceDepositErrorCode.ReportConflict,
            ...reportPatch,
          }),
        }),
      });
      const button = getButton(BinanceDepositTestIDs.retryReportBtn);
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(mockActions.retryReport).not.toHaveBeenCalled();
    });

    it('keeps the retry off for a confirmed report', () => {
      renderPage({
        active: buildAuthorized({
          report: buildReport({ status: 'CONFIRMED' }),
        }),
      });
      expect(getButton(BinanceDepositTestIDs.retryReportBtn).disabled).toBe(
        true,
      );
    });
  });
});
