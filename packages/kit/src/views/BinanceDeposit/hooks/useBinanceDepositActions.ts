import { useCallback, useRef, useState } from 'react';

import { Dialog, Toast } from '@onekeyhq/components';
import { maskBinanceDepositSessionId } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EBinanceDepositErrorCode } from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAssetNetwork,
  IBinanceDepositAssetSymbol,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  getBinanceDepositErrorCode,
  getBinanceDepositErrorText,
} from '../utils';

import type { IBinanceDepositLinkOpenLog } from './useBinanceDepositPageLog';
import type { IBinanceDepositSender } from './useBinanceDepositSender';

export type IBinanceDepositBusyAction =
  | 'createAddress'
  | 'create'
  | 'retryCreate'
  | 'openLink'
  | 'refresh'
  | 'abandon'
  | 'ackSendAttempt'
  | 'retryReport';

// Session actions of the self-test page. Every failure is shown as a fixed
// text chosen by the error code; the caught error is never rendered or
// logged, because for the link step its message can carry the full link.
export function useBinanceDepositActions({
  active,
  network,
  symbol,
  sender,
  createSenderAddress,
  refreshState,
  reloadAssets,
  logLinkOpen,
}: {
  active?: IBinanceDepositSessionSnapshot;
  network?: IBinanceDepositAssetNetwork;
  symbol?: IBinanceDepositAssetSymbol;
  sender?: IBinanceDepositSender;
  createSenderAddress: () => Promise<IBinanceDepositSender | undefined>;
  refreshState: () => Promise<unknown>;
  reloadAssets: () => Promise<void>;
  logLinkOpen: (params: IBinanceDepositLinkOpenLog) => void;
}) {
  const [busyAction, setBusyAction] = useState<
    IBinanceDepositBusyAction | undefined
  >();
  const busyRef = useRef(false);

  const runExclusive = useCallback(
    async ({
      action,
      failureTitle,
      task,
      onErrorCode,
    }: {
      action: IBinanceDepositBusyAction;
      failureTitle: string;
      task: () => Promise<void>;
      onErrorCode?: (code: number | undefined) => void;
    }) => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      setBusyAction(action);
      try {
        await task();
      } catch (error) {
        Toast.error({
          title: failureTitle,
          message: getBinanceDepositErrorText(error),
        });
        onErrorCode?.(getBinanceDepositErrorCode(error));
      } finally {
        busyRef.current = false;
        setBusyAction(undefined);
        await refreshState();
      }
    },
    [refreshState],
  );

  const createAddress = useCallback(
    () =>
      runExclusive({
        action: 'createAddress',
        failureTitle: 'Create address failed',
        task: async () => {
          const created = await createSenderAddress();
          if (!created) {
            Toast.message({
              title: 'No address was created for this network',
            });
          }
        },
      }),
    [createSenderAddress, runExclusive],
  );

  const createSession = useCallback(
    () =>
      runExclusive({
        action: 'create',
        failureTitle: 'Create session failed',
        task: async () => {
          if (!network || !symbol) {
            Toast.error({ title: 'Select a network and an asset first' });
            return;
          }
          const { networkId } = network;
          // The sender is fixed for the whole session, so it has to be an
          // address resolved on exactly this network.
          if (!sender || sender.networkId !== networkId) {
            Toast.error({
              title: 'Sender address unavailable',
              message:
                'The selected account has no address on this network, so no session was created.',
            });
            return;
          }
          await backgroundApiProxy.serviceBinanceDeposit.createSession({
            networkId,
            cryptoCurrency: symbol.symbol,
            contractAddress: symbol.contractAddress,
            accountId: sender.accountId,
            walletId: sender.walletId,
            indexedAccountId: sender.indexedAccountId,
            senderAddress: sender.address,
          });
          Toast.success({
            title: 'Session created',
            message: 'Open Binance to authorize the deposit.',
          });
        },
        onErrorCode: (code) => {
          // The background service already dropped its cached asset list.
          if (code === EBinanceDepositErrorCode.CapabilityStale) {
            void reloadAssets();
          }
        },
      }),
    [network, reloadAssets, runExclusive, sender, symbol],
  );

  const retryCreate = useCallback(async () => {
    if (!active) {
      return;
    }
    const { localId } = active;
    await runExclusive({
      action: 'retryCreate',
      failureTitle: 'Retry create failed',
      task: async () => {
        await backgroundApiProxy.serviceBinanceDeposit.retryCreate(localId);
        Toast.success({ title: 'Session created' });
      },
    });
  }, [active, runExclusive]);

  const openBinance = useCallback(async () => {
    if (!active) {
      return;
    }
    const { localId } = active;
    const sid = maskBinanceDepositSessionId(active.sessionId ?? localId);
    await runExclusive({
      action: 'openLink',
      failureTitle: 'Open Binance failed',
      task: async () => {
        // The link was validated in the background and exists only in this
        // local variable; it is not stored, logged or put into navigation.
        const { link } =
          await backgroundApiProxy.serviceBinanceDeposit.prepareOpenLink(
            localId,
          );
        let opened = false;
        try {
          // The system has to open it: the in-app browser would not hand a
          // universal link over to the Binance app.
          await openUrlUtils.linkingOpenURL(link);
          opened = true;
        } catch {
          opened = false;
        }
        logLinkOpen({ sid, stage: 'open', ok: opened });
        if (!opened) {
          Toast.error({
            title: 'Unable to open Binance',
            message: 'The system could not open the authorization link.',
          });
        }
      },
    });
  }, [active, logLinkOpen, runExclusive]);

  const refreshSession = useCallback(async () => {
    if (!active) {
      return;
    }
    const { localId } = active;
    await runExclusive({
      action: 'refresh',
      failureTitle: 'Refresh failed',
      task: async () => {
        await backgroundApiProxy.serviceBinanceDeposit.refreshSession(localId);
      },
    });
  }, [active, runExclusive]);

  const abandonSession = useCallback(() => {
    if (!active) {
      return;
    }
    const { localId } = active;
    Dialog.show({
      title: 'Abandon this session?',
      description:
        'This only clears the session on this device; the server has no cancel call. An unfinished session keeps its server slot until the Binance link expires plus about 2 minutes, and creating a session for the same asset before that returns code 14006. A released deposit address will no longer be shown here.',
      tone: 'destructive',
      onConfirmText: 'Abandon',
      onConfirm: async () => {
        await runExclusive({
          action: 'abandon',
          failureTitle: 'Abandon failed',
          task: () =>
            backgroundApiProxy.serviceBinanceDeposit.abandonSession(localId),
        });
      },
    });
  }, [active, runExclusive]);

  // Lifts the hold a recorded signing attempt puts on sending again. It is
  // the user's statement that the earlier transfer never went out, so it is
  // only made from a confirmation dialog.
  const acknowledgeSendAttempt = useCallback(() => {
    if (!active) {
      return;
    }
    const { localId } = active;
    Dialog.show({
      title: 'The previous transfer was not sent?',
      description:
        'Confirm only after checking the history of the sender account. If the earlier transfer is on chain, sending again deposits a second time, and this session can report a single transaction only.',
      tone: 'destructive',
      onConfirmText: 'It was not sent',
      onConfirm: async () => {
        await runExclusive({
          action: 'ackSendAttempt',
          failureTitle: 'Could not lift the send hold',
          task: async () => {
            await backgroundApiProxy.serviceBinanceDeposit.acknowledgeSendAttempt(
              localId,
            );
          },
        });
      },
    });
  }, [active, runExclusive]);

  // Sends a pending report once more, or re-arms one that ran out of
  // automatic attempts. The outcome is read back from the polled state.
  const retryReport = useCallback(async () => {
    if (!active) {
      return;
    }
    const { localId } = active;
    await runExclusive({
      action: 'retryReport',
      failureTitle: 'Retry report failed',
      task: async () => {
        await backgroundApiProxy.serviceBinanceDeposit.retryReport(localId);
      },
    });
  }, [active, runExclusive]);

  return {
    busyAction,
    createAddress,
    createSession,
    retryCreate,
    openBinance,
    refreshSession,
    abandonSession,
    acknowledgeSendAttempt,
    retryReport,
  };
}
