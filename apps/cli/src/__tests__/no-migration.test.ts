import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { LEGACY_MNEMONIC_ACCOUNT } from '../commands/auth/_internal/logout-pipeline';
import { executeStatusPipeline } from '../commands/auth/_internal/status-pipeline';
import { executeGetAddressCommand } from '../commands/get-address';
import { VaultClientError } from '../infra/vault';
import { SignerSoftwareBase } from '../signer';

function listSourceFiles(dirPath: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') {
        files.push(...listSourceFiles(entryPath));
      }
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

describe('no silent migration from legacy wallet:default keychain entries', () => {
  afterEach(() => {
    process.exitCode = 0;
  });

  it('signer returns NOT_AUTHENTICATED without fetching service keys', async () => {
    const fetchKey = jest.fn(() => Promise.resolve({ keyBase64: 'key' }));
    const decryptCredential = jest.fn(() => Promise.resolve('hd'));
    const signer = new SignerSoftwareBase({
      decryptCredential,
      fetchKey,
      vaultClient: {
        atomicMutate: async () => {
          throw new VaultClientError('NOT_AUTHENTICATED');
        },
      },
    });

    await expect(signer.getHdCredential()).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
    });
    expect(fetchKey).not.toHaveBeenCalled();
    expect(decryptCredential).not.toHaveBeenCalled();
  });

  it('get-address returns NOT_AUTHENTICATED without reading legacy entries', async () => {
    const output = {
      error: jest.fn(),
      raw: jest.fn(),
      success: jest.fn(),
    };

    await executeGetAddressCommand(
      {},
      {
        output,
        vaultClient: {
          readOnly: async () => {
            throw new VaultClientError('NOT_AUTHENTICATED');
          },
        },
      },
    );

    expect(output.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_AUTHENTICATED' }),
    );
    expect(process.exitCode).toBe(1);
  });

  it('auth status propagates NOT_AUTHENTICATED without legacy fallback', async () => {
    await expect(
      executeStatusPipeline({
        vaultClient: {
          readOnly: async () => {
            throw new VaultClientError('NOT_AUTHENTICATED');
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
  });

  it('only references legacy mnemonic cleanup in auth cleanup production code', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const matches = [
      ...listSourceFiles(path.join(srcRoot, 'commands')),
      ...listSourceFiles(path.join(srcRoot, 'infra/vault')),
    ]
      .filter((filePath) =>
        readFileSync(filePath, 'utf-8').includes(LEGACY_MNEMONIC_ACCOUNT),
      )
      .map((filePath) => path.relative(srcRoot, filePath));

    expect(matches).toEqual([
      'commands/auth/_internal/legacy-keychain-cleanup.ts',
    ]);
  });
});
