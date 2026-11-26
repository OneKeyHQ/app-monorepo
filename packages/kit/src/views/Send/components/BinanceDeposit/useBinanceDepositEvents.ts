import { useEffect, useRef } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getBinanceDepositEventContext } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/binanceDeposit';
import type {
  IBinanceDepositPhase,
  IBinanceDepositSnapshot,
} from '@onekeyhq/shared/types/binanceDeposit';

// Each state a session reaches is reported once. A session that already
// has its address when it first shows here was picked up again.
export function useBinanceDepositEvents(
  snapshot: IBinanceDepositSnapshot | undefined,
) {
  const reportedRef = useRef<{
    localId?: string;
    phase?: IBinanceDepositPhase;
    isNotReturned?: boolean;
  }>({});
  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const last = reportedRef.current;
    const isSameSession = last.localId === snapshot.localId;
    // Confirmed in Binance while no return has reached this phone; once one
    // has, the session is confirming whatever status the server reports.
    const isNotReturned =
      snapshot.phase === 'awaiting' &&
      snapshot.status === EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND;
    reportedRef.current = {
      localId: snapshot.localId,
      phase: snapshot.phase,
      isNotReturned,
    };
    const context = getBinanceDepositEventContext(snapshot);
    if (isNotReturned && !(isSameSession && last.isNotReturned)) {
      defaultLogger.transaction.send.binanceDepositNotReturned(context);
    }
    if (isSameSession && last.phase === snapshot.phase) {
      return;
    }
    if (snapshot.phase === 'authorized') {
      defaultLogger.transaction.send.binanceDepositAddressReceived({
        ...context,
        isResumed: !isSameSession,
      });
    } else if (
      snapshot.phase === 'failed' ||
      snapshot.phase === 'create_failed'
    ) {
      defaultLogger.transaction.send.binanceDepositFail({
        ...context,
        reason: snapshot.failReason ?? 'create_failed',
      });
    }
  }, [snapshot]);
}
