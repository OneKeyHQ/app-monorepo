import { ETranslations } from '@onekeyhq/shared/src/locale';

// A confirming tx broadcast for longer than this is treated as "slow": the
// (now-misleading) ETA is dropped in favour of a speed-up nudge.
const TX_CONFIRM_SLOW_THRESHOLD_MS = 30 * 60 * 1000;
// Below this remaining ETA we show "almost confirmed" instead of a minute count.
const TX_CONFIRM_ETA_IMMINENT_SECONDS = 60;

export interface ITxConfirmSubtitleParams {
  confirmationETASeconds: number | undefined;
  confirmationETABlocks: number | undefined;
  broadcastTimeMs: number | undefined;
  nowMs: number;
}

export interface ITxConfirmSubtitle {
  id: ETranslations;
  values?: Record<string, string | number>;
}

// Builds the confirming-state subtitle per OK-56372 §3 priority. Always returns
// a translation descriptor, falling back to the "waiting" copy when no ETA truth
// exists. Only meaningful while the tx is confirming (caller gates on
// isConfirming).
export function getTxConfirmSubtitle({
  confirmationETASeconds,
  confirmationETABlocks,
  broadcastTimeMs,
  nowMs,
}: ITxConfirmSubtitleParams): ITxConfirmSubtitle {
  // Low-fee / long-tail tx stuck for a while: drop the (now-misleading) ETA
  // and nudge the user to speed it up.
  if (
    broadcastTimeMs &&
    nowMs - broadcastTimeMs > TX_CONFIRM_SLOW_THRESHOLD_MS
  ) {
    return { id: ETranslations.tx_confirm_slow__desc };
  }

  if (confirmationETASeconds && confirmationETASeconds > 0) {
    if (confirmationETASeconds < TX_CONFIRM_ETA_IMMINENT_SECONDS) {
      return { id: ETranslations.almost_confirmed };
    }
    return {
      id: ETranslations.tx_confirm_eta_minutes__desc,
      values: { minutes: Math.round(confirmationETASeconds / 60) },
    };
  }

  if (confirmationETABlocks && confirmationETABlocks > 0) {
    return {
      id: ETranslations.tx_confirm_eta_blocks__desc,
      values: { count: confirmationETABlocks },
    };
  }

  // No ETA truth (EVM, or detail not yet loaded): never render an empty number.
  return { id: ETranslations.tx_confirm_waiting__desc };
}
