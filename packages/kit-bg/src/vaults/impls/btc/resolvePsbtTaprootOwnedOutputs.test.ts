import { resolvePsbtTaprootOwnedOutputs } from './resolvePsbtTaprootOwnedOutputs';

describe('resolvePsbtTaprootOwnedOutputs', () => {
  it('resolves inscription outputs owned by a different derived taproot address', async () => {
    const vault = {
      _getRelPathsToAddressByApi: jest.fn().mockResolvedValue({
        relPaths: ['0/12'],
        pathToAddresses: {
          "m/86'/0'/0'/0/12": {
            address: 'bc1pownedinscription',
            relPath: '0/12',
            fullPath: "m/86'/0'/0'/0/12",
          },
        },
        addressToPath: {
          bc1pownedinscription: {
            address: 'bc1pownedinscription',
            relPath: '0/12',
            fullPath: "m/86'/0'/0'/0/12",
          },
        },
      }),
    };
    const coreApi = {
      getAddressFromXpub: jest.fn().mockResolvedValue({
        addresses: {
          '0/12': 'bc1pownedinscription',
        },
        publicKeys: {
          '0/12':
            '032222222222222222222222222222222222222222222222222222222222222222',
        },
        xpubSegwit: 'xpub-segwit',
      }),
    };

    const result = await resolvePsbtTaprootOwnedOutputs({
      network: { maximumFeeRate: 1000 } as any,
      outputAddresses: ['bc1pexternal', 'bc1pownedinscription'],
      encodedTx: {
        outputs: [
          {
            address: 'bc1pexternal',
            value: '1000',
          },
          {
            address: 'bc1pownedinscription',
            value: '546',
            payload: {
              isInscriptionStructure: true,
            },
          },
        ],
      } as any,
      dbAccount: {
        address: 'bc1pselected',
        path: "m/86'/0'/0'",
        relPath: '0/7',
        pub: '033333333333333333333333333333333333333333333333333333333333333333',
        xpub: 'xpub-main',
        xpubSegwit: 'xpub-segwit',
      } as any,
      vault: vault as any,
      coreApi: coreApi as any,
    });

    expect(result).toEqual({
      1: {
        fullPath: "m/86'/0'/0'/0/12",
        pubkey:
          '032222222222222222222222222222222222222222222222222222222222222222',
      },
    });
    expect(vault._getRelPathsToAddressByApi).toHaveBeenCalledWith({
      addresses: ['bc1pownedinscription'],
      account: expect.objectContaining({
        address: 'bc1pselected',
      }),
      xpubSegwit: 'xpub-segwit',
    });
    expect(coreApi.getAddressFromXpub).toHaveBeenCalledWith({
      network: { maximumFeeRate: 1000 },
      xpub: 'xpub-main',
      relativePaths: ['0/12'],
    });
  });

  it('does not annotate single-output transactions', async () => {
    const vault = {
      _getRelPathsToAddressByApi: jest.fn(),
    };
    const coreApi = {
      getAddressFromXpub: jest.fn(),
    };

    const result = await resolvePsbtTaprootOwnedOutputs({
      network: { maximumFeeRate: 1000 } as any,
      outputAddresses: ['bc1powned'],
      encodedTx: {
        outputs: [
          {
            address: 'bc1powned',
            value: '546',
            payload: {
              isInscriptionStructure: true,
            },
          },
        ],
      } as any,
      dbAccount: {
        address: 'bc1powned',
        path: "m/86'/0'/0'",
        relPath: '0/0',
        pub: '033333333333333333333333333333333333333333333333333333333333333333',
        xpub: 'xpub-main',
      } as any,
      vault: vault as any,
      coreApi: coreApi as any,
    });

    expect(result).toEqual({});
    expect(vault._getRelPathsToAddressByApi).not.toHaveBeenCalled();
    expect(coreApi.getAddressFromXpub).not.toHaveBeenCalled();
  });
});
