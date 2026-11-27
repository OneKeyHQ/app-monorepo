import { OneKeyLocalError } from '../errors';

type IPackagedLocaleIndex = Readonly<
  Record<string, Readonly<{ path: string; sha256: string; byteLength: number }>>
>;

// Only protected extension page and background compilers supply this index.
// Ordinary platform builds continue using the original JSON module imports.
export function createPackagedLocaleLoader(index: IPackagedLocaleIndex) {
  for (const [name, entry] of Object.entries(index)) {
    if (
      !/^[a-zA-Z0-9_]+\.json$/.test(name) ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) ||
      entry.path !==
        `static/locales/${name.slice(0, -5)}.${entry.sha256}.json` ||
      !Number.isSafeInteger(entry.byteLength) ||
      entry.byteLength <= 0
    ) {
      throw new OneKeyLocalError('Invalid packaged locale index');
    }
    Object.freeze(entry);
  }
  Object.freeze(index);

  const cache = new Map<string, Promise<Record<string, string>>>();
  const readMessages = async (
    name: string,
  ): Promise<Record<string, string>> => {
    if (!Object.hasOwn(index, name)) {
      throw new OneKeyLocalError('Unknown packaged locale');
    }
    const entry = index[name];
    const id = chrome.runtime.id;
    if (!/^[a-p]{32}$/.test(id)) {
      throw new OneKeyLocalError(
        'Packaged locales require an extension runtime',
      );
    }
    const url = `chrome-extension://${id}/${entry.path}`;
    if (chrome.runtime.getURL(entry.path) !== url) {
      throw new OneKeyLocalError(
        'Packaged locale URL does not belong to this extension',
      );
    }
    const response = await fetch(url, {
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok || response.redirected || response.url !== url) {
      throw new OneKeyLocalError('Failed to read packaged locale');
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== entry.byteLength) {
      throw new OneKeyLocalError('Packaged locale size mismatch');
    }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('');
    if (hash !== entry.sha256) {
      throw new OneKeyLocalError('Packaged locale integrity mismatch');
    }
    // Parse the verified bytes directly. Do not merge locale properties into
    // another object: JSON's own __proto__ property must remain plain data.
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    ) as Record<string, string>;
  };

  // Match JSON module identity across aliases and upper-level cache resets.
  // Failed integrity or I/O checks are never retained and can be retried.
  return (name: string): Promise<Record<string, string>> => {
    const cached = cache.get(name);
    if (cached) {
      return cached;
    }
    const pending = readMessages(name).catch((error: unknown) => {
      if (cache.get(name) === pending) {
        cache.delete(name);
      }
      throw error;
    });
    cache.set(name, pending);
    return pending;
  };
}
