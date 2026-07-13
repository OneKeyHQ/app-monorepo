import { createKeychainStorageMock } from '../keychain-storage.mock';

describe('keychain-storage.mock', () => {
  it('stores and reads buffers by key', async () => {
    const storage = createKeychainStorageMock();
    await storage.set('bot-wallet/master-key', Buffer.from('secret'));

    await expect(storage.get('bot-wallet/master-key')).resolves.toEqual(
      Buffer.from('secret'),
    );
  });

  it('returns defensive buffer copies', async () => {
    const storage = createKeychainStorageMock();
    const input = Buffer.from('abc');
    await storage.set('key', input);
    input.fill(0);

    const output = await storage.get('key');
    output?.fill(1);

    await expect(storage.get('key')).resolves.toEqual(Buffer.from('abc'));
  });

  it('deletes entries idempotently', async () => {
    const storage = createKeychainStorageMock([['key', Buffer.from('value')]]);

    await storage.delete('key');
    await storage.delete('key');

    await expect(storage.get('key')).resolves.toBeNull();
    expect(storage.has('key')).toBe(false);
  });
});
