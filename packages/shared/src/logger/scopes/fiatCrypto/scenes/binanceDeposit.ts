// cspell:ignore presign
import { sanitizeBinanceDepositLogDetail } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import type {
  IBinanceDepositBindAction,
  IBinanceDepositBindStepReason,
  IBinanceDepositLinkRejectReason,
  IBinanceDepositLocalReportStatus,
  IBinanceDepositLocalStatus,
  IBinanceDepositLogDetail,
  IBinanceDepositReturnSource,
} from '@onekeyhq/shared/types/exchange';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

// Outcome of one deposit API call. A raw request error is never logged: a
// timed-out request still carries its body, which holds the session key.
// Only its code, name and HTTP status are.
type IBinanceDepositRequestOutcome = {
  ok: boolean;
  code?: number;
  isNetworkError?: boolean;
  errorName?: string;
  httpStatus?: number;
  durationMs?: number;
};

// The native log layer folds consecutive identical lines into `[N repeat]`,
// which would hide polling and retry steps. A per-runtime sequence number
// keeps every line distinct.
let logSequence = 0;

function buildLogPayload(params: IBinanceDepositLogDetail) {
  logSequence += 1;
  return { seq: logSequence, ...sanitizeBinanceDepositLogDetail(params) };
}

// Local-only timeline of the Binance Connect deposit flow, so each step can
// be confirmed from an exported device log.
//
// No method takes the session key, the return nonce, the return URL or the
// Binance link, and no parameter is meant to carry one. `sid` is always a
// masked id (maskBinanceDepositSessionId of the sessionId, or of the localId
// before the server assigned one). Every payload also goes through
// sanitizeBinanceDepositLogDetail as a last line of defense.
export class BinanceDepositScene extends BaseScene {
  @LogToLocal()
  public createStart(params: {
    sid: string;
    attempt: number;
    networkId: string;
    cryptoCurrency: string;
    hasContractAddress: boolean;
    isRetry: boolean;
  }) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public createResult(
    params: IBinanceDepositRequestOutcome & {
      sid: string;
      attempt: number;
      status?: IBinanceDepositLocalStatus;
      hasLink?: boolean;
      linkExpireTime?: number;
    },
  ) {
    return buildLogPayload(params);
  }

  // `stage` separates the bg-side validation from the main-side OS hand-off.
  @LogToLocal()
  public linkOpen(params: {
    sid: string;
    stage: 'prepare' | 'open';
    ok: boolean;
    linkSource?: 'memory' | 'query';
    rejectReason?: IBinanceDepositLinkRejectReason;
    reason?: string;
    linkExpireTime?: number;
  }) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public returnReceived(params: {
    sid: string;
    source: IBinanceDepositReturnSource;
    // The same nonce is already being bound, or was already bound.
    duplicate: boolean;
    otherParamNames?: readonly string[];
  }) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public returnDiscarded(params: {
    // Absent when the return was dropped before a session was matched.
    sid?: string;
    source: IBinanceDepositReturnSource;
    reason: string;
    otherParamNames?: readonly string[];
    // The UI runtime dropped the return before it reached the service.
    byMain?: boolean;
  }) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public bindAttempt(params: {
    sid: string;
    attempt: number;
    bindDeadline?: number;
    linkExpireTime?: number;
  }) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public bindResult(
    params: IBinanceDepositRequestOutcome & {
      sid: string;
      attempt: number;
      action: IBinanceDepositBindAction;
      reason: IBinanceDepositBindStepReason;
      status?: IBinanceDepositLocalStatus;
      hasDestination?: boolean;
      delayMs?: number;
    },
  ) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public queryResult(
    params: IBinanceDepositRequestOutcome & {
      sid: string;
      // What triggered the query, e.g. 'refresh', 'open_link', 'after_bind'.
      trigger: string;
      status?: IBinanceDepositLocalStatus;
      hasLink?: boolean;
      hasDestination?: boolean;
      linkExpireTime?: number;
      bindDeadline?: number;
      reportStatus?: string;
    },
  ) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public presignCheck(
    params: IBinanceDepositRequestOutcome & {
      sid: string;
      status?: IBinanceDepositLocalStatus;
      destinationMatches?: boolean;
      reason?: string;
      // The check that gates the signature itself, as opposed to the one made
      // before the confirmation page opens.
      beforeSend?: boolean;
    },
  ) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public sendResult(params: {
    sid: string;
    result: 'success' | 'fail' | 'cancel' | 'blocked';
    reason?: string;
    // maskBinanceDepositTxHash output, never the full hash.
    txHashPrefix?: string;
  }) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public reportAttempt(params: {
    sid: string;
    attempt: number;
    txHashPrefix: string;
  }) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public reportResult(
    params: IBinanceDepositRequestOutcome & {
      sid: string;
      attempt: number;
      reportStatus: IBinanceDepositLocalReportStatus;
    },
  ) {
    return buildLogPayload(params);
  }

  @LogToLocal()
  public localCleanup(params: {
    sid: string;
    reason: string;
    status?: IBinanceDepositLocalStatus;
    secureRemoved?: boolean;
  }) {
    return buildLogPayload(params);
  }
}
