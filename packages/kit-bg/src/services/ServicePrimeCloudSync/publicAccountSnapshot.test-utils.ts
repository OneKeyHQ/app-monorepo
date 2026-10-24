import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

// Public BIP32 test vector, never used by production code.
export const PUBLIC_ACCOUNT_TEST_XFP =
  '12345678--xpub6C1HVMz946r433QEjZGpYYWYcspxXXBPys5PBGkmQboRXE6RLfFiStEkKbWKCZaPgDrzZh9nUEunxuiuy6MNdw23du2Ek7GoKYMJVH8eK5E';
export function publicAccountTestSnapshot(
  index = 0,
): ICloudPublicAccountSnapshot {
  return {
    schema: 'onekey-public-account',
    version: 1,
    capabilities: ['account-copy-v1'],
    wallet: { kind: 'hardware', xfp: PUBLIC_ACCOUNT_TEST_XFP, hidden: false },
    account: {
      impl: 'evm',
      type: 'simple',
      networkId: 'evm--1',
      coinType: '60',
      path: `m/44'/60'/0'/0/${index}`,
      pathIndex: index,
      template: "m/44'/60'/0'/0/$$INDEX$$",
      name: `Test ${index}`,
      address: '0x1111111111111111111111111111111111111111',
      pub: '',
    },
  };
}
