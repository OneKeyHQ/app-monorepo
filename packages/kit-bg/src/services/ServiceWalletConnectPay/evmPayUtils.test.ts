import {
  extractWcPayPersonalSignMessage,
  extractWcPayTypedDataMessage,
} from './evmPayUtils';

// yarn jest packages/kit-bg/src/services/ServiceWalletConnectPay/evmPayUtils.test.ts

const ADDRESS = '0x000000000000000000000000000000000000dEaD';

const validTypedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    PermitTransferFrom: [
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'PermitTransferFrom',
  domain: {
    name: 'Permit2',
    chainId: 8453,
    verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  },
  message: {
    spender: ADDRESS,
    nonce: '0',
    deadline: '1700000000',
  },
};

describe('extractWcPayTypedDataMessage', () => {
  it('accepts [address, jsonString] params and returns the string', () => {
    const json = JSON.stringify(validTypedData);
    expect(extractWcPayTypedDataMessage([ADDRESS, json])).toBe(json);
  });

  it('accepts a plain object payload and serializes it', () => {
    expect(extractWcPayTypedDataMessage([ADDRESS, validTypedData])).toBe(
      JSON.stringify(validTypedData),
    );
    expect(extractWcPayTypedDataMessage(validTypedData)).toBe(
      JSON.stringify(validTypedData),
    );
  });

  it('rejects a "{"-prefixed string that is not valid JSON', () => {
    expect(() =>
      extractWcPayTypedDataMessage([ADDRESS, '{not-json']),
    ).toThrow();
    expect(() =>
      extractWcPayTypedDataMessage([ADDRESS, '{"types": broken}']),
    ).toThrow();
  });

  it('rejects valid JSON missing the minimal EIP-712 structure', () => {
    const missingPrimaryType = { ...validTypedData, primaryType: undefined };
    expect(() =>
      extractWcPayTypedDataMessage([
        ADDRESS,
        JSON.stringify(missingPrimaryType),
      ]),
    ).toThrow();

    const missingDomain = { ...validTypedData, domain: undefined };
    expect(() =>
      extractWcPayTypedDataMessage([ADDRESS, JSON.stringify(missingDomain)]),
    ).toThrow();

    const missingMessage = { ...validTypedData, message: undefined };
    expect(() =>
      extractWcPayTypedDataMessage([ADDRESS, JSON.stringify(missingMessage)]),
    ).toThrow();

    // primaryType without a matching field list in `types` cannot be hashed
    const missingPrimaryTypeDef = {
      ...validTypedData,
      types: { EIP712Domain: validTypedData.types.EIP712Domain },
    };
    expect(() =>
      extractWcPayTypedDataMessage([
        ADDRESS,
        JSON.stringify(missingPrimaryTypeDef),
      ]),
    ).toThrow();

    // EIP712Domain field list is required for the domain hash
    const missingDomainTypes = {
      ...validTypedData,
      types: {
        PermitTransferFrom: validTypedData.types.PermitTransferFrom,
      },
    };
    expect(() =>
      extractWcPayTypedDataMessage([
        ADDRESS,
        JSON.stringify(missingDomainTypes),
      ]),
    ).toThrow();
  });

  it('rejects params with no object candidate at all', () => {
    expect(() => extractWcPayTypedDataMessage([ADDRESS])).toThrow();
    expect(() => extractWcPayTypedDataMessage(undefined)).toThrow();
    expect(() => extractWcPayTypedDataMessage([])).toThrow();
  });

  it('skips a broken string candidate but accepts a later valid object', () => {
    expect(extractWcPayTypedDataMessage(['{broken', validTypedData])).toBe(
      JSON.stringify(validTypedData),
    );
  });
});

describe('extractWcPayPersonalSignMessage', () => {
  it('extracts the message from [message, address]', () => {
    expect(
      extractWcPayPersonalSignMessage({
        parsed: ['hello', ADDRESS],
        accountAddress: ADDRESS,
      }),
    ).toBe('hello');
  });

  it('extracts the message from flipped [address, message]', () => {
    expect(
      extractWcPayPersonalSignMessage({
        parsed: [ADDRESS, 'hello'],
        accountAddress: ADDRESS,
      }),
    ).toBe('hello');
  });

  it('rejects params without a string message', () => {
    expect(() =>
      extractWcPayPersonalSignMessage({ parsed: [{}, {}] }),
    ).toThrow();
    expect(() =>
      extractWcPayPersonalSignMessage({ parsed: undefined }),
    ).toThrow();
  });
});
