import { ETranslations } from '../../locale';

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
    (descriptor: { id?: unknown }) => `TRANSLATED:${String(descriptor?.id)}`,
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

    expect(formatMessage).toHaveBeenCalledWith({
      id: ETranslations.update_installation_package_possibly_compromised,
    });
    expect(result).toBe(
      `TRANSLATED:${ETranslations.update_installation_package_possibly_compromised}`,
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
