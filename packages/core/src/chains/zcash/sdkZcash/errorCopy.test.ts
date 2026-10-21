import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale/enum/translationsMock';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

import { toUserFacingZcashError, zcashUserMessage } from './errorCopy';

const originalLocale = appLocale.intl.locale;
const originalMessages = appLocale.intl.messages;

afterEach(() => {
  appLocale.setLocale(originalLocale, originalMessages);
});

function runtimeError(code: string, params: Record<string, unknown>) {
  return Object.assign(new Error(code), {
    code,
    params,
    payload: { code, params },
  });
}

describe('zcashUserMessage', () => {
  it('uses the existing send balance message in the current locale', async () => {
    const error = runtimeError('INSUFFICIENT_FUNDS', {
      shortfallZat: 66_000_000,
    });
    appLocale.setLocale('en-US', await loadLocaleMessages('en-US'));
    expect(zcashUserMessage(error)).toBe('Insufficient ZEC balance');
    appLocale.setLocale('zh-CN', await loadLocaleMessages('zh-CN'));
    expect(zcashUserMessage(error)).toBe('ZEC 余额不足');
  });

  it('uses the same balance message when no shortfall is reported', async () => {
    appLocale.setLocale('zh-CN', await loadLocaleMessages('zh-CN'));
    expect(zcashUserMessage(runtimeError('INSUFFICIENT_FUNDS', {}))).toBe(
      'ZEC 余额不足',
    );
  });

  // The Sapling prover is not shipped; "invalid address" would be wrong.
  it('reports a Sapling-only address as an invalid address', () => {
    expect(
      zcashUserMessage(
        runtimeError('INVALID_ADDRESS', { reason: 'saplingOnlyRecipient' }),
      ),
    ).toBe('send.address_invalid');
  });

  it('reports a TEX recipient it cannot pay as an invalid address', () => {
    expect(
      zcashUserMessage(
        runtimeError('INVALID_ADDRESS', {
          reason: 'texRequiresTransparentSource',
        }),
      ),
    ).toBe('send.address_invalid');
  });

  it('leaves caller-bug codes alone', () => {
    // These can only come from a wrong call, never from anything the user did,
    // so a friendly sentence would bury the one detail worth reporting.
    expect(
      zcashUserMessage(runtimeError('INVALID_DB_NAME', { operation: 'x' })),
    ).toBeNull();
    expect(
      zcashUserMessage(runtimeError('INVALID_BATCH_SIZE', { operation: 'x' })),
    ).toBeNull();
    expect(zcashUserMessage(new Error('plain'))).toBeNull();
  });

  it('explains a broken local cache instead of showing its code', () => {
    // Reachable in normal use (corrupt or full storage), and Resync rebuilds
    // the cache, so the user gets the recovery action.
    const message = zcashUserMessage(
      runtimeError('DATABASE_ERROR', { operation: 'x' }),
    );
    expect(message).toBe(ETranslations.privacy_error_sync_data__msg);
  });

  it('asks for an app update when the database is from a newer app', () => {
    expect(
      zcashUserMessage(
        runtimeError('DATABASE_TOO_NEW', { unknownMigrations: 1 }),
      ),
    ).toBe(ETranslations.database_read_error_update_app__msg);
  });

  // NOT_INITIALIZED copy would read "still syncing" forever.
  it('tells an outdated WebView apart from a runtime still starting', () => {
    expect(
      zcashUserMessage(
        runtimeError('STORAGE_UNSUPPORTED', { missing: 'getDirectory' }),
      ),
    ).toBe(ETranslations.privacy_error_webview_outdated__msg);
  });
});

describe('toUserFacingZcashError', () => {
  it.each(['flat', 'carrier'])(
    'keeps shortfall diagnostics and the i18n key after a %s runtime failure',
    async (boundary) => {
      appLocale.setLocale('zh-CN', await loadLocaleMessages('zh-CN'));
      const original = runtimeError('INSUFFICIENT_FUNDS', {
        shortfallZat: 66_000_000,
        availableZat: 10_000,
      });
      const input =
        boundary === 'flat'
          ? original
          : { message: original.message, payload: original.payload };
      const out = toUserFacingZcashError(input);
      expect(out).toMatchObject({
        message: 'ZEC 余额不足',
        key: ETranslations.send_error_insufficient_balance,
        info: { token: 'ZEC' },
        payload: original.payload,
        autoToast: true,
      });
      if (boundary === 'flat') {
        expect(out).toMatchObject({
          code: 'INSUFFICIENT_FUNDS',
          params: original.params,
        });
      }
    },
  );

  it('rewrites the message but keeps the machine-readable fields', () => {
    const original = runtimeError('NOT_SYNCED', { stage: 'proposeTransfer' });
    const out = toUserFacingZcashError(original) as Error &
      Record<string, unknown>;
    expect(out.message).toBe(
      appLocale.intl.formatMessage({
        id: ETranslations.privacy_error_still_syncing__msg,
      }),
    );
    expect(out.code).toBe('NOT_SYNCED');
    expect(out.payload).toEqual(original.payload);
  });

  it('returns unmapped errors unchanged (same reference)', () => {
    const e = new Error('boom');
    expect(toUserFacingZcashError(e)).toBe(e);
  });
});

it('names the node reason for a rejected broadcast', () => {
  expect(
    zcashUserMessage({
      code: 'BROADCAST_REJECTED',
      params: {},
      detail: 'bad-txns-expired',
    }),
  ).toBe(
    `${ETranslations.privacy_error_broadcast_rejected__msg} (bad-txns-expired)`,
  );
});

// QA: a Worker that crashed at load surfaced "handshake timed out" (no code)
// and the enable dialog said nothing.
it('words a Worker that never started for the user, with a toast', () => {
  const crashed = Object.assign(
    new Error('zcash worker: handshake timed out'),
    {
      data: { privacyChainRuntimeFailure: 'handshake' },
    },
  );
  expect(zcashUserMessage(crashed)).toBe(
    ETranslationsMock.privacy_error_runtime_unavailable__msg,
  );
  expect(toUserFacingZcashError(crashed)).toMatchObject({
    message: ETranslationsMock.privacy_error_runtime_unavailable__msg,
    autoToast: true,
  });
});
