/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EBinanceDepositLocalErrorCode } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAssetNetwork,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';

import { useBinanceDepositActions } from './useBinanceDepositActions';

import type { IBinanceDepositSender } from './useBinanceDepositSender';

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: jest.fn() },
  Toast: { error: jest.fn(), success: jest.fn(), message: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    linkingOpenURL: jest.fn(),
    openUrlExternal: jest.fn(),
    openUrlInApp: jest.fn(),
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBinanceDeposit: {
      createSession: jest.fn(),
      retryCreate: jest.fn(),
      prepareOpenLink: jest.fn(),
      refreshSession: jest.fn(),
      abandonSession: jest.fn(),
      acknowledgeSendAttempt: jest.fn(),
      retryReport: jest.fn(),
      retryPendingReports: jest.fn(),
    },
  },
}));

const componentsMock = jest.requireMock('@onekeyhq/components') as {
  Dialog: { show: jest.Mock };
  Toast: { error: jest.Mock; success: jest.Mock; message: jest.Mock };
};
const openUrlMock = (
  jest.requireMock('@onekeyhq/shared/src/utils/openUrlUtils') as {
    default: {
      linkingOpenURL: jest.Mock;
      openUrlExternal: jest.Mock;
      openUrlInApp: jest.Mock;
    };
  }
).default;
const service = (
  jest.requireMock('../../../background/instance/backgroundApiProxy') as {
    default: {
      serviceBinanceDeposit: {
        createSession: jest.Mock;
        retryCreate: jest.Mock;
        prepareOpenLink: jest.Mock;
        refreshSession: jest.Mock;
        abandonSession: jest.Mock;
        acknowledgeSendAttempt: jest.Mock;
        retryReport: jest.Mock;
        retryPendingReports: jest.Mock;
      };
    };
  }
).default.serviceBinanceDeposit;

const LINK = 'https://app.binance.com/en/connect?token=link-secret-value';
const NETWORK: IBinanceDepositAssetNetwork = {
  networkId: 'evm--56',
  symbols: [
    {
      symbol: 'USDT',
      contractAddress: '0x55d398326f99059fF775485246999027B3197955',
    },
  ],
};
const SENDER: IBinanceDepositSender = {
  networkId: 'evm--56',
  accountId: 'account-id',
  address: '0x1111111111111111111111111111111111111111',
  walletId: 'hd-1',
  indexedAccountId: 'hd-1--0',
};

function buildSession(
  patch: Partial<IBinanceDepositSessionSnapshot> = {},
): IBinanceDepositSessionSnapshot {
  return {
    localId: 'local-id-0001',
    sessionId: 'e'.repeat(64),
    accountId: 'account-id',
    senderAddress: SENDER.address,
    networkId: 'evm--56',
    cryptoCurrency: 'USDT',
    status: EBinanceDepositSessionStatus.INIT,
    createdAt: 1,
    updatedAt: 1,
    awaitingReturn: false,
    hasPendingNonce: false,
    bindInFlight: false,
    sessionIdMasked: 'eeeeeeee…',
    endpointMismatch: false,
    ...patch,
  };
}

type IHookProps = Parameters<typeof useBinanceDepositActions>[0];

function setup(overrides: Partial<IHookProps> = {}) {
  const refreshState = jest.fn(async () => undefined);
  const reloadAssets = jest.fn(async () => undefined);
  const logLinkOpen = jest.fn();
  const createSenderAddress = jest.fn(async () => undefined);
  const props: IHookProps = {
    active: buildSession(),
    network: NETWORK,
    symbol: NETWORK.symbols[0],
    sender: SENDER,
    createSenderAddress,
    refreshState,
    reloadAssets,
    logLinkOpen,
    ...overrides,
  };
  const hook = renderHook(() => useBinanceDepositActions(props));
  return { ...hook, refreshState, reloadAssets, logLinkOpen };
}

describe('useBinanceDepositActions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    service.createSession.mockResolvedValue(buildSession());
    service.retryCreate.mockResolvedValue(buildSession());
    service.prepareOpenLink.mockResolvedValue({ link: LINK });
    service.refreshSession.mockResolvedValue(buildSession());
    service.abandonSession.mockResolvedValue(undefined);
    service.acknowledgeSendAttempt.mockResolvedValue(buildSession());
    service.retryReport.mockResolvedValue(buildSession());
    service.retryPendingReports.mockResolvedValue(undefined);
    openUrlMock.linkingOpenURL.mockResolvedValue(true);
  });

  describe('openBinance', () => {
    it('hands the validated link to the system, not to the in-app browser', async () => {
      const { result, logLinkOpen, refreshState } = setup();
      await act(async () => {
        await result.current.openBinance();
      });

      expect(service.prepareOpenLink).toHaveBeenCalledWith('local-id-0001');
      expect(openUrlMock.linkingOpenURL).toHaveBeenCalledTimes(1);
      expect(openUrlMock.linkingOpenURL).toHaveBeenCalledWith(LINK);
      expect(openUrlMock.openUrlExternal).not.toHaveBeenCalled();
      expect(openUrlMock.openUrlInApp).not.toHaveBeenCalled();
      expect(logLinkOpen).toHaveBeenCalledWith({
        sid: 'eeeeeeee…',
        stage: 'open',
        ok: true,
      });
      expect(componentsMock.Toast.error).not.toHaveBeenCalled();
      expect(refreshState).toHaveBeenCalled();
    });

    it('shows a fixed text when the system cannot open the link', async () => {
      // The failure of the OS call describes the URL it was given.
      openUrlMock.linkingOpenURL.mockRejectedValue({
        message: `Could not open URL '${LINK}'`,
      });
      const { result, logLinkOpen } = setup();
      await act(async () => {
        await result.current.openBinance();
      });

      expect(logLinkOpen).toHaveBeenCalledWith({
        sid: 'eeeeeeee…',
        stage: 'open',
        ok: false,
      });
      expect(componentsMock.Toast.error).toHaveBeenCalledTimes(1);
      expect(
        JSON.stringify(componentsMock.Toast.error.mock.calls),
      ).not.toContain('link-secret-value');
      expect(JSON.stringify(logLinkOpen.mock.calls)).not.toContain(
        'link-secret-value',
      );
    });

    it('does not open anything when the link is rejected', async () => {
      service.prepareOpenLink.mockRejectedValue({
        code: EBinanceDepositLocalErrorCode.LinkRejected,
        message: `rejected ${LINK}`,
      });
      const { result, logLinkOpen } = setup();
      await act(async () => {
        await result.current.openBinance();
      });

      expect(openUrlMock.linkingOpenURL).not.toHaveBeenCalled();
      expect(logLinkOpen).not.toHaveBeenCalled();
      expect(componentsMock.Toast.error).toHaveBeenCalledWith({
        title: 'Open Binance failed',
        message: expect.stringContaining('(code 914007)') as string,
      });
      expect(
        JSON.stringify(componentsMock.Toast.error.mock.calls),
      ).not.toContain('link-secret-value');
    });
  });

  describe('createSession', () => {
    it('creates a session for the selected asset and the resolved sender', async () => {
      const { result } = setup({ active: undefined });
      await act(async () => {
        await result.current.createSession();
      });
      expect(service.createSession).toHaveBeenCalledWith({
        networkId: 'evm--56',
        cryptoCurrency: 'USDT',
        contractAddress: '0x55d398326f99059fF775485246999027B3197955',
        accountId: 'account-id',
        walletId: 'hd-1',
        indexedAccountId: 'hd-1--0',
        senderAddress: SENDER.address,
      });
      expect(componentsMock.Toast.success).toHaveBeenCalledTimes(1);
    });

    it('refuses a sender that was resolved on another network', async () => {
      const { result } = setup({
        active: undefined,
        sender: { ...SENDER, networkId: 'evm--1' },
      });
      await act(async () => {
        await result.current.createSession();
      });
      expect(service.createSession).not.toHaveBeenCalled();
      expect(componentsMock.Toast.error).toHaveBeenCalledTimes(1);
    });

    it('refuses to create without a sender', async () => {
      const { result } = setup({ active: undefined, sender: undefined });
      await act(async () => {
        await result.current.createSession();
      });
      expect(service.createSession).not.toHaveBeenCalled();
    });

    it('maps the error code to a fixed text and reloads a stale asset list', async () => {
      service.createSession.mockRejectedValue({
        code: EBinanceDepositErrorCode.CapabilityStale,
        message: 'server text that must not be shown',
      });
      const { result, reloadAssets, refreshState } = setup({
        active: undefined,
      });
      await act(async () => {
        await result.current.createSession();
      });
      expect(componentsMock.Toast.error).toHaveBeenCalledWith({
        title: 'Create session failed',
        message: expect.stringContaining('(code 14003)') as string,
      });
      expect(
        JSON.stringify(componentsMock.Toast.error.mock.calls),
      ).not.toContain('server text');
      expect(reloadAssets).toHaveBeenCalledTimes(1);
      // The page reads the retryable record back from the polled state.
      expect(refreshState).toHaveBeenCalled();
    });

    it('does not reload the asset list for other errors', async () => {
      service.createSession.mockRejectedValue({
        code: EBinanceDepositErrorCode.RateLimited,
      });
      const { result, reloadAssets } = setup({ active: undefined });
      await act(async () => {
        await result.current.createSession();
      });
      expect(reloadAssets).not.toHaveBeenCalled();
    });
  });

  describe('other actions', () => {
    it('replays create, refreshes and retries the report of the active session', async () => {
      const { result, refreshState } = setup();
      await act(async () => {
        await result.current.retryCreate();
      });
      await act(async () => {
        await result.current.refreshSession();
      });
      refreshState.mockClear();
      await act(async () => {
        await result.current.retryReport();
      });
      expect(service.retryCreate).toHaveBeenCalledWith('local-id-0001');
      expect(service.refreshSession).toHaveBeenCalledWith('local-id-0001');
      // The manual retry is the per-session call, which can also re-arm a
      // report that ran out of automatic attempts; the sweep over every
      // pending report cannot.
      expect(service.retryReport).toHaveBeenCalledTimes(1);
      expect(service.retryReport).toHaveBeenCalledWith('local-id-0001');
      expect(service.retryPendingReports).not.toHaveBeenCalled();
      // Its outcome is read back from the polled state.
      expect(refreshState).toHaveBeenCalled();
      expect(componentsMock.Toast.error).not.toHaveBeenCalled();
    });

    it('shows a fixed text when the report retry call itself fails', async () => {
      service.retryReport.mockRejectedValue({
        code: EBinanceDepositLocalErrorCode.SessionNotFound,
        message: 'not shown',
      });
      const { result } = setup();
      await act(async () => {
        await result.current.retryReport();
      });
      expect(componentsMock.Toast.error).toHaveBeenCalledWith({
        title: 'Retry report failed',
        message: expect.stringContaining('(code 914004)') as string,
      });
      expect(
        JSON.stringify(componentsMock.Toast.error.mock.calls),
      ).not.toContain('not shown');
    });

    it('lifts the send hold only after the confirmation dialog', async () => {
      const { result, refreshState } = setup({
        active: buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          sendAttemptedAt: 1_700_000_100_000,
        }),
      });
      act(() => {
        result.current.acknowledgeSendAttempt();
      });
      // Pressing the button alone changes nothing.
      expect(service.acknowledgeSendAttempt).not.toHaveBeenCalled();
      expect(componentsMock.Dialog.show).toHaveBeenCalledTimes(1);

      const dialogProps = componentsMock.Dialog.show.mock.calls[0][0] as {
        description: string;
        onConfirm: () => Promise<void>;
      };
      expect(dialogProps.description).toContain('history');
      await act(async () => {
        await dialogProps.onConfirm();
      });
      expect(service.acknowledgeSendAttempt).toHaveBeenCalledTimes(1);
      expect(service.acknowledgeSendAttempt).toHaveBeenCalledWith(
        'local-id-0001',
      );
      expect(refreshState).toHaveBeenCalled();
    });

    it('shows a fixed text when the service refuses to lift the hold yet', async () => {
      // The page only offers the confirmation after the wait, on its own
      // clock; the service decides, and may still say that it is too early.
      service.acknowledgeSendAttempt.mockRejectedValue({
        code: EBinanceDepositLocalErrorCode.SendAttemptAckTooEarly,
        message: 'not shown',
      });
      const { result, refreshState } = setup({
        active: buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          sendAttemptedAt: 1_700_000_100_000,
        }),
      });
      act(() => {
        result.current.acknowledgeSendAttempt();
      });
      const dialogProps = componentsMock.Dialog.show.mock.calls[0][0] as {
        onConfirm: () => Promise<void>;
      };
      await act(async () => {
        await dialogProps.onConfirm();
      });

      expect(service.acknowledgeSendAttempt).toHaveBeenCalledTimes(1);
      expect(componentsMock.Toast.error).toHaveBeenCalledTimes(1);
      expect(componentsMock.Toast.error).toHaveBeenCalledWith({
        title: 'Could not lift the send hold',
        message:
          'Signing and broadcasting of the earlier transfer may still be in progress. Wait, then check the account history before confirming that it was not sent. (code 914015)',
      });
      expect(
        JSON.stringify(componentsMock.Toast.error.mock.calls),
      ).not.toContain('not shown');
      // The hold is read back from the polled state, unchanged.
      expect(refreshState).toHaveBeenCalled();
      expect(result.current.busyAction).toBeUndefined();
    });

    it('abandons only after the confirmation dialog', async () => {
      const { result } = setup();
      act(() => {
        result.current.abandonSession();
      });
      expect(service.abandonSession).not.toHaveBeenCalled();
      expect(componentsMock.Dialog.show).toHaveBeenCalledTimes(1);

      const dialogProps = componentsMock.Dialog.show.mock.calls[0][0] as {
        onConfirm: () => Promise<void>;
      };
      await act(async () => {
        await dialogProps.onConfirm();
      });
      expect(service.abandonSession).toHaveBeenCalledWith('local-id-0001');
    });

    it('runs one action at a time', async () => {
      let releaseRefresh: (() => void) | undefined;
      service.refreshSession.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseRefresh = resolve;
          }),
      );
      const { result } = setup();

      let pending: Promise<void> | undefined;
      act(() => {
        pending = result.current.refreshSession();
      });
      expect(result.current.busyAction).toBe('refresh');

      await act(async () => {
        await result.current.openBinance();
      });
      expect(service.prepareOpenLink).not.toHaveBeenCalled();

      await act(async () => {
        releaseRefresh?.();
        await pending;
      });
      expect(result.current.busyAction).toBeUndefined();
    });

    it('does nothing without an active session', async () => {
      const { result } = setup({ active: undefined });
      await act(async () => {
        await result.current.openBinance();
        await result.current.refreshSession();
        await result.current.retryCreate();
        await result.current.retryReport();
        result.current.abandonSession();
        result.current.acknowledgeSendAttempt();
      });
      expect(service.prepareOpenLink).not.toHaveBeenCalled();
      expect(service.refreshSession).not.toHaveBeenCalled();
      expect(service.retryCreate).not.toHaveBeenCalled();
      expect(service.retryReport).not.toHaveBeenCalled();
      expect(service.retryPendingReports).not.toHaveBeenCalled();
      expect(service.acknowledgeSendAttempt).not.toHaveBeenCalled();
      expect(componentsMock.Dialog.show).not.toHaveBeenCalled();
    });
  });
});
