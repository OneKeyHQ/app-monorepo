import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  PASSPHRASE_MAX_LENGTH,
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
});
