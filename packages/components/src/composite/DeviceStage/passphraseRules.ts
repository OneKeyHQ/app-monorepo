import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  PROTOCOL_V2_PASSPHRASE_MAX_BYTES,
  normalizeProtocolV2Passphrase,
  protocolV2Utf8ByteLength,
} from '@onekeyhq/shared/src/utils/passphraseUtils';

/** Older firmware accepts printable ASCII only (production's validation);
 * protocol V2 devices take NFKD-normalized UTF-8 up to the same budget in
 * bytes — see `IPassphraseEntryOptions`. */
export const PASSPHRASE_MAX_LENGTH = 50;
// eslint-disable-next-line no-control-regex
const PASSPHRASE_CHARSET = /^[\x20-\x7E]*$/;

export type IPassphraseEntryOptions = {
  /**
   * The protocol V2 rule: the entry is NFKD-normalized and measured in
   * UTF-8 bytes against the device's budget, and any character but NUL
   * is allowed. The driver decides this from the request — the shipped
   * dialog keyed it on the wallet-session coordinator's requests, the
   * only source that reaches a V2 device.
   */
  allowProtocolV2Utf8?: boolean;
};

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
  options?: IPassphraseEntryOptions,
): IPassphraseEntryFailure | undefined {
  if (!value.length) {
    return { id: ETranslations.device_stage_enter_passphrase_first__msg };
  }
  if (options?.allowProtocolV2Utf8) {
    const normalized = normalizeProtocolV2Passphrase(value);
    if (normalized.includes('\0')) {
      return { id: ETranslations.hardware_unsupported_passphrase_characters };
    }
    if (
      protocolV2Utf8ByteLength(normalized) > PROTOCOL_V2_PASSPHRASE_MAX_BYTES
    ) {
      return {
        id: ETranslations.hardware_passphrase_enter_too_long,
        values: { 0: PROTOCOL_V2_PASSPHRASE_MAX_BYTES },
      };
    }
    return undefined;
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

/** What actually goes to the device: the NFKD form on protocol V2 (the
 * bytes the rule above measured), the entry as typed everywhere else. */
export function normalizePassphraseEntry(
  value: string,
  options?: IPassphraseEntryOptions,
): string {
  return options?.allowProtocolV2Utf8
    ? normalizeProtocolV2Passphrase(value)
    : value;
}
