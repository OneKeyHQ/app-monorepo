import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getStarknetHardwareSdk } from './hardwareSdk';

const accountParams = { path: 'm/1', chainId: '0x1' };
const bound = { maxAmount: '0x1', maxPricePerUnit: '0x1' };
const signParams = {
  ...accountParams,
  nonce: '0x0',
  resourceBounds: { l1Gas: bound, l2Gas: bound, l1DataGas: bound },
};

function buildSdk() {
  return {
    starknetGetPublicKey: jest.fn(),
    starknetGetAddress: jest.fn(),
    starknetSignTransaction: jest.fn(),
    starknetExportPrivacyViewingKey: jest.fn(),
  };
}

describe('Starknet hardware SDK boundary', () => {
  it('rejects malformed viewing-key payloads without including them in the error', async () => {
    const sdk = buildSdk();
    sdk.starknetExportPrivacyViewingKey.mockResolvedValue({
      success: true,
      payload: { viewingKey: 'malformed-test-value' },
    });
    await expect(
      getStarknetHardwareSdk(sdk).starknetExportPrivacyViewingKey('c', 'd', {
        ...accountParams,
        accountAddress: '0x1',
        poolAddress: '0x2',
      }),
    ).rejects.toMatchObject({
      key: ETranslations.hardware_communication_error,
    });
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
    ).rejects.toMatchObject({
      key: ETranslations.hardware_communication_error,
    });
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
        getStarknetHardwareSdk(sdk).starknetSignTransaction(
          'c',
          'd',
          signParams,
        ),
      ).rejects.toMatchObject({
        key: ETranslations.hardware_communication_error,
      });
    },
  );

  it('rejects a bundle with the wrong number of results', async () => {
    const sdk = buildSdk();
    sdk.starknetGetAddress.mockResolvedValue({ success: true, payload: [] });
    await expect(
      getStarknetHardwareSdk(sdk).starknetGetAddress('c', 'd', {
        bundle: [
          {
            path: 'm/1',
            classHash: '0x1',
            contractAddressSalt: '0x1',
            constructorCalldata: [],
          },
        ],
      }),
    ).rejects.toMatchObject({
      key: ETranslations.hardware_communication_error,
    });
  });

  it('preserves device cancellation errors', async () => {
    const sdk = buildSdk();
    sdk.starknetSignTransaction.mockResolvedValue({
      success: false,
      payload: { error: 'Cancelled', code: 803 },
    });
    await expect(
      getStarknetHardwareSdk(sdk).starknetSignTransaction('c', 'd', signParams),
    ).resolves.toEqual({
      success: false,
      payload: { error: 'Cancelled', code: 803 },
    });
  });
});
