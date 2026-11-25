import { resolvePsbtTaprootOwnedOutputs } from './resolvePsbtTaprootOwnedOutputs';

const accountAddress = 'bc1pselected';
const accountDerivation = {
  fullPath: "m/86'/0'/0'/0/7",
  pubkey: '033333333333333333333333333333333333333333333333333333333333333333',
};
const inscriptionDerivation = {
  fullPath: "m/86'/0'/0'/0/12",
  pubkey: '032222222222222222222222222222222222222222222222222222222222222222',
};

describe('resolvePsbtTaprootOwnedOutputs', () => {
  it('resolves a wallet-owned inscription output at a different derived address', () => {
    const resolveAddressDerivation = jest.fn((address: string) =>
      address === 'bc1pownedinscription' ? inscriptionDerivation : undefined,
    );

    const result = resolvePsbtTaprootOwnedOutputs({
      outputAddresses: ['bc1pexternal', 'bc1pownedinscription'],
      encodedOutputs: [
        { address: 'bc1pexternal', value: '1000' },
        {
          address: 'bc1pownedinscription',
          value: '546',
          payload: { isInscriptionStructure: true },
        },
      ],
      accountAddress,
      resolveAddressDerivation,
    });

    expect(result).toEqual([
      {
        index: 1,
        ...inscriptionDerivation,
      },
    ]);
    expect(resolveAddressDerivation).toHaveBeenCalledTimes(1);
    expect(resolveAddressDerivation).toHaveBeenCalledWith(
      'bc1pownedinscription',
    );
  });

  it('preserves the selected-account output behavior without a payload hint', () => {
    const resolveAddressDerivation = jest.fn(() => accountDerivation);

    const result = resolvePsbtTaprootOwnedOutputs({
      outputAddresses: ['bc1pexternal', accountAddress],
      encodedOutputs: [
        { address: 'bc1pexternal', value: '1000' },
        { address: accountAddress, value: '546' },
      ],
      accountAddress,
      resolveAddressDerivation,
    });

    expect(result).toEqual([{ index: 1, ...accountDerivation }]);
  });

  it('rejects a hinted output that has no wallet derivation', () => {
    const resolveAddressDerivation = jest.fn(() => undefined);

    const result = resolvePsbtTaprootOwnedOutputs({
      outputAddresses: ['bc1pexternal', 'bc1pnotowned'],
      encodedOutputs: [
        { address: 'bc1pexternal', value: '1000' },
        {
          address: 'bc1pnotowned',
          value: '546',
          payload: { isInscriptionStructure: true },
        },
      ],
      accountAddress,
      resolveAddressDerivation,
    });

    expect(result).toEqual([]);
  });

  it('rejects a wallet-owned output without an ownership hint', () => {
    const resolveAddressDerivation = jest.fn(() => inscriptionDerivation);

    const result = resolvePsbtTaprootOwnedOutputs({
      outputAddresses: ['bc1pexternal', 'bc1powned'],
      encodedOutputs: [
        { address: 'bc1pexternal', value: '1000' },
        { address: 'bc1powned', value: '546' },
      ],
      accountAddress,
      resolveAddressDerivation,
    });

    expect(result).toEqual([]);
    expect(resolveAddressDerivation).not.toHaveBeenCalled();
  });

  it('rejects a payload hint whose encoded address does not match the PSBT', () => {
    const resolveAddressDerivation = jest.fn(() => inscriptionDerivation);

    const result = resolvePsbtTaprootOwnedOutputs({
      outputAddresses: ['bc1pexternal', 'bc1pactual'],
      encodedOutputs: [
        { address: 'bc1pexternal', value: '1000' },
        {
          address: 'bc1pdifferent',
          value: '546',
          payload: { isInscriptionStructure: true },
        },
      ],
      accountAddress,
      resolveAddressDerivation,
    });

    expect(result).toEqual([]);
    expect(resolveAddressDerivation).not.toHaveBeenCalled();
  });

  it('does not annotate single-output transactions', () => {
    const resolveAddressDerivation = jest.fn(() => accountDerivation);

    const result = resolvePsbtTaprootOwnedOutputs({
      outputAddresses: [accountAddress],
      encodedOutputs: [{ address: accountAddress, value: '546' }],
      accountAddress,
      resolveAddressDerivation,
    });

    expect(result).toEqual([]);
    expect(resolveAddressDerivation).not.toHaveBeenCalled();
  });
});
