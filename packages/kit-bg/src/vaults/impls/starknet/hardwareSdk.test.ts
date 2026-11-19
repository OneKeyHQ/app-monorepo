import {
  getStarknetHardwarePrivacySdk,
  getStarknetHardwareSdk,
} from './hardwareSdk';

function buildSdk() {
  return {
    starknetGetPublicKey: jest.fn(),
    starknetGetAddress: jest.fn(),
    starknetSignTransaction: jest.fn(),
  };
}

describe('Starknet hardware SDK boundary', () => {
  it('requires viewing-key export support only for privacy operations', () => {
    const sdk = buildSdk();
    expect(() => getStarknetHardwareSdk(sdk)).not.toThrow();
    expect(() => getStarknetHardwarePrivacySdk(sdk)).toThrow(
      'does not support Starknet hardware privacy',
    );
  });

  it('rejects malformed viewing-key payloads without including them in the error', async () => {
    const sdk = {
      ...buildSdk(),
      starknetExportPrivacyViewingKey: jest.fn(async () => ({
        success: true,
        payload: { viewingKey: 'malformed-test-value' },
      })),
    };
    await expect(
      getStarknetHardwarePrivacySdk(sdk).starknetExportPrivacyViewingKey(
        'c',
        'd',
        {},
      ),
    ).rejects.toThrow('Starknet: malformed hardware payload');
  });
  it('rejects older SDKs before any device call', () => {
    expect(() => getStarknetHardwareSdk({})).toThrow(
      'does not support Starknet',
    );
  });

  it.each([
    { pub: '0x01', path: 'm/1' },
    { pub: `0x${'ff'.repeat(32)}`, path: 'm/1' },
    { pub: `0x${'00'.repeat(31)}01` },
  ])('rejects malformed or noncanonical public keys', async (payload) => {
    const sdk = buildSdk();
    sdk.starknetGetPublicKey.mockResolvedValue({
      success: true,
      payload: [payload],
    });
    await expect(
      getStarknetHardwareSdk(sdk).starknetGetPublicKey('c', 'd', {
        bundle: [{ path: 'm/1' }],
      }),
    ).rejects.toThrow('malformed');
  });

  it.each(['0x1', `0x${'11'.repeat(65)}`, 'invalid'])(
    'rejects a malformed native Stark signature',
    async (signature) => {
      const sdk = buildSdk();
      sdk.starknetSignTransaction.mockResolvedValue({
        success: true,
        payload: { transactionHash: '0x1', signature },
      });
      await expect(
        getStarknetHardwareSdk(sdk).starknetSignTransaction('c', 'd', {}),
      ).rejects.toThrow('malformed');
    },
  );

  it('rejects a bundle with the wrong number of results', async () => {
    const sdk = buildSdk();
    sdk.starknetGetAddress.mockResolvedValue({ success: true, payload: [] });
    await expect(
      getStarknetHardwareSdk(sdk).starknetGetAddress('c', 'd', {
        bundle: [{ path: 'm/1' }],
      }),
    ).rejects.toThrow('malformed');
  });

  it('preserves device cancellation errors', async () => {
    const sdk = buildSdk();
    sdk.starknetSignTransaction.mockResolvedValue({
      success: false,
      payload: { error: 'Cancelled', code: 803 },
    });
    await expect(
      getStarknetHardwareSdk(sdk).starknetSignTransaction('c', 'd', {}),
    ).resolves.toEqual({
      success: false,
      payload: { error: 'Cancelled', code: 803 },
    });
  });
});
