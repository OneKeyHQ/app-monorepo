import { ETranslations } from '@onekeyhq/shared/src/locale';

import { resolveCapsuleText } from './stepCopy';

import type { IntlShape } from 'react-intl';

/**
 * The error notice's words (OK-59934). The stage clears the toast that
 * used to speak a failure's own message, so the card carries it —
 * except where a reason already has considered wording of its own.
 */

// Enough of an intl to answer formatMessage with the id it was given.
const intl = {
  formatMessage: ({ id }: { id: string }) => `<${id}>`,
} as unknown as IntlShape;

describe('resolveCapsuleText, error step', () => {
  it('speaks the failure’s own words when no reason claims it', () => {
    expect(
      resolveCapsuleText(
        intl,
        'error',
        'Neo DECD',
        undefined,
        undefined,
        'Passphrase does not match the current wallet, please try again',
      ).title,
    ).toBe('Passphrase does not match the current wallet, please try again');
  });

  // The guard that matters: 'disconnected' exists precisely because the
  // raw transport message was unreadable, so it must never be displaced.
  it('keeps a reason’s considered wording over the raw message', () => {
    expect(
      resolveCapsuleText(
        intl,
        'error',
        'Neo DECD',
        undefined,
        'disconnected',
        'Protocol V2 USB read failed: transferIn',
      ).title,
    ).toBe(`<${ETranslations.hardware_third_party_device_disconnected}>`);
  });

  it('falls back to the generic line when there is neither', () => {
    expect(resolveCapsuleText(intl, 'error', 'Neo DECD').title).toBe(
      `<${ETranslations.device_stage_generic_error__title}>`,
    );
  });

  it('leaves the notice’s second line empty either way', () => {
    expect(
      resolveCapsuleText(intl, 'error', 'Neo DECD', undefined, undefined, 'x')
        .sub,
    ).toBe('');
  });
});
