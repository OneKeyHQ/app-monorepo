import { encodeSensitiveTextAsync } from '@onekeyhq/core/src/secret';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import StarknetVault from './Vault';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

function buildVault() {
  const vault = Object.create(StarknetVault.prototype) as StarknetVault;
  vault.networkId = 'starknet--mainnet';
  return vault;
}

describe('Starknet import validation', () => {
  it('offers all supported account types for a valid Stark private key', async () => {
    const result = await buildVault().validateGeneralInput({
      input: await encodeSensitiveTextAsync({ text: '0x1' }),
      validatePrivateKey: true,
    });

    expect(result.isValid).toBe(true);
    expect(
      result.deriveInfoItems?.map(({ label, addressEncoding }) => [
        label,
        addressEncoding,
      ]),
    ).toEqual([
      ['Argent', undefined],
      ['OpenZeppelin', EAddressEncodings.STARKNET_OZ],
    ]);
  });

  it('leaves the selector hidden for an invalid private key', async () => {
    const result = await buildVault().validateGeneralInput({
      input: await encodeSensitiveTextAsync({ text: '0x0' }),
      validatePrivateKey: true,
    });

    expect(result.isValid).toBe(false);
    expect(result.deriveInfoItems).toBeUndefined();
  });

  it('leaves the selector hidden when importing an address to watch', async () => {
    const result = await buildVault().validateGeneralInput({
      input: await encodeSensitiveTextAsync({ text: '0x123' }),
      validateAddress: true,
    });

    expect(result.isValid).toBe(true);
    expect(result.deriveInfoItems).toBeUndefined();
  });
});
