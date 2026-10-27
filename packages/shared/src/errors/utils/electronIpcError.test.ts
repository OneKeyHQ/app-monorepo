import { ETranslations } from '../../locale';

import {
  UnwrappedIpcError,
  attachDesktopIpcCallContext,
  getDesktopIpcCallContext,
  isUnwrappedIpcError,
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

  it('preserves RevenueCat cancellation when Electron prefixes a JSON error with Error', () => {
    const raw = buildIpcError(
      `Error: ${JSON.stringify({
        code: 1,
        message: 'Store purchase cancelled',
        data: { revenueCat: true, userCancelled: true },
      })}`,
    );

    expect(unwrapElectronIpcError(raw)).toMatchObject({
      message: 'Store purchase cancelled',
      code: 1,
      data: { revenueCat: true, userCancelled: true },
    });
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
  const translatedKey =
    ETranslations.update_installation_package_possibly_compromised;
  const formatMessage = jest.fn(
    (descriptor: { id?: unknown }) => `TRANSLATED:${String(descriptor?.id)}`,
  );
  const intl = {
    formatMessage,
    messages: {
      [translatedKey]: 'mock message',
    },
  } as unknown as Parameters<typeof resolveErrorI18nMessage>[1];

  beforeEach(() => {
    formatMessage.mockClear();
  });

  it('translates when message is an ETranslations enum value', () => {
    const err = new Error(translatedKey);

    const result = resolveErrorI18nMessage(err, intl);

    expect(formatMessage).toHaveBeenCalledWith({
      id: translatedKey,
    });
    expect(result).toBe(`TRANSLATED:${translatedKey}`);
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

describe('Desktop API IPC call context', () => {
  it('records the module and method on the rethrown error', () => {
    const error = attachDesktopIpcCallContext(
      unwrapElectronIpcError(buildIpcError('Error: keychain locked')),
      { module: 'storage', method: 'secureGetItemAsync' },
    );

    expect(error).toBeInstanceOf(UnwrappedIpcError);
    expect(getDesktopIpcCallContext(error)).toEqual({
      ipcModule: 'storage',
      ipcMethod: 'secureGetItemAsync',
    });
    expect(isUnwrappedIpcError(error)).toBe(true);
  });

  it('finds the context through wrapping errors', () => {
    const ipcError = attachDesktopIpcCallContext(new UnwrappedIpcError('x'), {
      module: 'storage',
      method: 'secureSetItemAsync',
    });
    const wrapper = new Error('outer') as Error & { cause?: unknown };
    wrapper.cause = ipcError;

    expect(getDesktopIpcCallContext(wrapper)).toEqual({
      ipcModule: 'storage',
      ipcMethod: 'secureSetItemAsync',
    });
    expect(isUnwrappedIpcError(wrapper)).toBe(true);
  });

  it('stops following causes after a few levels', () => {
    let error: Error & { cause?: unknown } = attachDesktopIpcCallContext(
      new UnwrappedIpcError('x'),
      { module: 'storage', method: 'secureGetItemAsync' },
    );
    for (let i = 0; i < 5; i += 1) {
      const wrapper = new Error(`wrapper ${i}`) as Error & { cause?: unknown };
      wrapper.cause = error;
      error = wrapper;
    }

    expect(getDesktopIpcCallContext(error)).toBeUndefined();
  });

  it('ignores names that are not plain identifiers', () => {
    const error = attachDesktopIpcCallContext(new UnwrappedIpcError('x'), {
      module: 'storage',
      method: 'secureGetItemAsync(key=session)',
    });

    expect(getDesktopIpcCallContext(error)).toBeUndefined();
    expect(error.ipcMethod).toBeUndefined();
  });

  it('leaves non-IPC errors, primitives and frozen errors alone', () => {
    const plain = new Error('plain');
    expect(getDesktopIpcCallContext(plain)).toBeUndefined();
    expect(isUnwrappedIpcError(plain)).toBe(false);
    expect(
      attachDesktopIpcCallContext('boom', {
        module: 'storage',
        method: 'secureGetItemAsync',
      }),
    ).toBe('boom');

    const frozen = Object.freeze(new UnwrappedIpcError('frozen'));
    expect(() =>
      attachDesktopIpcCallContext(frozen, {
        module: 'storage',
        method: 'secureGetItemAsync',
      }),
    ).not.toThrow();
    expect(getDesktopIpcCallContext(frozen)).toBeUndefined();
    expect(isUnwrappedIpcError(frozen)).toBe(true);
  });
});
