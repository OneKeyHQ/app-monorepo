import { ETranslations } from '@onekeyhq/shared/src/locale';

/** The device accepts printable ASCII only (production's validation). */
export const PASSPHRASE_MAX_LENGTH = 50;
// eslint-disable-next-line no-control-regex
const PASSPHRASE_CHARSET = /^[\x20-\x7E]*$/;

export type IPassphraseEntryFailure = {
  id: ETranslations;
  values?: Record<string, string | number>;
};

/**
 * What the passphrase entry refuses, in the order the form checks it.
 * Kept apart from the form so the rules can be read — and pinned — on
 * their own, the way the legacy dialog's entry resolver is.
 *
 * An empty entry is refused in BOTH modes. The standard wallet never
 * reaches this input (its calls carry `useEmptyPassphrase`, which the
 * SDK answers without asking), so empty is never the answer here:
 * sending it derives the standard wallet's state, the device rejects
 * the mismatch, and the call dies with a released session — a dead end
 * the person cannot act on. On-device entry remains the one way to
 * answer with an empty passphrase, and it does not come through here.
 */
export function resolvePassphraseEntryFailure(
  value: string,
): IPassphraseEntryFailure | undefined {
  if (!value.length) {
    return { id: ETranslations.device_stage_enter_passphrase_first__msg };
  }
  if (value.length > PASSPHRASE_MAX_LENGTH) {
    return {
      id: ETranslations.hardware_passphrase_enter_too_long,
      values: { 0: PASSPHRASE_MAX_LENGTH },
    };
  }
  if (!PASSPHRASE_CHARSET.test(value)) {
    return { id: ETranslations.hardware_unsupported_passphrase_characters };
  }
  return undefined;
}
