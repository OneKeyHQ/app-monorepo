/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/exchange';
import type { IBinanceDepositSessionSnapshot } from '@onekeyhq/shared/types/exchange';

import { useBinanceDepositSend } from './useBinanceDepositSend';

import type { IBinanceDepositSendFlowParams } from '../sendFlow';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('../../../hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: jest.fn(() => ({ navigationToTxConfirm: jest.fn() })),
}));

jest.mock('../sendFlow', () => ({
  runBinanceDepositSendFlow: jest.fn(),
}));

const mockedRunFlow = (
  jest.requireMock('../sendFlow') as {
    runBinanceDepositSendFlow: jest.Mock<
      Promise<void>,
      [IBinanceDepositSendFlowParams]
    >;
  }
).runBinanceDepositSendFlow;

function buildSession(
  patch: Partial<IBinanceDepositSessionSnapshot> = {},
): IBinanceDepositSessionSnapshot {
  return {
    localId: 'local-id-0001',
    sessionId: 'f'.repeat(64),
    accountId: 'account-id',
    senderAddress: '0x1111111111111111111111111111111111111111',
    networkId: 'evm--56',
    cryptoCurrency: 'USDT',
    status: EBinanceDepositSessionStatus.AUTHORIZED,
    createdAt: 1,
    updatedAt: 1,
    awaitingReturn: false,
    hasPendingNonce: false,
    bindInFlight: false,
    sessionIdMasked: 'ffffffff…',
    endpointMismatch: false,
    ...patch,
  };
}

type IHookProps = Parameters<typeof useBinanceDepositSend>[0];

const refreshState = jest.fn(async () => undefined);
const logSendResult = jest.fn();

function buildProps(patch: Partial<IHookProps> = {}): IHookProps {
  return {
    session: buildSession(),
    requiresAddressTag: false,
    depositDust: undefined,
    isAssetListReady: true,
    isSignOnlyEnabled: false,
    refreshState,
    logSendResult,
    ...patch,
  };
}

function setup(patch: Partial<IHookProps> = {}) {
  return renderHook((props: IHookProps) => useBinanceDepositSend(props), {
    initialProps: buildProps(patch),
  });
}

describe('useBinanceDepositSend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRunFlow.mockResolvedValue(undefined);
  });

  describe('amount input', () => {
    it('starts empty and keeps what was typed while the session stays the same', () => {
      const { result, rerender } = setup();
      expect(result.current.amount).toBe('');

      act(() => {
        result.current.setAmount('20');
      });
      expect(result.current.amount).toBe('20');

      // Every poll delivers a new snapshot object of the same session.
      rerender(buildProps({ session: buildSession({ updatedAt: 2 }) }));
      expect(result.current.amount).toBe('20');
    });

    it('is empty again for another session, which may be for another asset', () => {
      const { result, rerender } = setup();
      act(() => {
        result.current.setAmount('20');
      });

      rerender(
        buildProps({
          session: buildSession({
            localId: 'local-id-0002',
            cryptoCurrency: 'BNB',
          }),
        }),
      );
      expect(result.current.amount).toBe('');

      act(() => {
        result.current.setAmount('0.5');
      });
      expect(result.current.amount).toBe('0.5');
    });

    it('does not bring the amount back when the earlier session is shown again', () => {
      const first = buildSession();
      const { result, rerender } = setup({ session: first });
      act(() => {
        result.current.setAmount('20');
      });
      rerender(
        buildProps({ session: buildSession({ localId: 'local-id-0002' }) }),
      );
      act(() => {
        result.current.setAmount('7');
      });

      rerender(buildProps({ session: first }));
      expect(result.current.amount).toBe('');
    });

    it('is empty once there is no session, and for the one created next', () => {
      const { result, rerender } = setup();
      act(() => {
        result.current.setAmount('20');
      });

      rerender(buildProps({ session: undefined }));
      expect(result.current.amount).toBe('');

      rerender(
        buildProps({ session: buildSession({ localId: 'local-id-0002' }) }),
      );
      expect(result.current.amount).toBe('');
    });
  });

  describe('reviewAndSend', () => {
    it('hands the amount and the asset list values of the session to the flow', async () => {
      const session = buildSession();
      const { result } = setup({
        session,
        requiresAddressTag: true,
        depositDust: '0.01',
        isAssetListReady: true,
      });

      await act(async () => {
        await result.current.reviewAndSend('5');
      });

      expect(mockedRunFlow).toHaveBeenCalledTimes(1);
      expect(mockedRunFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          session,
          amountInput: '5',
          requiresAddressTag: true,
          depositDust: '0.01',
          isAssetListReady: true,
          isSignOnlyEnabled: false,
          hasSentLocally: false,
        }),
      );
    });

    it('passes no deposit dust while the asset list does not carry the asset, and says that the list is not ready', async () => {
      const { result } = setup({
        depositDust: undefined,
        isAssetListReady: false,
      });
      await act(async () => {
        await result.current.reviewAndSend('5');
      });
      expect(mockedRunFlow.mock.calls[0][0].depositDust).toBeUndefined();
      expect(mockedRunFlow.mock.calls[0][0].isAssetListReady).toBe(false);
    });

    it('hands the flow the state of the asset list as it is when the button is pressed', async () => {
      const { result, rerender } = setup({ isAssetListReady: false });
      // The list finished loading after the page was first rendered.
      rerender(buildProps({ isAssetListReady: true }));

      await act(async () => {
        await result.current.reviewAndSend('5');
      });
      expect(mockedRunFlow).toHaveBeenCalledTimes(1);
      expect(mockedRunFlow.mock.calls[0][0].isAssetListReady).toBe(true);
    });

    it('does nothing without a session', async () => {
      const { result } = setup({ session: undefined });
      await act(async () => {
        await result.current.reviewAndSend('5');
      });
      expect(mockedRunFlow).not.toHaveBeenCalled();
    });

    it('remembers a submit the flow reported, per session', async () => {
      mockedRunFlow.mockImplementation(async (params) => {
        params.onSent(params.session.localId);
      });
      const { result, rerender } = setup();
      expect(result.current.hasSentLocally).toBe(false);

      await act(async () => {
        await result.current.reviewAndSend('5');
      });
      expect(result.current.hasSentLocally).toBe(true);

      rerender(
        buildProps({ session: buildSession({ localId: 'local-id-0002' }) }),
      );
      expect(result.current.hasSentLocally).toBe(false);
    });
  });
});
