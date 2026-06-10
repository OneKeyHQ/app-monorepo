import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { buildEvmTypedDataHardwareParams } from './evmTypedDataHardwareUtils';

const typedData = {
  types: {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Mail: [{ name: 'contents', type: 'string' }],
  },
  primaryType: 'Mail',
  domain: { name: 'Ether Mail' },
  message: { contents: 'Hello' },
};

describe('buildEvmTypedDataHardwareParams', () => {
  it('builds shared parsed data and hashes for typed-data v4 hardware signing', () => {
    const params = buildEvmTypedDataHardwareParams({
      type: EMessageTypesEth.TYPED_DATA_V4,
      message: JSON.stringify(typedData),
    });

    expect(params.data).toEqual(typedData);
    expect(params.metamaskV4Compat).toBe(true);
    expect(params.domainHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(params.messageHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(params.domainSeparatorHash).toBe(params.domainHash);
  });

  it('marks typed-data v3 as non-v4 while keeping the same hash field names', () => {
    const params = buildEvmTypedDataHardwareParams({
      type: EMessageTypesEth.TYPED_DATA_V3,
      message: JSON.stringify(typedData),
    });

    expect(params.metamaskV4Compat).toBe(false);
    expect(params.domainHash).toMatch(/^[0-9a-f]{64}$/u);
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
    const params = buildEvmTypedDataHardwareParams({
      type: EMessageTypesEth.TYPED_DATA_V4,
      message: JSON.stringify(domainOnlyTypedData),
    });

    expect(params.domainHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(params.domainSeparatorHash).toBe(params.domainHash);
    expect(params.messageHash).toBeUndefined();
  });
});
