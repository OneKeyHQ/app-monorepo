import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getTxConfirmSubtitle } from './txConfirmSubtitle';

// Fixed "now" so the slow-threshold arithmetic is deterministic.
const NOW = 1_700_000_000_000;
const MINUTE = 60 * 1000;

describe('getTxConfirmSubtitle (OK-56372 §3 priority)', () => {
  it('returns the "slow" nudge once a broadcast tx exceeds the 30min threshold', () => {
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: undefined,
        confirmationETABlocks: undefined,
        broadcastTimeMs: NOW - 31 * MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({ id: ETranslations.tx_confirm_slow__desc });
  });

  it('prioritises "slow" over a still-present ETA', () => {
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 120,
        confirmationETABlocks: 3,
        broadcastTimeMs: NOW - 45 * MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({ id: ETranslations.tx_confirm_slow__desc });
  });

  it('does not flag "slow" exactly at the threshold (strict greater-than)', () => {
    // 30min elapsed is not yet slow; with no ETA truth it falls back to waiting.
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: undefined,
        confirmationETABlocks: undefined,
        broadcastTimeMs: NOW - 30 * MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({ id: ETranslations.tx_confirm_waiting__desc });
  });

  it('never flags "slow" when broadcastTimeMs is unknown', () => {
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 300,
        confirmationETABlocks: undefined,
        broadcastTimeMs: undefined,
        nowMs: NOW,
      }),
    ).toEqual({
      id: ETranslations.tx_confirm_eta_minutes__desc,
      values: { minutes: 5 },
    });
  });

  it('shows "almost confirmed" when the ETA is under a minute', () => {
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 45,
        confirmationETABlocks: undefined,
        broadcastTimeMs: NOW - MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({ id: ETranslations.almost_confirmed });
  });

  it('treats exactly 60s as a 1-minute ETA, not "almost confirmed" (strict less-than)', () => {
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 60,
        confirmationETABlocks: undefined,
        broadcastTimeMs: NOW - MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({
      id: ETranslations.tx_confirm_eta_minutes__desc,
      values: { minutes: 1 },
    });
  });

  it('rounds the minute ETA to the nearest minute', () => {
    // 130s -> round(2.17) = 2
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 130,
        confirmationETABlocks: undefined,
        broadcastTimeMs: NOW - MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({
      id: ETranslations.tx_confirm_eta_minutes__desc,
      values: { minutes: 2 },
    });

    // 90s -> round(1.5) = 2
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 90,
        confirmationETABlocks: undefined,
        broadcastTimeMs: NOW - MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({
      id: ETranslations.tx_confirm_eta_minutes__desc,
      values: { minutes: 2 },
    });
  });

  it('prefers a seconds ETA over a blocks ETA', () => {
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 600,
        confirmationETABlocks: 2,
        broadcastTimeMs: NOW - MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({
      id: ETranslations.tx_confirm_eta_minutes__desc,
      values: { minutes: 10 },
    });
  });

  it('falls back to a blocks ETA when no seconds ETA is available', () => {
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 0,
        confirmationETABlocks: 2,
        broadcastTimeMs: NOW - MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({
      id: ETranslations.tx_confirm_eta_blocks__desc,
      values: { count: 2 },
    });
  });

  it('falls back to "waiting" when there is no ETA truth (e.g. EVM)', () => {
    expect(
      getTxConfirmSubtitle({
        confirmationETASeconds: 0,
        confirmationETABlocks: 0,
        broadcastTimeMs: NOW - MINUTE,
        nowMs: NOW,
      }),
    ).toEqual({ id: ETranslations.tx_confirm_waiting__desc });
  });
});
