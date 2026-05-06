import { createFsMock } from '../fs.mock';

describe('fs.mock', () => {
  it('writes and reads files through memfs', async () => {
    const fsMock = createFsMock();

    await fsMock.writeFile('/vault/vault.enc', Buffer.from('encrypted'));

    await expect(fsMock.readFile('/vault/vault.enc')).resolves.toEqual(
      Buffer.from('encrypted'),
    );
  });

  it('renames files and creates destination directories', async () => {
    const fsMock = createFsMock();
    await fsMock.writeFile('/tmp/vault.enc.tmp', 'payload');

    await fsMock.rename('/tmp/vault.enc.tmp', '/state/vault.enc');

    expect(fsMock.exists('/tmp/vault.enc.tmp')).toBe(false);
    expect(fsMock.exists('/state/vault.enc')).toBe(true);
  });

  it('unlinks files and exposes stat metadata', async () => {
    const fsMock = createFsMock();
    await fsMock.writeFile('/state/vault.enc', 'payload');

    const stat = await fsMock.stat('/state/vault.enc');
    expect(stat.size).toBe(7);

    await fsMock.unlink('/state/vault.enc');
    expect(fsMock.exists('/state/vault.enc')).toBe(false);
  });
});
