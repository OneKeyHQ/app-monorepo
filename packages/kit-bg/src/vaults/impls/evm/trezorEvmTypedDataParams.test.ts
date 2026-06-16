import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { buildTrezorEvmTypedDataParams } from './trezorEvmTypedDataParams';

const typedData = {
  types: {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Mail: [{ name: 'contents', type: 'string' }],
  },
  primaryType: 'Mail',
  domain: { name: 'Ether Mail' },
  message: { contents: 'Hello' },
};

describe('buildTrezorEvmTypedDataParams', () => {
  it('builds parsed data and hashes for typed-data v4 hardware signing', () => {
    const params = buildTrezorEvmTypedDataParams({
      type: EMessageTypesEth.TYPED_DATA_V4,
      message: JSON.stringify(typedData),
    });

    expect(params.data).toEqual(typedData);
    expect(params.metamaskV4Compat).toBe(true);
    expect(params.domainSeparatorHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(params.messageHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('marks typed-data v3 as non-v4 while keeping the same hash field names', () => {
    const params = buildTrezorEvmTypedDataParams({
      type: EMessageTypesEth.TYPED_DATA_V3,
      message: JSON.stringify(typedData),
    });

    expect(params.metamaskV4Compat).toBe(false);
    expect(params.domainSeparatorHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(params.messageHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('omits messageHash for domain-only typed-data', () => {
    const domainOnlyTypedData = {
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }],
        Mail: [{ name: 'contents', type: 'string' }],
      },
      primaryType: 'EIP712Domain',
      domain: { name: 'Ether Mail' },
      message: { contents: 'ignored' },
    };
    const params = buildTrezorEvmTypedDataParams({
      type: EMessageTypesEth.TYPED_DATA_V4,
      message: JSON.stringify(domainOnlyTypedData),
    });

    expect(params.domainSeparatorHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(params.messageHash).toBeUndefined();
  });
});
