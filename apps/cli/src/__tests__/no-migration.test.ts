import { executeStatusPipeline } from '../commands/auth/_internal/status-pipeline';
import { executeGetAddressCommand } from '../commands/get-address';
import { VaultClientError } from '../infra/vault';
import { SignerSoftwareBase } from '../signer';

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
});
