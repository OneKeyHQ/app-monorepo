import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  PASSPHRASE_MAX_LENGTH,
  normalizePassphraseEntry,
  resolvePassphraseEntryFailure,
} from './passphraseRules';

describe('resolvePassphraseEntryFailure', () => {
  it('accepts an ordinary passphrase', () => {
    expect(resolvePassphraseEntryFailure('correct horse')).toBeUndefined();
  });

  // OK-59934: the rules take no mode, which is the point — the refusal
  // covers unlocking an existing hidden wallet as well as creating one.
  // An empty entry on the unlock path used to reach the device, derive
  // the standard wallet's state and die on the mismatch (hardware error
  // 112) as an unactionable "Something went wrong".
  it('refuses an empty entry, whichever flow asked', () => {
    expect(resolvePassphraseEntryFailure('')).toEqual({
      id: ETranslations.device_stage_enter_passphrase_first__msg,
    });
  });

  it('refuses an entry past the device limit', () => {
    expect(
      resolvePassphraseEntryFailure('a'.repeat(PASSPHRASE_MAX_LENGTH + 1)),
    ).toEqual({
      id: ETranslations.hardware_passphrase_enter_too_long,
      values: { 0: PASSPHRASE_MAX_LENGTH },
    });
  });

  it('accepts an entry exactly at the device limit', () => {
    expect(
      resolvePassphraseEntryFailure('a'.repeat(PASSPHRASE_MAX_LENGTH)),
    ).toBeUndefined();
  });

  it('refuses characters the device cannot take', () => {
    expect(resolvePassphraseEntryFailure('héllo')).toEqual({
      id: ETranslations.hardware_unsupported_passphrase_characters,
    });
  });

  // Protocol V2 devices take UTF-8, the way the shipped dialog allowed for
  // the wallet-session coordinator's requests; rejecting it here locked
  // existing Unicode hidden wallets out of app-side entry.
  describe('protocol V2 UTF-8 entry', () => {
    const utf8 = { allowProtocolV2Utf8: true };

    it('accepts characters outside ASCII', () => {
      expect(resolvePassphraseEntryFailure('héllo 密码', utf8)).toBeUndefined();
    });

    it('measures the limit in encoded bytes, not characters', () => {
      // 16 CJK characters are 48 bytes; 17 are 51.
      expect(
        resolvePassphraseEntryFailure('密'.repeat(16), utf8),
      ).toBeUndefined();
      expect(resolvePassphraseEntryFailure('密'.repeat(17), utf8)).toEqual({
        id: ETranslations.hardware_passphrase_enter_too_long,
        values: { 0: 50 },
      });
    });

    it('measures the NFKD form, so a composed entry counts its decomposition', () => {
      // U+00E9 (2 bytes composed) decomposes to e + U+0301 (3 bytes).
      expect(resolvePassphraseEntryFailure('\u00e9'.repeat(17), utf8)).toEqual({
        id: ETranslations.hardware_passphrase_enter_too_long,
        values: { 0: 50 },
      });
    });

    it('still refuses NUL and an empty entry', () => {
      expect(resolvePassphraseEntryFailure('a\0b', utf8)).toEqual({
        id: ETranslations.hardware_unsupported_passphrase_characters,
      });
      expect(resolvePassphraseEntryFailure('', utf8)).toEqual({
        id: ETranslations.device_stage_enter_passphrase_first__msg,
      });
    });

    it('hands the device the NFKD form, and the typed form otherwise', () => {
      expect(normalizePassphraseEntry('\u00e9', utf8)).toBe('e\u0301');
      expect(normalizePassphraseEntry('\u00e9')).toBe('\u00e9');
    });
  });
});
