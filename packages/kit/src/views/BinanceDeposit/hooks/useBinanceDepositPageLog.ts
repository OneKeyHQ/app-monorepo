import { useCallback, useState } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { BinanceDepositScene } from '@onekeyhq/shared/src/logger/scopes/fiatCrypto/scenes/binanceDeposit';
import { sanitizeBinanceDepositLogDetail } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import type {
  IBinanceDepositDebugEvent,
  IBinanceDepositLogDetail,
} from '@onekeyhq/shared/types/exchange';

import type { IBinanceDepositSendResultLog } from '../sendFlow';

const MAX_PAGE_EVENTS = 50;

export type IBinanceDepositLinkOpenLog = Parameters<
  BinanceDepositScene['linkOpen']
>[0];

// Steps that happen in the UI runtime (handing the link to the OS, the
// outcome of the confirm page) are written to the same local log as the
// background steps, and kept in page memory so the event list shows them.
// The detail goes through the same sanitizer as the background events.
export function useBinanceDepositPageLog() {
  const [pageEvents, setPageEvents] = useState<IBinanceDepositDebugEvent[]>([]);

  const pushPageEvent = useCallback(
    (step: string, detail: IBinanceDepositLogDetail) => {
      const event: IBinanceDepositDebugEvent = {
        ts: Date.now(),
        step,
        detail: sanitizeBinanceDepositLogDetail(detail),
      };
      setPageEvents((current) => [...current, event].slice(-MAX_PAGE_EVENTS));
    },
    [],
  );

  const logLinkOpen = useCallback(
    (params: IBinanceDepositLinkOpenLog) => {
      defaultLogger.fiatCrypto.binanceDeposit.linkOpen(params);
      pushPageEvent('linkOpen', params);
    },
    [pushPageEvent],
  );

  const logSendResult = useCallback(
    (params: IBinanceDepositSendResultLog) => {
      defaultLogger.fiatCrypto.binanceDeposit.sendResult(params);
      pushPageEvent('sendResult', params);
    },
    [pushPageEvent],
  );

  return { pageEvents, logLinkOpen, logSendResult };
}
