import { ENFTType } from '@onekeyhq/shared/types/nft';
import {
  EParseTxComponentType,
  ETransferDirection,
} from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IDisplayComponentAddress,
  IDisplayComponentInternalAssets,
  IDisplayComponentNFT,
  IDisplayComponentSimulation,
  IDisplayComponentToken,
} from '@onekeyhq/shared/types/signatureConfirm';

import {
  SIMULATION_GROUP_FALLBACK_ID,
  getAddressRiskStatus,
  getParserAlertDisplay,
  getShownSimulationAssetNetworkId,
  getSimulationAssetAmount,
  getSimulationAssetIconProps,
  getSimulationAssetLabel,
  getSimulationAssetSign,
  getSimulationGroups,
  normalizeSecurityFindingTitle,
  shouldHideGenericPermitAlert,
  shouldShowNoIssueSection,
} from './utils';

function buildTokenAsset(
  overrides: Partial<IDisplayComponentToken> = {},
): IDisplayComponentToken {
  return {
    type: EParseTxComponentType.Token,
    label: 'Send',
    token: {
      info: {
        decimals: 18,
        name: 'Ethereum',
        symbol: 'ETH',
        address: '',
        logoURI: 'https://example.com/eth.png',
        isNative: true,
        networkId: 'evm--1',
      },
      balance: '0',
      balanceParsed: '0',
      fiatValue: '0',
      price: 0,
    },
    amount: '1000000000000000000',
    amountParsed: '1',
    networkId: 'evm--1',
    showNetwork: false,
    ...overrides,
  };
}

function buildNFTAsset(
  overrides: Partial<IDisplayComponentNFT> = {},
  nftOverrides: Partial<IDisplayComponentNFT['nft']> = {},
): IDisplayComponentNFT {
  return {
    type: EParseTxComponentType.NFT,
    label: 'Send',
    nft: {
      amount: '1',
      collectionAddress: '0xcollection',
      collectionName: 'Cool Cats',
      collectionSymbol: 'COOL',
      collectionType: ENFTType.ERC721,
      itemId: '42',
      networkId: 'evm--1',
      metadata: {
        description: '',
        externalUrl: '',
        itemUrl: '',
        image: 'https://example.com/cat.png',
        name: 'Cool Cat #42',
      },
      ...nftOverrides,
    },
    networkId: 'evm--1',
    amount: '1',
    showNetwork: false,
    ...overrides,
  };
}

function buildInternalAsset(
  overrides: Partial<IDisplayComponentInternalAssets> = {},
): IDisplayComponentInternalAssets {
  return {
    type: EParseTxComponentType.InternalAssets,
    label: 'Send',
    name: 'Ethereum',
    icon: 'https://example.com/eth.png',
    symbol: 'ETH',
    amount: '1000000000000000000',
    amountParsed: '1',
    networkId: 'evm--1',
    ...overrides,
  };
}

function buildAddressComponent(
  overrides: Partial<IDisplayComponentAddress> = {},
): IDisplayComponentAddress {
  return {
    type: EParseTxComponentType.Address,
    label: 'Recipient',
    address: '0xrecipient',
    tags: [],
    ...overrides,
  };
}

describe('SecurityCheckCard finding title display', () => {
  it('removes trailing periods and exclamation marks but keeps questions', () => {
    expect(normalizeSecurityFindingTitle('Scam address.')).toBe('Scam address');
    expect(normalizeSecurityFindingTitle('诈骗地址。')).toBe('诈骗地址');
    expect(normalizeSecurityFindingTitle('Malicious site!')).toBe(
      'Malicious site',
    );
    expect(normalizeSecurityFindingTitle('恶意网站！')).toBe('恶意网站');
    expect(normalizeSecurityFindingTitle('Proceed?')).toBe('Proceed?');
    expect(normalizeSecurityFindingTitle('继续？')).toBe('继续？');
  });
});

describe('SecurityCheckCard parser alert display', () => {
  it('does not split a long alert on an abbreviation or decimal', () => {
    const alerts = [
      'Approval to spend U.S. Dollar Coin (USDC) will be granted to an unverified spender address.',
      'The request transfers 0.5 ETH to an unverified recipient. Confirm the amount and recipient before continuing.',
    ];
    alerts.forEach((alert) => {
      expect(alert.length).toBeGreaterThan(80);
      expect(getParserAlertDisplay(alert)).toEqual({ title: alert });
    });
  });

  it('splits a long alert at a high-confidence sentence boundary', () => {
    const alert =
      'This approval grants unlimited access to your USDC! The spender is unverified and may transfer all of your funds.';

    expect(getParserAlertDisplay(alert)).toEqual({
      title: 'This approval grants unlimited access to your USDC!',
      description:
        'The spender is unverified and may transfer all of your funds.',
    });
  });
});

describe('SecurityCheckCard confirmation finding', () => {
  it('hides the generic Permit warning only for a verified site', () => {
    const genericPermitAlert =
      'Malicious signatures may result in asset loss. Ensure the dApp is trustworthy.';

    expect(
      shouldHideGenericPermitAlert({
        alert: genericPermitAlert,
        genericPermitAlert,
        isPermitSignMethod: true,
        isSiteVerified: true,
      }),
    ).toBe(true);
    expect(
      shouldHideGenericPermitAlert({
        alert: genericPermitAlert,
        genericPermitAlert,
        isPermitSignMethod: true,
        isSiteVerified: false,
      }),
    ).toBe(false);
    expect(
      shouldHideGenericPermitAlert({
        alert: '',
        genericPermitAlert: '',
        isPermitSignMethod: true,
        isSiteVerified: true,
      }),
    ).toBe(false);
    expect(
      shouldHideGenericPermitAlert({
        alert: 'The spender is known to be malicious.',
        genericPermitAlert,
        isPermitSignMethod: true,
        isSiteVerified: true,
      }),
    ).toBe(false);
  });
});

describe('SecurityCheckCard address risk boundaries', () => {
  it.each(['warning', 'critical'] as const)(
    'detects %s tags kept on the address row',
    (displayType) => {
      expect(
        getAddressRiskStatus([
          buildAddressComponent({
            tags: [{ value: 'Risk address', displayType }],
          }),
        ]),
      ).toBe(displayType);
    },
  );

  it.each(['info', 'success'] as const)(
    'does not treat %s address tags as risk',
    (displayType) => {
      expect(
        getAddressRiskStatus([
          buildAddressComponent({
            tags: [{ value: 'Known address', displayType }],
          }),
        ]),
      ).toBeUndefined();
    },
  );

  it('ignores non-address components', () => {
    expect(getAddressRiskStatus([buildTokenAsset()])).toBeUndefined();
  });

  it('uses the highest address risk severity', () => {
    expect(
      getAddressRiskStatus([
        buildAddressComponent({
          tags: [
            { value: 'Suspicious address', displayType: 'warning' },
            { value: 'Malicious address', displayType: 'critical' },
          ],
        }),
      ]),
    ).toBe('critical');
  });

  it('shows the global success verdict only for resolved, covered checks', () => {
    expect(
      shouldShowNoIssueSection({
        hasCardFindings: false,
        hasResolvedRequiredChecks: true,
      }),
    ).toBe(true);
    expect(
      shouldShowNoIssueSection({
        hasCardFindings: true,
        hasResolvedRequiredChecks: true,
      }),
    ).toBe(false);
    expect(
      shouldShowNoIssueSection({
        hasCardFindings: false,
        hasResolvedRequiredChecks: false,
      }),
    ).toBe(false);
    expect(
      shouldShowNoIssueSection({
        hasCardFindings: false,
        hasResolvedRequiredChecks: true,
        isSecurityCheckPending: true,
      }),
    ).toBe(false);
  });
});

describe('SecurityCheckCard simulation asset display rules', () => {
  describe('getSimulationAssetLabel', () => {
    it.each([
      ['token uses symbol', buildTokenAsset(), 'ETH'],
      ['nft prefers metadata name', buildNFTAsset(), 'Cool Cat #42'],
      [
        'nft falls back to collection name',
        buildNFTAsset({}, { metadata: undefined }),
        'Cool Cats',
      ],
      [
        'nft falls back to literal NFT',
        buildNFTAsset({}, { metadata: undefined, collectionName: '' }),
        'NFT',
      ],
      [
        'internal nft asset prefers name',
        buildInternalAsset({ isNFT: true, name: 'Punk #1', symbol: 'PUNK' }),
        'Punk #1',
      ],
      [
        'internal nft asset falls back to symbol then NFT',
        buildInternalAsset({ isNFT: true, name: '', symbol: '' }),
        'NFT',
      ],
      [
        'internal fungible asset prefers symbol',
        buildInternalAsset({ symbol: 'ETH', name: 'Ethereum' }),
        'ETH',
      ],
      [
        'internal fungible asset falls back to name',
        buildInternalAsset({ symbol: '', name: 'Ethereum' }),
        'Ethereum',
      ],
    ])('%s', (_title, asset, expected) => {
      expect(getSimulationAssetLabel(asset)).toBe(expected);
    });
  });

  describe('getSimulationAssetAmount', () => {
    it.each([
      ['token uses parsed amount', buildTokenAsset(), '1'],
      [
        'token never exposes a raw base-unit amount',
        buildTokenAsset({ amountParsed: '', amount: '2' }),
        '',
      ],
      [
        'token keeps a missing parsed amount empty',
        buildTokenAsset({ amountParsed: undefined, amount: '2' }),
        '',
      ],
      // Canonical Assets.tsx rule: a unique (non-ERC1155) NFT shows no
      // numeric quantity, an ERC1155 keeps its stack size.
      ['erc721 nft hides amount', buildNFTAsset({ amount: '1' }), ''],
      [
        'erc1155 nft keeps amount',
        buildNFTAsset({ amount: '5' }, { collectionType: ENFTType.ERC1155 }),
        '5',
      ],
      [
        'internal erc721 nft hides amount',
        buildInternalAsset({ isNFT: true, NFTType: ENFTType.ERC721 }),
        '',
      ],
      [
        'internal nft without NFTType hides amount',
        buildInternalAsset({ isNFT: true }),
        '',
      ],
      [
        'internal erc1155 nft keeps amount',
        buildInternalAsset({
          isNFT: true,
          NFTType: ENFTType.ERC1155,
          amountParsed: '3',
        }),
        '3',
      ],
      ['internal fungible uses parsed amount', buildInternalAsset(), '1'],
      [
        'internal fungible never exposes a raw base-unit amount',
        buildInternalAsset({ amountParsed: '', amount: '4' }),
        '',
      ],
      [
        'internal fungible keeps a missing parsed amount empty',
        buildInternalAsset({ amountParsed: undefined, amount: '4' }),
        '',
      ],
    ])('%s', (_title, asset, expected) => {
      expect(getSimulationAssetAmount(asset)).toBe(expected);
    });
  });

  describe('getSimulationAssetSign', () => {
    it.each([
      ['incoming token', ETransferDirection.In, '+'],
      ['outgoing token', ETransferDirection.Out, '-'],
      ['no direction', undefined, ''],
    ])('%s', (_title, transferDirection, expected) => {
      expect(
        getSimulationAssetSign(buildTokenAsset({ transferDirection })),
      ).toBe(expected);
    });

    it('keeps the lone sign for an outgoing unique NFT (amount hidden)', () => {
      const asset = buildNFTAsset({
        transferDirection: ETransferDirection.Out,
      });
      // Assets.tsx renders the direction sign unconditionally and hides only
      // the numeric amount, so the row still reads as leaving the wallet.
      expect(getSimulationAssetSign(asset)).toBe('-');
      expect(getSimulationAssetAmount(asset)).toBe('');
    });
  });

  describe('getShownSimulationAssetNetworkId', () => {
    it.each([
      [
        'hidden when showNetwork is false',
        buildTokenAsset({ showNetwork: false }),
        undefined,
      ],
      [
        'token prefers component networkId',
        buildTokenAsset({ showNetwork: true, networkId: 'evm--10' }),
        'evm--10',
      ],
      [
        'token falls back to token info networkId',
        buildTokenAsset({ showNetwork: true, networkId: undefined }),
        'evm--1',
      ],
      [
        'nft falls back to nft networkId',
        buildNFTAsset({ showNetwork: true, networkId: undefined }),
        'evm--1',
      ],
      // IDisplayComponentInternalAssets has no showNetwork field, so the
      // compact preview never shows a network line for it.
      ['internal assets never show network', buildInternalAsset(), undefined],
    ])('%s', (_title, asset, expected) => {
      expect(getShownSimulationAssetNetworkId(asset)).toBe(expected);
    });
  });

  describe('getSimulationAssetIconProps', () => {
    it('maps token icon props', () => {
      expect(getSimulationAssetIconProps(buildTokenAsset())).toEqual({
        tokenImageUri: 'https://example.com/eth.png',
        networkId: 'evm--1',
        showNetworkIcon: false,
      });
    });

    it('maps nft icon props', () => {
      expect(getSimulationAssetIconProps(buildNFTAsset())).toEqual({
        isNFT: true,
        tokenImageUri: 'https://example.com/cat.png',
        networkId: 'evm--1',
        showNetworkIcon: false,
      });
    });

    it('maps internal asset icon props', () => {
      expect(
        getSimulationAssetIconProps(buildInternalAsset({ isNFT: true })),
      ).toEqual({
        isNFT: true,
        tokenImageUri: 'https://example.com/eth.png',
        networkId: 'evm--1',
        showNetworkIcon: false,
      });
    });
  });

  describe('getSimulationGroups', () => {
    const buildSimulation = (
      label: string,
      assets: IDisplayComponentSimulation['assets'],
    ): IDisplayComponentSimulation => ({
      type: EParseTxComponentType.Simulation,
      label,
      assets,
    });

    it('drops empty groups and keeps backend labels', () => {
      const groups = getSimulationGroups([
        buildSimulation('Estimated changes', [buildTokenAsset()]),
        buildSimulation('Empty', []),
      ]);
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe('Estimated changes');
    });

    it('falls back to the shared id when the label is empty', () => {
      const groups = getSimulationGroups([
        buildSimulation('', [buildTokenAsset()]),
      ]);
      expect(groups[0].label).toBe(SIMULATION_GROUP_FALLBACK_ID);
    });

    it('keeps duplicate labels distinct via the index suffix', () => {
      const groups = getSimulationGroups([
        buildSimulation('Send', [buildTokenAsset()]),
        buildSimulation('Send', [buildNFTAsset()]),
      ]);
      expect(groups).toHaveLength(2);
      expect(new Set(groups.map((group) => group.id)).size).toBe(2);
    });

    it('returns an empty list without simulation components', () => {
      expect(getSimulationGroups(undefined)).toEqual([]);
    });
  });
});
