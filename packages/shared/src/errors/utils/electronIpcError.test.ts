import { ETranslations } from '../../locale';
import { OneKeyLocalError } from '../errors/localError';

import {
  UnwrappedIpcError,
  resolveErrorI18nMessage,
  unwrapElectronIpcError,
} from './electronIpcError';

/*
yarn jest packages/shared/src/errors/utils/electronIpcError.test.ts
*/

const buildIpcError = (tail: string) =>
  new Error(`Error invoking remote method 'DESKTOP_API_CALL': ${tail}`);

describe('unwrapElectronIpcError', () => {
  it('unwraps a serialized OneKeyError JSON payload', () => {
    const raw = buildIpcError(
      JSON.stringify({
        code: -99_999,
        message: ETranslations.update_installation_package_possibly_compromised,
      }),
    );

    const unwrapped = unwrapElectronIpcError(raw) as UnwrappedIpcError;

    expect(unwrapped).toBeInstanceOf(UnwrappedIpcError);
    expect(unwrapped.message).toBe(
      ETranslations.update_installation_package_possibly_compromised,
    );
    expect(unwrapped.code).toBe(-99_999);
    expect((unwrapped as { cause?: unknown }).cause).toBe(raw);
  });

  it('preserves payload data field when present', () => {
    const raw = buildIpcError(
      JSON.stringify({
        code: 1234,
        message: 'with data',
        data: { foo: 'bar' },
      }),
    );

    const unwrapped = unwrapElectronIpcError(raw) as UnwrappedIpcError;

    expect(unwrapped.code).toBe(1234);
    expect(unwrapped.data).toEqual({ foo: 'bar' });
  });

  it('preserves key and info fields from serialized OneKeyError payload', () => {
    const serialized = new OneKeyLocalError({
      key: ETranslations.global_request_limit,
      info: { amount: 12, unit: 'USDT' },
    }).serialize();
    const raw = buildIpcError(JSON.stringify(serialized));

    const unwrapped = unwrapElectronIpcError(raw) as UnwrappedIpcError;

    expect(unwrapped.key).toBe(ETranslations.global_request_limit);
    expect(unwrapped.info).toEqual({ amount: 12, unit: 'USDT' });
    expect((unwrapped as { cause?: unknown }).cause).toBe(raw);
  });

  it('falls back to plain text when payload is not JSON', () => {
    const raw = buildIpcError('Error: something went wrong');

    const unwrapped = unwrapElectronIpcError(raw) as Error;

    expect(unwrapped).not.toBe(raw);
    expect(unwrapped.message).toBe('something went wrong');
    expect((unwrapped as { cause?: unknown }).cause).toBe(raw);
  });

  it('falls back to raw tail when payload JSON has no message field', () => {
    const raw = buildIpcError(JSON.stringify({ code: 1 }));

    const unwrapped = unwrapElectronIpcError(raw) as Error;

    // JSON.stringify produces `{"code":1}` — no "Error: " prefix to strip.
    expect(unwrapped.message).toBe('{"code":1}');
  });

  it('returns non-IPC errors unchanged', () => {
    const raw = new Error('regular error');
    expect(unwrapElectronIpcError(raw)).toBe(raw);
  });

  it('returns non-Error inputs unchanged', () => {
    expect(unwrapElectronIpcError(undefined)).toBeUndefined();
    expect(unwrapElectronIpcError(null)).toBeNull();
    expect(unwrapElectronIpcError('plain string')).toBe('plain string');
    expect(unwrapElectronIpcError(42)).toBe(42);
  });

  it('ignores Error objects without a string message', () => {
    const weird = { name: 'X' } as unknown as Error;
    expect(unwrapElectronIpcError(weird)).toBe(weird);
  });
});

describe('resolveErrorI18nMessage', () => {
  const formatMessage = jest.fn(
    (descriptor: { id?: unknown }, values?: Record<string, string | number>) =>
      `TRANSLATED:${String(descriptor?.id)}${
        values ? `:${JSON.stringify(values)}` : ''
      }`,
  );
  const intl = { formatMessage } as unknown as Parameters<
    typeof resolveErrorI18nMessage
  >[1];

  beforeEach(() => {
    formatMessage.mockClear();
  });

  it('translates when message is an ETranslations enum value', () => {
    const err = new Error(
      ETranslations.update_installation_package_possibly_compromised,
    );

    const result = resolveErrorI18nMessage(err, intl);

    expect(formatMessage).toHaveBeenCalledWith(
      { id: ETranslations.update_installation_package_possibly_compromised },
      undefined,
    );
    expect(result).toBe(
      `TRANSLATED:${ETranslations.update_installation_package_possibly_compromised}`,
    );
  });

  it('translates when key is an ETranslations enum value', () => {
    const err = {
      key: ETranslations.update_installation_package_possibly_compromised,
      message: 'Unknown Onekey Internal Error. onekey_error',
    };

    const result = resolveErrorI18nMessage(err, intl);

    expect(formatMessage).toHaveBeenCalledWith(
      { id: ETranslations.update_installation_package_possibly_compromised },
      undefined,
    );
    expect(result).toBe(
      `TRANSLATED:${ETranslations.update_installation_package_possibly_compromised}`,
    );
  });

  it('passes i18n params through when translating with key', () => {
    const err = {
      key: ETranslations.global_request_limit,
      info: { amount: 12, unit: 'USDT' },
      message: 'Unknown Onekey Internal Error. onekey_error',
    };

    const result = resolveErrorI18nMessage(err, intl);

    expect(formatMessage).toHaveBeenCalledWith(
      { id: ETranslations.global_request_limit },
      { amount: 12, unit: 'USDT' },
    );
    expect(result).toBe(
      'TRANSLATED:global.request_limit:{"amount":12,"unit":"USDT"}',
    );
  });

  it('returns raw message when it is not an i18n key', () => {
    const err = new Error('plain failure');
    expect(resolveErrorI18nMessage(err, intl)).toBe('plain failure');
    expect(formatMessage).not.toHaveBeenCalled();
  });

  it('returns empty string for nullish input', () => {
    expect(resolveErrorI18nMessage(null, intl)).toBe('');
    expect(resolveErrorI18nMessage(undefined, intl)).toBe('');
  });

  it('stringifies non-Error inputs as a fallback', () => {
    expect(resolveErrorI18nMessage('just a string', intl)).toBe(
      'just a string',
    );
  });

  it('does NOT translate a dot-separated string that is not a known key', () => {
    const err = new Error('some.unknown.key');
    expect(resolveErrorI18nMessage(err, intl)).toBe('some.unknown.key');
    expect(formatMessage).not.toHaveBeenCalled();
  });
});
