import { getAddressRiskCheckInputState } from './addressRiskCheckInputUtils';

describe('getAddressRiskCheckInputState', () => {
  test('allows a valid plain address', () => {
    expect(
      getAddressRiskCheckInputState({
        rawAddress: '0xabc',
        query: {
          input: '0xabc',
          validStatus: 'valid',
          validAddress: '0xABC',
        },
      }).checkAddress,
    ).toBe('0xABC');
  });

  test('allows a single resolved domain address', () => {
    expect(
      getAddressRiskCheckInputState({
        rawAddress: 'onekey.eth',
        query: {
          input: 'onekey.eth',
          validStatus: 'valid',
          resolveAddress: '0xresolved',
          resolveOptions: ['0xresolved'],
        },
      }).checkAddress,
    ).toBe('0xresolved');
  });

  test('requires a user choice for multiple resolved addresses', () => {
    const query = {
      input: 'onekey.eth',
      validStatus: 'valid' as const,
      resolveAddress: '0xfirst',
      resolveOptions: ['0xfirst', '0xsecond'],
    };

    expect(
      getAddressRiskCheckInputState({
        rawAddress: 'onekey.eth',
        query,
      }),
    ).toMatchObject({
      checkAddress: undefined,
      needsResolvedAddressSelection: true,
    });

    expect(
      getAddressRiskCheckInputState({
        rawAddress: 'onekey.eth',
        query,
        selectedResolvedAddress: '0xsecond',
      }),
    ).toMatchObject({
      checkAddress: '0xsecond',
      needsResolvedAddressSelection: false,
    });
  });

  test('blocks an unresolved domain', () => {
    expect(
      getAddressRiskCheckInputState({
        rawAddress: 'onekey.eth',
        query: {
          input: 'onekey.eth',
          validStatus: 'invalid',
        },
      }),
    ).toMatchObject({
      checkAddress: undefined,
      isInvalid: true,
    });
  });

  test('blocks a resolved domain when final validation is invalid', () => {
    expect(
      getAddressRiskCheckInputState({
        rawAddress: 'onekey.eth',
        query: {
          input: 'onekey.eth',
          validStatus: 'invalid',
          resolveAddress: '0xresolved',
          resolveOptions: ['0xresolved'],
        },
      }),
    ).toMatchObject({
      checkAddress: undefined,
      isInvalid: true,
    });
  });

  test('does not fall back to the raw domain without a resolved address', () => {
    expect(
      getAddressRiskCheckInputState({
        rawAddress: 'onekey.eth',
        query: {
          input: 'onekey.eth',
          validStatus: 'valid',
        },
      }),
    ).toMatchObject({
      checkAddress: undefined,
      isInvalid: true,
    });
  });

  test('keeps unknown plain-address validation checkable', () => {
    expect(
      getAddressRiskCheckInputState({
        rawAddress: '0xabc',
        query: {
          input: '0xabc',
          validStatus: 'unknown',
        },
      }),
    ).toMatchObject({
      checkAddress: '0xabc',
      isInvalid: false,
    });
  });

  test('does not send an unknown domain-like input to risk check', () => {
    expect(
      getAddressRiskCheckInputState({
        rawAddress: 'onekey.eth',
        query: {
          input: 'onekey.eth',
          validStatus: 'unknown',
        },
      }),
    ).toMatchObject({
      checkAddress: undefined,
      isInvalid: true,
    });
  });
});
