import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { buildSwapTokenNativeListSnapshot } from './SwapTokenSelectModal.nativeList';

import type {
  IdentityRow,
  NativeListTheme,
} from '@onekeyfe/react-native-native-list';

const theme: NativeListTheme = {
  background: '#ffffff',
  rowBackground: '#ffffff',
  rowSelectedBackground: '#eeeeee',
  subduedBackground: '#f5f5f5',
  strongBackground: '#dddddd',
  primaryText: '#111111',
  secondaryText: '#777777',
  disabledText: '#999999',
  iconSubdued: '#777777',
  separator: '#eeeeee',
  accent: '#333333',
  positive: '#008800',
  negative: '#cc0000',
};

function token(
  symbol: string,
  networkId: string,
  contractAddress: string,
): ISwapToken {
  return {
    symbol,
    name: `${symbol} token`,
    networkId,
    contractAddress,
    decimals: 6,
    logoURI: `https://example.com/${symbol}.png`,
    networkLogoURI: `https://example.com/${networkId}.png`,
    balanceParsed: '1234.5678',
    fiatValue: '42.5',
  };
}

function rows(
  snapshot: ReturnType<typeof buildSwapTokenNativeListSnapshot>['snapshot'],
) {
  return snapshot.rows.filter(
    (row): row is IdentityRow => row.type === 'identity',
  );
}

describe('Swap NativeList row adapter', () => {
  it('keeps result sections, Fuse highlighting, balances, and disabled network actions', () => {
    const selected = token('USDC', 'evm--1', '0x12345678901234567890');
    const other = token('ETH', 'evm--137', '0xabcdefabcdefabcdef');
    const result = {
      item: selected,
      refIndex: 0,
      matches: [{ key: 'symbol', value: 'USDC', indices: [[0, 1]] }],
    } as IFuseResult<ISwapToken>;
    const built = buildSwapTokenNativeListSnapshot({
      tokens: [result, other],
      theme,
      disabledNetworkIds: ['evm--137'],
      searchKeyword: 'US',
      isMediumScreen: false,
      isDesktopSelector: true,
      currencySymbol: '$',
      otherNetworkStartIndex: 1,
      warningIndex: -1,
      warningText: 'Unknown token',
      warningBorderWidth: 1,
      searchSectionTitles: {
        selectedNetwork: 'Tokens on Ethereum',
        otherNetworks: 'Tokens on other networks',
      },
    });
    expect(built.snapshot.rows.map((row) => row.type)).toEqual([
      'sectionHeader',
      'identity',
      'sectionHeader',
      'identity',
    ]);
    const [first, second] = rows(built.snapshot);
    expect(first?.titleMatch).toEqual([{ start: 0, end: 2 }]);
    expect(first?.tertiary).toBe('0x123456...567890');
    expect(first?.trailing?.[0]).toEqual(
      expect.objectContaining({
        kind: 'valuePair',
        secondary: expect.stringContaining('$'),
      }),
    );
    expect(second?.opacity).toBe(0.5);
    expect(second?.pressDisabled).toBeUndefined();
    expect(second?.trailing?.[1]).toEqual(
      expect.objectContaining({ actionKey: 'menu', disabled: undefined }),
    );
    expect(built.tokensByKey.get(second?.key ?? '')).toBe(other);
  });

  it('keeps native-token menu disabled and shows a matched free-fee badge', () => {
    const opposite = token('ETH', 'evm--1', '');
    const native = {
      ...token('USDC', 'evm--1', ''),
      isNative: true,
      freeFeeObject: {
        tag: '0 fee',
        tokenList: [
          { networkId: opposite.networkId, contractAddress: '', symbol: 'ETH' },
        ],
      },
    };
    const built = buildSwapTokenNativeListSnapshot({
      tokens: [native],
      theme,
      disabledNetworkIds: [],
      isMediumScreen: true,
      isDesktopSelector: false,
      currencySymbol: '$',
      oppositeToken: opposite,
      otherNetworkStartIndex: -1,
      warningIndex: -1,
      warningText: 'Unknown token',
      warningBorderWidth: 1,
    });
    const [row] = rows(built.snapshot);
    expect(row?.badges).toEqual([
      { key: 'fee', text: '0 fee', tone: 'success' },
    ]);
    expect(row?.trailing?.[1]).toEqual(
      expect.objectContaining({ actionKey: 'menu', disabled: true }),
    );
  });

  it('places the complete unverified warning before the first unknown token', () => {
    const built = buildSwapTokenNativeListSnapshot({
      tokens: [token('ETH', 'evm--1', ''), token('RISK', 'evm--1', '0xabc')],
      theme,
      disabledNetworkIds: [],
      isMediumScreen: true,
      isDesktopSelector: false,
      currencySymbol: '$',
      otherNetworkStartIndex: -1,
      warningIndex: 1,
      warningText: 'The complete localized risk warning.',
      warningBorderWidth: 0.5,
    });
    expect(built.snapshot.rows.map((row) => row.key)).toEqual([
      'token:evm--1::0',
      'warning-gap-before',
      'unverified-token-warning',
      'warning-gap-after',
      'token:evm--1:0xabc:1',
    ]);
    expect(built.snapshot.rows.map((row) => row.type)).toEqual([
      'identity',
      'system',
      'message',
      'system',
      'identity',
    ]);
    expect(built.snapshot.rows[2]).toEqual(
      expect.objectContaining({
        type: 'message',
        body: 'The complete localized risk warning.',
        bodyLines: 0,
        presentation: 'inlineWarning',
        pressDisabled: true,
        style: expect.objectContaining({
          container: expect.objectContaining({ borderWidth: 0.5 }),
        }),
      }),
    );
  });
});
