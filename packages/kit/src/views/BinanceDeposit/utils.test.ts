import {
  BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS,
  EBinanceDepositLocalErrorCode,
} from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositDebugEvent,
  IBinanceDepositSessionSnapshot,
} from '@onekeyhq/shared/types/exchange';

import {
  describeBinanceDepositAmountFloor,
  formatBinanceDepositClockTime,
  formatBinanceDepositCode,
  formatBinanceDepositCountdown,
  formatBinanceDepositDateTime,
  formatBinanceDepositEventDetail,
  getBinanceDepositAddressRejectText,
  getBinanceDepositAmountFloor,
  getBinanceDepositAmountRejectText,
  getBinanceDepositErrorCode,
  getBinanceDepositErrorText,
  getBinanceDepositNextStepHint,
  getBinanceDepositReportBadgeType,
  getBinanceDepositSendAttemptAckWaitSeconds,
  getBinanceDepositSessionFlags,
  getBinanceDepositStatusBadgeType,
  getBinanceDepositStatusLabel,
  isSameBinanceDepositAddress,
  isSameBinanceDepositEventList,
  mergeBinanceDepositEvents,
  normalizeBinanceDepositTxHash,
  validateBinanceDepositAmount,
} from './utils';

const destination: IBinanceDepositAuthorizedDestination = {
  networkId: 'evm--56',
  binanceNetwork: 'BSC',
  cryptoCurrency: 'USDT',
  contractAddress: '0x55d398326f99059fF775485246999027B3197955',
  minAmount: '0.01',
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

describe('getBinanceDepositErrorCode / getBinanceDepositErrorText', () => {
  it('reads a numeric code from an Error or a plain object', () => {
    expect(getBinanceDepositErrorCode({ code: 14_006 })).toBe(14_006);
    expect(
      getBinanceDepositErrorCode(Object.assign(new Error('x'), { code: 1 })),
    ).toBe(1);
  });

  it('ignores anything that is not a finite number', () => {
    expect(getBinanceDepositErrorCode(undefined)).toBeUndefined();
    expect(getBinanceDepositErrorCode(null)).toBeUndefined();
    expect(getBinanceDepositErrorCode('14006')).toBeUndefined();
    expect(getBinanceDepositErrorCode({ code: '14006' })).toBeUndefined();
    expect(getBinanceDepositErrorCode({ code: Number.NaN })).toBeUndefined();
  });

  it('maps server and local codes to a fixed text with the code', () => {
    expect(
      getBinanceDepositErrorText({
        code: EBinanceDepositErrorCode.RateLimited,
      }),
    ).toContain('(code 14006)');
    expect(
      getBinanceDepositErrorText({
        code: EBinanceDepositLocalErrorCode.LinkRejected,
      }),
    ).toContain('(code 914007)');
  });

  it('has a text for a session of another server environment', () => {
    const text = getBinanceDepositErrorText({
      code: EBinanceDepositLocalErrorCode.EndpointMismatch,
    });
    expect(text).toContain('different server environment');
    expect(text).toContain('(code 914012)');
  });

  it('points at the account history when an earlier transfer is unresolved', () => {
    const text = getBinanceDepositErrorText({
      code: EBinanceDepositLocalErrorCode.SendAttemptUnresolved,
    });
    expect(text).toContain('may already have been sent');
    expect(text).toContain('account history');
    expect(text).not.toContain('re-verified');
    expect(text).toContain('(code 914013)');
  });

  it('tells to wait and check the history when the hold is lifted too early', () => {
    const text = getBinanceDepositErrorText({
      code: EBinanceDepositLocalErrorCode.SendAttemptAckTooEarly,
    });
    expect(text).toContain('may still be in progress');
    expect(text).toContain('Wait');
    expect(text).toContain('account history');
    expect(text).toContain('(code 914015)');
  });

  it('never returns the message of the error', () => {
    const secret = 'https://app.binance.com/en/connect?token=secret';
    const text = getBinanceDepositErrorText(
      Object.assign(new Error(secret), {
        code: EBinanceDepositLocalErrorCode.LinkRejected,
      }),
    );
    expect(text).not.toContain(secret);
    expect(getBinanceDepositErrorText(new Error(secret))).toBe(
      'Binance deposit request failed.',
    );
    expect(getBinanceDepositErrorText({ code: 424_242, message: secret })).toBe(
      'Binance deposit request failed.',
    );
  });
});

describe('formatBinanceDepositCode', () => {
  it('labels known codes and passes unknown ones through', () => {
    expect(formatBinanceDepositCode(undefined)).toBe('-');
    expect(formatBinanceDepositCode(0)).toBe('0 (ok)');
    expect(formatBinanceDepositCode(14_007)).toBe(
      '14007 (bind proof rejected)',
    );
    expect(formatBinanceDepositCode(12_345)).toBe('12345');
    // The local code a report carries when its session key could not be read.
    expect(
      formatBinanceDepositCode(
        EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
      ),
    ).toBe('914014 (session key unreadable)');
  });
});

describe('getBinanceDepositSessionFlags', () => {
  it('allows only create when there is no session', () => {
    const flags = getBinanceDepositSessionFlags(undefined);
    expect(flags.canCreate).toBe(true);
    expect(flags.hasSession).toBe(false);
    expect(flags.canSend).toBe(false);
    expect(flags.canAbandon).toBe(false);
  });

  it('offers retry create for an unconfirmed create', () => {
    const pending = getBinanceDepositSessionFlags(
      buildSession({ status: 'LOCAL_PENDING_CREATE', sessionId: undefined }),
    );
    expect(pending.canRetryCreate).toBe(true);
    expect(pending.canOpenLink).toBe(false);
    expect(pending.canRefresh).toBe(false);
    expect(pending.canCreate).toBe(false);
    expect(pending.canAbandon).toBe(true);

    const creating = getBinanceDepositSessionFlags(
      buildSession({ status: EBinanceDepositSessionStatus.CREATING }),
    );
    expect(creating.canRetryCreate).toBe(true);
    expect(creating.canOpenLink).toBe(false);
  });

  it('opens the link only while INIT', () => {
    const init = getBinanceDepositSessionFlags(buildSession());
    expect(init.canOpenLink).toBe(true);
    expect(init.canRefresh).toBe(true);
    expect(init.canRetryCreate).toBe(false);
    expect(init.canSend).toBe(false);

    const unbound = getBinanceDepositSessionFlags(
      buildSession({ status: EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND }),
    );
    expect(unbound.canOpenLink).toBe(false);
    expect(unbound.isInProgress).toBe(true);
  });

  it('allows sending only for an authorized session without a report', () => {
    const authorized = buildSession({
      status: EBinanceDepositSessionStatus.AUTHORIZED,
      destination,
    });
    const flags = getBinanceDepositSessionFlags(authorized);
    expect(flags.canSend).toBe(true);
    expect(flags.isInProgress).toBe(false);
    expect(flags.isLive).toBe(true);
    // The released address stays on screen until reported or abandoned.
    expect(flags.canCreate).toBe(false);
    expect(flags.canAbandon).toBe(true);

    expect(
      getBinanceDepositSessionFlags({ ...authorized, destination: undefined })
        .canSend,
    ).toBe(false);
  });

  it('blocks a second send and abandon while a report is pending', () => {
    const flags = getBinanceDepositSessionFlags(
      buildSession({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        destination,
        report: {
          txHash: '0xabc',
          senderAddress: '0x1',
          status: 'PENDING',
          attempts: 1,
          updatedAt: 2,
        },
      }),
    );
    expect(flags.canSend).toBe(false);
    expect(flags.canAbandon).toBe(false);
    expect(flags.canRetryReport).toBe(true);
    expect(flags.canCreate).toBe(false);
  });

  const failedReport = (lastErrorCode?: number) => ({
    txHash: '0xabc',
    senderAddress: '0x1',
    status: 'FAILED' as const,
    attempts: 20,
    lastErrorCode,
    updatedAt: 2,
  });

  it.each([
    EBinanceDepositErrorCode.ReportConflict,
    EBinanceDepositErrorCode.SecurityConflict,
    10_422,
  ])(
    'keeps send and retry blocked after a report refused with %s, but allows abandon',
    (lastErrorCode) => {
      const flags = getBinanceDepositSessionFlags(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
          report: failedReport(lastErrorCode),
        }),
      );
      expect(flags.canSend).toBe(false);
      expect(flags.canRetryReport).toBe(false);
      expect(flags.canAbandon).toBe(true);
    },
  );

  it.each([
    undefined,
    10_000,
    // The session key could not be read; it may be readable again.
    EBinanceDepositLocalErrorCode.SessionKeyUnreadable,
  ])(
    'offers a manual retry for a report that only ran out of attempts (last code %s)',
    (lastErrorCode) => {
      const flags = getBinanceDepositSessionFlags(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
          report: failedReport(lastErrorCode),
        }),
      );
      expect(flags.canRetryReport).toBe(true);
      // Re-arming the report never reopens the transfer.
      expect(flags.canSend).toBe(false);
      expect(flags.canAbandon).toBe(true);
    },
  );

  it('does not offer a manual retry for a failed report of a closed session', () => {
    const report = failedReport(10_000);
    expect(
      getBinanceDepositSessionFlags(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
          localClosedReason: 'abandoned',
          report,
        }),
      ).canRetryReport,
    ).toBe(false);
    expect(
      getBinanceDepositSessionFlags(
        buildSession({
          status: EBinanceDepositSessionStatus.EXPIRED,
          destination,
          report,
        }),
      ).canRetryReport,
    ).toBe(false);
  });

  describe('session of another server environment', () => {
    it.each([
      [
        'an unconfirmed create',
        { status: 'LOCAL_PENDING_CREATE' as const, sessionId: undefined },
      ],
      ['an INIT session', {}],
      [
        'an authorized session',
        { status: EBinanceDepositSessionStatus.AUTHORIZED, destination },
      ],
      [
        'a pending report',
        {
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
          report: {
            txHash: '0xabc',
            senderAddress: '0x1',
            status: 'PENDING' as const,
            attempts: 1,
            updatedAt: 2,
          },
        },
      ],
      [
        'a re-armable failed report',
        {
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
          report: failedReport(10_000),
        },
      ],
    ])('offers nothing that reaches the server for %s', (_name, patch) => {
      const matching = getBinanceDepositSessionFlags(buildSession(patch));
      const flags = getBinanceDepositSessionFlags(
        buildSession({ ...patch, endpointMismatch: true }),
      );
      expect(flags.isEndpointMismatch).toBe(true);
      expect(flags.canRetryCreate).toBe(false);
      expect(flags.canOpenLink).toBe(false);
      expect(flags.canRefresh).toBe(false);
      expect(flags.canSend).toBe(false);
      expect(flags.canRetryReport).toBe(false);
      // Abandoning is local, and creating stays tied to the live session.
      expect(flags.canAbandon).toBe(matching.canAbandon);
      expect(flags.canCreate).toBe(matching.canCreate);
      // Guards the assertions above: the same session on its own
      // environment does offer at least one of them.
      expect(
        matching.canRetryCreate ||
          matching.canOpenLink ||
          matching.canRefresh ||
          matching.canSend ||
          matching.canRetryReport,
      ).toBe(true);
      expect(matching.isEndpointMismatch).toBe(false);
    });

    it('still lets the session be abandoned', () => {
      expect(
        getBinanceDepositSessionFlags(buildSession({ endpointMismatch: true }))
          .canAbandon,
      ).toBe(true);
    });
  });

  describe('recorded signing attempt', () => {
    const attempted = buildSession({
      status: EBinanceDepositSessionStatus.AUTHORIZED,
      destination,
      sendAttemptedAt: 1_700_000_100_000,
    });

    it('holds the transfer until the attempt is acknowledged', () => {
      const flags = getBinanceDepositSessionFlags(attempted);
      expect(flags.canSend).toBe(false);
      expect(flags.needsSendAttemptAck).toBe(true);
      expect(flags.canAbandon).toBe(true);

      const acknowledged = getBinanceDepositSessionFlags({
        ...attempted,
        sendAttemptedAt: undefined,
      });
      expect(acknowledged.canSend).toBe(true);
      expect(acknowledged.needsSendAttemptAck).toBe(false);
    });

    it('asks for nothing once a report exists or the session is over', () => {
      const withReport = getBinanceDepositSessionFlags({
        ...attempted,
        report: {
          txHash: '0xabc',
          senderAddress: '0x1',
          status: 'PENDING',
          attempts: 1,
          updatedAt: 2,
        },
      });
      expect(withReport.needsSendAttemptAck).toBe(false);
      expect(withReport.canSend).toBe(false);

      const abandoned = getBinanceDepositSessionFlags({
        ...attempted,
        localClosedReason: 'abandoned',
      });
      expect(abandoned.needsSendAttemptAck).toBe(false);
      expect(abandoned.canSend).toBe(false);
    });

    it('keeps the hold visible on another server environment', () => {
      const flags = getBinanceDepositSessionFlags({
        ...attempted,
        endpointMismatch: true,
      });
      expect(flags.needsSendAttemptAck).toBe(true);
      expect(flags.canSend).toBe(false);
    });

    describe('wait before it can be acknowledged', () => {
      const ATTEMPTED_AT = 1_700_000_100_000;
      const HOLD_MS = BINANCE_DEPOSIT_SEND_ATTEMPT_ACK_HOLD_MS;

      it.each<[string, number, number]>([
        ['at the time of the attempt', 0, 90],
        ['one millisecond in', 1, 90],
        ['one second in', 1000, 89],
        ['just past one second in', 1001, 89],
        ['a second before the end', HOLD_MS - 1000, 1],
        // Rounded up: a started second still counts, so 0 is only shown
        // once the service accepts the acknowledgement.
        ['one millisecond before the end', HOLD_MS - 1, 1],
        ['at the end', HOLD_MS, 0],
        ['after the end', HOLD_MS + 5000, 0],
      ])('counts whole seconds %s', (_label, elapsedMs, expected) => {
        expect(
          getBinanceDepositSendAttemptAckWaitSeconds(
            attempted,
            ATTEMPTED_AT + elapsedMs,
          ),
        ).toBe(expected);
      });

      it('keeps waiting when the device clock was set back', () => {
        expect(
          getBinanceDepositSendAttemptAckWaitSeconds(
            attempted,
            ATTEMPTED_AT - 30_000,
          ),
        ).toBe(120);
      });

      it('has nothing to wait for without a recorded attempt', () => {
        expect(
          getBinanceDepositSendAttemptAckWaitSeconds(undefined, ATTEMPTED_AT),
        ).toBe(0);
        expect(
          getBinanceDepositSendAttemptAckWaitSeconds(
            { ...attempted, sendAttemptedAt: undefined },
            ATTEMPTED_AT,
          ),
        ).toBe(0);
      });
    });
  });

  it('treats a confirmed report, a terminal status and a local close as finished', () => {
    const confirmed = getBinanceDepositSessionFlags(
      buildSession({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        destination,
        report: {
          txHash: '0xabc',
          senderAddress: '0x1',
          status: 'CONFIRMED',
          attempts: 1,
          updatedAt: 2,
        },
      }),
    );
    const expired = getBinanceDepositSessionFlags(
      buildSession({ status: EBinanceDepositSessionStatus.EXPIRED }),
    );
    const abandoned = getBinanceDepositSessionFlags(
      buildSession({ localClosedReason: 'abandoned' }),
    );
    [confirmed, expired, abandoned].forEach((flags) => {
      expect(flags.isClosed).toBe(true);
      expect(flags.canCreate).toBe(true);
      expect(flags.canSend).toBe(false);
      expect(flags.canOpenLink).toBe(false);
      expect(flags.canRefresh).toBe(false);
      expect(flags.canAbandon).toBe(false);
      expect(flags.canRetryCreate).toBe(false);
    });
  });
});

describe('status presentation', () => {
  it('picks a badge type per state', () => {
    expect(getBinanceDepositStatusBadgeType(undefined)).toBe('default');
    expect(getBinanceDepositStatusBadgeType(buildSession())).toBe('info');
    expect(
      getBinanceDepositStatusBadgeType(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
        }),
      ),
    ).toBe('warning');
    expect(
      getBinanceDepositStatusBadgeType(
        buildSession({ status: EBinanceDepositSessionStatus.AUTHORIZED }),
      ),
    ).toBe('success');
    expect(
      getBinanceDepositStatusBadgeType(
        buildSession({ status: EBinanceDepositSessionStatus.REJECTED }),
      ),
    ).toBe('critical');
    expect(
      getBinanceDepositStatusBadgeType(
        buildSession({ localClosedReason: 'abandoned' }),
      ),
    ).toBe('default');
  });

  it('shows the local close reason next to the kept status', () => {
    expect(getBinanceDepositStatusLabel(undefined)).toBe('NO SESSION');
    expect(getBinanceDepositStatusLabel(buildSession())).toBe('INIT');
    expect(
      getBinanceDepositStatusLabel(
        buildSession({ localClosedReason: 'abandoned' }),
      ),
    ).toBe('INIT / closed: abandoned');
  });

  it('maps report status to a badge type', () => {
    expect(getBinanceDepositReportBadgeType(undefined)).toBe('default');
    expect(getBinanceDepositReportBadgeType('PENDING')).toBe('warning');
    expect(getBinanceDepositReportBadgeType('CONFIRMED')).toBe('success');
    expect(getBinanceDepositReportBadgeType('FAILED')).toBe('critical');
  });

  it('describes the next step for each stage', () => {
    expect(getBinanceDepositNextStepHint(undefined)).toContain('create');
    expect(
      getBinanceDepositNextStepHint(
        buildSession({ status: 'LOCAL_PENDING_CREATE', sessionId: undefined }),
      ),
    ).toContain('Retry create');
    expect(getBinanceDepositNextStepHint(buildSession())).toContain(
      'Open Binance',
    );
    expect(
      getBinanceDepositNextStepHint(
        buildSession({ linkOpenedAt: 5, awaitingReturn: true }),
      ),
    ).toContain('Waiting for the return');
    expect(
      getBinanceDepositNextStepHint(
        buildSession({ linkOpenedAt: 5, awaitingReturn: false }),
      ),
    ).toContain('return window has passed');
    expect(
      getBinanceDepositNextStepHint(
        buildSession({
          linkOpenedAt: 5,
          awaitingReturn: true,
          hasPendingNonce: true,
        }),
      ),
    ).toContain('Binding');
    expect(
      getBinanceDepositNextStepHint(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
        }),
      ),
    ).toContain('Enter an amount');
    expect(
      getBinanceDepositNextStepHint(
        buildSession({ status: EBinanceDepositSessionStatus.EXPIRED }),
      ),
    ).toContain('finished');
  });

  it('puts the server environment first while it does not match', () => {
    expect(
      getBinanceDepositNextStepHint(
        buildSession({
          linkOpenedAt: 5,
          awaitingReturn: true,
          endpointMismatch: true,
        }),
      ),
    ).toContain('another server environment');
  });

  it('points at the account history after a recorded signing attempt', () => {
    expect(
      getBinanceDepositNextStepHint(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
          sendAttemptedAt: 1_700_000_100_000,
        }),
      ),
    ).toContain('account history');
  });

  it('tells a report that can be retried by hand from one that cannot', () => {
    const report = {
      txHash: '0xabc',
      senderAddress: '0x1',
      status: 'FAILED' as const,
      attempts: 20,
      updatedAt: 2,
    };
    expect(
      getBinanceDepositNextStepHint(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
          report: { ...report, lastErrorCode: 10_000 },
        }),
      ),
    ).toContain('Retry report');
    expect(
      getBinanceDepositNextStepHint(
        buildSession({
          status: EBinanceDepositSessionStatus.AUTHORIZED,
          destination,
          report: {
            ...report,
            lastErrorCode: EBinanceDepositErrorCode.ReportConflict,
          },
        }),
      ),
    ).toContain('Abandon');
  });
});

describe('time formatting', () => {
  it('formats a countdown as m:ss and marks passed deadlines', () => {
    expect(formatBinanceDepositCountdown(undefined, 0)).toBe('-');
    expect(formatBinanceDepositCountdown(Number.NaN, 0)).toBe('-');
    expect(formatBinanceDepositCountdown(1000, 1000)).toBe('passed');
    expect(formatBinanceDepositCountdown(1000, 2000)).toBe('passed');
    expect(formatBinanceDepositCountdown(61_000, 0)).toBe('1:01');
    expect(formatBinanceDepositCountdown(10_500, 10_000)).toBe('0:01');
    expect(formatBinanceDepositCountdown(600_000, 0)).toBe('10:00');
  });

  it('formats clock and date time, and tolerates missing values', () => {
    expect(formatBinanceDepositClockTime(undefined)).toBe('-');
    expect(formatBinanceDepositClockTime(0)).toBe('-');
    expect(formatBinanceDepositDateTime(undefined)).toBe('-');
    const timestamp = new Date(2026, 9, 13, 8, 5, 9).getTime();
    expect(formatBinanceDepositClockTime(timestamp)).toBe('08:05:09');
    expect(formatBinanceDepositDateTime(timestamp)).toBe('2026-10-13 08:05:09');
  });
});

describe('debug events', () => {
  const event = (ts: number, step: string): IBinanceDepositDebugEvent => ({
    ts,
    step,
  });

  it('formats a detail as key=value pairs and skips undefined', () => {
    expect(formatBinanceDepositEventDetail(undefined)).toBe('');
    expect(
      formatBinanceDepositEventDetail({
        sid: 'aaaaaaaa…',
        attempt: 2,
        ok: false,
        code: undefined,
      }),
    ).toBe('sid=aaaaaaaa…  attempt=2  ok=false');
  });

  it('merges both sources newest first and keeps later entries first on a tie', () => {
    const merged = mergeBinanceDepositEvents(
      [
        event(1, 'createStart'),
        event(3, 'bindAttempt'),
        event(3, 'bindResult'),
      ],
      [event(2, 'linkOpen'), event(4, 'sendResult')],
    );
    expect(merged.map((item) => item.step)).toEqual([
      'sendResult',
      'bindResult',
      'bindAttempt',
      'linkOpen',
      'createStart',
    ]);
  });

  it('caps the merged list', () => {
    const merged = mergeBinanceDepositEvents(
      [event(1, 'a'), event(2, 'b'), event(3, 'c')],
      [],
      2,
    );
    expect(merged.map((item) => item.step)).toEqual(['c', 'b']);
  });

  it('detects whether the polled buffer changed', () => {
    const list = [event(1, 'a'), event(2, 'b')];
    expect(isSameBinanceDepositEventList([], [])).toBe(true);
    expect(isSameBinanceDepositEventList(list, [...list])).toBe(true);
    expect(isSameBinanceDepositEventList(list, [...list, event(3, 'c')])).toBe(
      false,
    );
    // A full ring buffer keeps its length while both ends move.
    expect(
      isSameBinanceDepositEventList(list, [event(2, 'b'), event(3, 'c')]),
    ).toBe(false);
    expect(
      isSameBinanceDepositEventList(list, [event(1, 'a'), event(2, 'x')]),
    ).toBe(false);
  });
});

describe('validateBinanceDepositAmount', () => {
  it('accepts a plain decimal and normalizes it', () => {
    expect(
      validateBinanceDepositAmount({
        amount: ' 1.50 ',
        isAssetListReady: true,
      }),
    ).toEqual({
      ok: true,
      amount: '1.5',
    });
    expect(
      validateBinanceDepositAmount({
        amount: '0.00000001',
        isAssetListReady: true,
      }),
    ).toEqual({
      ok: true,
      amount: '0.00000001',
    });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'malformed'],
    ['1e3', 'malformed'],
    ['-1', 'malformed'],
    ['+1', 'malformed'],
    ['1,5', 'malformed'],
    ['.5', 'malformed'],
    ['1.', 'malformed'],
    ['0x10', 'malformed'],
    ['Infinity', 'malformed'],
    ['0', 'not_positive'],
    ['0.0', 'not_positive'],
  ])('rejects %j as %s', (amount, reason) => {
    expect(validateBinanceDepositAmount({ amount })).toEqual({
      ok: false,
      reason,
    });
  });

  it('treats the minimum as a hard floor', () => {
    expect(
      validateBinanceDepositAmount({ amount: '0.009', minAmount: '0.01' }),
    ).toEqual({ ok: false, reason: 'below_min' });
    expect(
      validateBinanceDepositAmount({ amount: '0.01', minAmount: '0.01' }),
    ).toEqual({ ok: true, amount: '0.01' });
    expect(
      validateBinanceDepositAmount({ amount: '0.01', minAmount: '1e-2' }),
    ).toEqual({ ok: true, amount: '0.01' });
  });

  it('blocks when the minimum cannot be read', () => {
    expect(
      validateBinanceDepositAmount({ amount: '5', minAmount: 'abc' }),
    ).toEqual({ ok: false, reason: 'min_amount_invalid' });
    expect(
      validateBinanceDepositAmount({ amount: '5', minAmount: '-1' }),
    ).toEqual({ ok: false, reason: 'min_amount_invalid' });
  });

  it('skips the floor when no minimum was given and the loaded asset list has none either', () => {
    expect(
      validateBinanceDepositAmount({
        amount: '0.0001',
        minAmount: undefined,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: true, amount: '0.0001' });
    expect(
      validateBinanceDepositAmount({
        amount: '0.0001',
        minAmount: '',
        isAssetListReady: true,
      }),
    ).toEqual({ ok: true, amount: '0.0001' });
  });

  describe('asset list that is not ready', () => {
    it.each([
      ['left out', undefined],
      ['not ready', false],
    ])(
      'blocks when no minimum was given and the list is %s',
      (_name, isAssetListReady) => {
        expect(
          validateBinanceDepositAmount({ amount: '5', isAssetListReady }),
        ).toEqual({ ok: false, reason: 'min_amount_unknown' });
        expect(
          validateBinanceDepositAmount({
            amount: '5',
            minAmount: '',
            isAssetListReady,
          }),
        ).toEqual({ ok: false, reason: 'min_amount_unknown' });
        // A minimum of zero protects no more than a missing one.
        expect(
          validateBinanceDepositAmount({
            amount: '5',
            minAmount: '0',
            isAssetListReady,
          }),
        ).toEqual({ ok: false, reason: 'min_amount_unknown' });
        // However large the amount is, and whatever else is known.
        expect(
          validateBinanceDepositAmount({
            amount: '1000000',
            isAssetListReady,
            decimals: 6,
            balance: '2000000',
            checkBalance: true,
          }),
        ).toEqual({ ok: false, reason: 'min_amount_unknown' });
      },
    );

    it('still applies a minimum set with the deposit address', () => {
      expect(
        validateBinanceDepositAmount({
          amount: '0.009',
          minAmount: '0.01',
          isAssetListReady: false,
        }),
      ).toEqual({ ok: false, reason: 'below_min' });
      expect(
        validateBinanceDepositAmount({
          amount: '0.01',
          minAmount: '0.01',
          isAssetListReady: false,
        }),
      ).toEqual({ ok: true, amount: '0.01' });
    });

    it('says that the list has to be reloaded', () => {
      const text = getBinanceDepositAmountRejectText('min_amount_unknown');
      expect(text).toContain('asset list');
      expect(text).toContain('minimum deposit amount is unknown');
      expect(text).toContain('Reload');
    });
  });

  describe('deposit dust as a second floor', () => {
    it('applies the dust when the destination sets no minimum', () => {
      expect(
        validateBinanceDepositAmount({
          amount: '0.009',
          depositDust: '0.01',
          isAssetListReady: true,
        }),
      ).toEqual({ ok: false, reason: 'below_min' });
      expect(
        validateBinanceDepositAmount({
          amount: '0.009',
          minAmount: '',
          depositDust: '0.01',
          isAssetListReady: true,
        }),
      ).toEqual({ ok: false, reason: 'below_min' });
      expect(
        validateBinanceDepositAmount({
          amount: '0.01',
          depositDust: '0.01',
          isAssetListReady: true,
        }),
      ).toEqual({ ok: true, amount: '0.01' });
    });

    it('applies the larger of the two', () => {
      // The dust raises a lower destination minimum.
      expect(
        validateBinanceDepositAmount({
          amount: '0.5',
          minAmount: '0.1',
          depositDust: '1',
        }),
      ).toEqual({ ok: false, reason: 'below_min' });
      // It never lowers a higher one.
      expect(
        validateBinanceDepositAmount({
          amount: '0.5',
          minAmount: '1',
          depositDust: '0.1',
        }),
      ).toEqual({ ok: false, reason: 'below_min' });
      expect(
        validateBinanceDepositAmount({
          amount: '1',
          minAmount: '1',
          depositDust: '0.1',
        }),
      ).toEqual({ ok: true, amount: '1' });
    });

    it.each(['0.00000001', '1e-8'])(
      'reads a dust given as %s',
      (depositDust) => {
        expect(
          validateBinanceDepositAmount({
            amount: '0.000000009',
            depositDust,
            isAssetListReady: true,
          }),
        ).toEqual({ ok: false, reason: 'below_min' });
        expect(
          validateBinanceDepositAmount({
            amount: '0.00000001',
            depositDust,
            isAssetListReady: true,
          }),
        ).toEqual({ ok: true, amount: '0.00000001' });
      },
    );

    it('still blocks an unreadable destination minimum, whatever the dust', () => {
      expect(
        validateBinanceDepositAmount({
          amount: '5',
          minAmount: 'abc',
          depositDust: '0.01',
          isAssetListReady: true,
        }),
      ).toEqual({ ok: false, reason: 'min_amount_invalid' });
    });

    it.each(['0', '-1', 'NaN', 'Infinity', 'abc', '', undefined])(
      'ignores a dust of %s',
      (depositDust) => {
        expect(
          validateBinanceDepositAmount({
            amount: '0.0001',
            depositDust,
            isAssetListReady: true,
          }),
        ).toEqual({ ok: true, amount: '0.0001' });
        // The destination minimum keeps applying on its own.
        expect(
          validateBinanceDepositAmount({
            amount: '0.0001',
            minAmount: '0.01',
            depositDust,
          }),
        ).toEqual({ ok: false, reason: 'below_min' });
      },
    );
  });

  it('checks the token decimals when given', () => {
    expect(
      validateBinanceDepositAmount({
        amount: '1.1234567',
        decimals: 6,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: false, reason: 'too_many_decimals' });
    expect(
      validateBinanceDepositAmount({
        amount: '1.123456',
        decimals: 6,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: true, amount: '1.123456' });
    expect(
      validateBinanceDepositAmount({
        amount: '1.5',
        decimals: 0,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: false, reason: 'too_many_decimals' });
    expect(
      validateBinanceDepositAmount({
        amount: '1',
        decimals: Number.NaN,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: false, reason: 'malformed' });
  });

  it('checks the balance only when asked to', () => {
    expect(
      validateBinanceDepositAmount({
        amount: '2',
        balance: '1',
        isAssetListReady: true,
      }),
    ).toEqual({ ok: true, amount: '2' });
    expect(
      validateBinanceDepositAmount({
        amount: '2',
        balance: '1',
        checkBalance: true,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: false, reason: 'insufficient_balance' });
    expect(
      validateBinanceDepositAmount({
        amount: '1',
        balance: '1',
        checkBalance: true,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: true, amount: '1' });
    expect(
      validateBinanceDepositAmount({
        amount: '1',
        balance: undefined,
        checkBalance: true,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: false, reason: 'balance_unavailable' });
    expect(
      validateBinanceDepositAmount({
        amount: '1',
        balance: '--',
        checkBalance: true,
        isAssetListReady: true,
      }),
    ).toEqual({ ok: false, reason: 'balance_unavailable' });
  });

  it('has a text for every reject reason', () => {
    expect(getBinanceDepositAmountRejectText('below_min')).toContain('minimum');
    expect(getBinanceDepositAmountRejectText('insufficient_balance')).toContain(
      'balance',
    );
  });
});

describe('getBinanceDepositAmountFloor', () => {
  it('has no floor when neither source sets one and the asset list was consulted', () => {
    expect(getBinanceDepositAmountFloor({ isAssetListReady: true })).toEqual({
      ok: true,
    });
    expect(
      getBinanceDepositAmountFloor({
        minAmount: '',
        depositDust: '0',
        isAssetListReady: true,
      }),
    ).toEqual({ ok: true });
  });

  // The three ways a floor comes about, each with the asset list loaded and
  // without it. A minimum from the destination never depends on the list.
  it.each([true, false])(
    'names the source of the floor in force (asset list ready: %s)',
    (isAssetListReady) => {
      // Set with the deposit address only.
      expect(
        getBinanceDepositAmountFloor({ minAmount: '0.01', isAssetListReady }),
      ).toEqual({
        ok: true,
        minAmount: '0.01',
        source: 'destination',
      });
      // Both: the larger one is in force.
      expect(
        getBinanceDepositAmountFloor({
          minAmount: '0.01',
          depositDust: '0.5',
          isAssetListReady,
        }),
      ).toEqual({ ok: true, minAmount: '0.5', source: 'deposit_dust' });
      expect(
        getBinanceDepositAmountFloor({
          minAmount: '1',
          depositDust: '0.5',
          isAssetListReady,
        }),
      ).toEqual({ ok: true, minAmount: '1', source: 'destination' });
      // On a tie the minimum released with the address is the one named.
      expect(
        getBinanceDepositAmountFloor({
          minAmount: '0.5',
          depositDust: '0.5',
          isAssetListReady,
        }),
      ).toEqual({ ok: true, minAmount: '0.5', source: 'destination' });
    },
  );

  it('takes the floor from the deposit dust alone only with the asset list loaded', () => {
    expect(
      getBinanceDepositAmountFloor({
        depositDust: '0.00000001',
        isAssetListReady: true,
      }),
    ).toEqual({
      ok: true,
      minAmount: '0.00000001',
      source: 'deposit_dust',
    });
    expect(
      getBinanceDepositAmountFloor({
        depositDust: '1e-8',
        isAssetListReady: true,
      }),
    ).toEqual({
      ok: true,
      minAmount: '0.00000001',
      source: 'deposit_dust',
    });
    // A dust handed over without the list it comes from is not relied on.
    expect(
      getBinanceDepositAmountFloor({
        depositDust: '0.00000001',
        isAssetListReady: false,
      }),
    ).toEqual({ ok: false, reason: 'min_amount_unknown' });
  });

  it.each([
    ['left out', undefined],
    ['not ready', false],
  ])(
    'does not call the minimum absent while the asset list is %s',
    (_name, isAssetListReady) => {
      const unknown = { ok: false, reason: 'min_amount_unknown' };
      expect(getBinanceDepositAmountFloor({ isAssetListReady })).toEqual(
        unknown,
      );
      expect(
        getBinanceDepositAmountFloor({ minAmount: '', isAssetListReady }),
      ).toEqual(unknown);
      expect(
        getBinanceDepositAmountFloor({ minAmount: '0', isAssetListReady }),
      ).toEqual(unknown);
      expect(
        getBinanceDepositAmountFloor({ minAmount: '0.000', isAssetListReady }),
      ).toEqual(unknown);
    },
  );

  it('keeps a destination minimum of zero once the asset list was consulted', () => {
    expect(
      getBinanceDepositAmountFloor({ minAmount: '0', isAssetListReady: true }),
    ).toEqual({ ok: true, minAmount: '0', source: 'destination' });
    expect(
      getBinanceDepositAmountFloor({
        minAmount: '0',
        depositDust: '0.5',
        isAssetListReady: true,
      }),
    ).toEqual({ ok: true, minAmount: '0.5', source: 'deposit_dust' });
  });

  it('reports an unreadable destination minimum instead of falling back', () => {
    const invalid = { ok: false, reason: 'min_amount_invalid' };
    expect(
      getBinanceDepositAmountFloor({
        minAmount: 'n/a',
        depositDust: '0.5',
        isAssetListReady: true,
      }),
    ).toEqual(invalid);
    expect(
      getBinanceDepositAmountFloor({ minAmount: '-1', isAssetListReady: true }),
    ).toEqual(invalid);
    // Unreadable is reported as such, with or without the asset list.
    expect(getBinanceDepositAmountFloor({ minAmount: 'n/a' })).toEqual(invalid);
  });

  it('describes the floor and where it comes from', () => {
    expect(
      describeBinanceDepositAmountFloor(
        getBinanceDepositAmountFloor({ minAmount: '0.01' }),
      ),
    ).toBe('Minimum 0.01, set with the deposit address.');
    const dust = describeBinanceDepositAmountFloor(
      getBinanceDepositAmountFloor({ minAmount: '0.01', depositDust: '0.5' }),
    );
    expect(dust).toContain('Minimum 0.5');
    expect(dust).toContain('deposit dust');
    expect(
      describeBinanceDepositAmountFloor(
        getBinanceDepositAmountFloor({ isAssetListReady: true }),
      ),
    ).toBe('No minimum is set for this asset.');
    expect(
      describeBinanceDepositAmountFloor(
        getBinanceDepositAmountFloor({ minAmount: 'n/a' }),
      ),
    ).toContain('could not be read');
  });

  it('never says that no minimum is set while the asset list is not ready', () => {
    const text = describeBinanceDepositAmountFloor(
      getBinanceDepositAmountFloor({ isAssetListReady: false }),
    );
    expect(text).not.toContain('No minimum');
    expect(text).toContain('minimum deposit amount is unknown');
    expect(text).toContain('Reload the asset list');
    // The same words the blocked transfer is explained with.
    expect(text).toBe(getBinanceDepositAmountRejectText('min_amount_unknown'));
  });
});

describe('transfer helpers', () => {
  it('has a text for every address reject status', () => {
    expect(
      getBinanceDepositAddressRejectText('address-not-allowlist'),
    ).toContain('allowlist');
    expect(getBinanceDepositAddressRejectText('invalid')).toContain(
      'not valid',
    );
    expect(getBinanceDepositAddressRejectText('unknown')).toContain('failed');
    expect(
      getBinanceDepositAddressRejectText('prohibit-send-to-self'),
    ).toContain('yourself');
  });

  it('compares EVM addresses case-insensitively and others exactly', () => {
    expect(
      isSameBinanceDepositAddress({
        networkId: 'evm--56',
        a: '0x55d398326f99059fF775485246999027B3197955',
        b: '0x55d398326f99059ff775485246999027b3197955',
      }),
    ).toBe(true);
    expect(
      isSameBinanceDepositAddress({
        networkId: 'tron--0x2b6653dc',
        a: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        b: 'tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t',
      }),
    ).toBe(false);
    expect(
      isSameBinanceDepositAddress({
        networkId: 'sol--101',
        a: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        b: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      }),
    ).toBe(true);
  });

  it('adjusts only the 0x prefix of a transaction hash', () => {
    const hex = 'ab'.repeat(32);
    expect(
      normalizeBinanceDepositTxHash({ networkId: 'evm--1', txid: hex }),
    ).toBe(`0x${hex}`);
    expect(
      normalizeBinanceDepositTxHash({ networkId: 'evm--1', txid: `0x${hex}` }),
    ).toBe(`0x${hex}`);
    expect(
      normalizeBinanceDepositTxHash({
        networkId: 'tron--0x2b6653dc',
        txid: `0x${hex}`,
      }),
    ).toBe(hex);
    expect(
      normalizeBinanceDepositTxHash({ networkId: 'xrp--0', txid: `0x${hex}` }),
    ).toBe(hex);
    expect(
      normalizeBinanceDepositTxHash({ networkId: 'xrp--0', txid: ` ${hex} ` }),
    ).toBe(hex);
    const signature =
      '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
    expect(
      normalizeBinanceDepositTxHash({ networkId: 'sol--101', txid: signature }),
    ).toBe(signature);
    // Anything unexpected is passed on unchanged for the server to judge.
    expect(
      normalizeBinanceDepositTxHash({ networkId: 'evm--1', txid: '0x1234' }),
    ).toBe('0x1234');
  });
});
