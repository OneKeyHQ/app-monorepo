import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import {
  type IPerpsDepositToken,
  type IPerpsDepositTokensAtom,
  perpsDepositTokensAtom,
} from '../../states/jotai/atoms';

import ServiceWebviewPerp from './ServiceWebviewPerp';

let mockPerpsDepositTokensState: IPerpsDepositTokensAtom = { tokens: {} };

jest.mock('../../states/jotai/atoms', () => {
  const actual = jest.requireActual<typeof import('../../states/jotai/atoms')>(
    '../../states/jotai/atoms',
  );
  return {
    ...actual,
    perpsDepositTokensAtom: {
      get: jest.fn(async () => mockPerpsDepositTokensState),
      set: jest.fn(
        async (
          value:
            | IPerpsDepositTokensAtom
            | ((prev: IPerpsDepositTokensAtom) => IPerpsDepositTokensAtom),
        ) => {
          mockPerpsDepositTokensState =
            typeof value === 'function'
              ? value(mockPerpsDepositTokensState)
              : value;
        },
      ),
    },
  };
});

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundClass: () => (constructor: unknown) => constructor,
}));

jest.mock('p-timeout', () => ({
  __esModule: true,
  default: (promise: Promise<unknown>) => promise,
}));

type IFetchPerpsDepositTokenListDataUncached = (params: {
  ownerKey: string;
  allNetworksAccountId: string;
  ownerIndexId?: string;
  supportedNetworkIds: string[];
}) => Promise<{
  ownerKey: string;
  tokens: IPerpsDepositToken[];
  tokensByNetwork: Record<string, IPerpsDepositToken[]>;
}>;

type IUpdatePerpsDepositTokenListAtom = (data: {
  ownerKey: string;
  tokens: IPerpsDepositToken[];
  tokensByNetwork: Record<string, IPerpsDepositToken[]>;
}) => Promise<{
  tokens: IPerpsDepositToken[];
  tokensByNetwork: Record<string, IPerpsDepositToken[]>;
  selectedToken?: IPerpsDepositToken;
  isStale: boolean;
}>;

const makePerpsDepositToken = (
  overrides: Partial<IPerpsDepositToken> &
    Pick<IPerpsDepositToken, 'networkId' | 'contractAddress' | 'symbol'>,
): IPerpsDepositToken => ({
  name: overrides.symbol,
  decimals: 18,
  networkLogoURI: '',
  ...overrides,
});

const createDepositTokenPublisher = () => {
  const service = new ServiceWebviewPerp({ backgroundApi: {} });
  return (
    service as unknown as {
      updatePerpsDepositTokenListAtom: IUpdatePerpsDepositTokenListAtom;
    }
  ).updatePerpsDepositTokenListAtom.bind(service);
};

const makeFetchAccountTokensResponse = ({
  networkId,
  symbol,
  fiatValue,
}: {
  networkId: string;
  symbol: string;
  fiatValue: string;
}): IFetchAccountTokensResp => ({
  tokens: {
    data: [
      {
        $key: `${networkId}_`,
        networkId,
        address: '',
        name: symbol,
        symbol,
        decimals: 18,
        isNative: true,
      },
    ],
    keys: `${networkId}_`,
    map: {
      [`${networkId}_`]: {
        balance: '1',
        balanceParsed: '1',
        fiatValue,
        price: Number(fiatValue),
      },
    },
  },
  smallBalanceTokens: {
    data: [],
    keys: '',
    map: {},
  },
  riskTokens: {
    data: [],
    keys: '',
    map: {},
  },
});

describe('ServiceWebviewPerp', () => {
  afterEach(async () => {
    await perpsDepositTokensAtom.set({ tokens: {} });
  });

  it('keeps available deposit token networks when another supported network has no account', async () => {
    const ethNetworkId = 'evm--1';
    const solNetworkId = 'sol--101';
    const backgroundApi = {
      serviceNetwork: {
        getGlobalDeriveTypeOfNetwork: jest.fn().mockResolvedValue('default'),
        getNetworksByIds: jest.fn().mockResolvedValue({
          networks: [
            { id: ethNetworkId, logoURI: 'eth.png' },
            { id: solNetworkId, logoURI: 'sol.png' },
          ],
        }),
      },
      serviceAccount: {
        getNetworkAccount: jest.fn(async ({ networkId }) => {
          if (networkId === solNetworkId) {
            throw new OneKeyLocalError('Solana account has not been created');
          }
          return { id: 'evm-account-id' };
        }),
      },
      serviceToken: {
        fetchAccountTokens: jest.fn().mockResolvedValue(
          makeFetchAccountTokensResponse({
            networkId: ethNetworkId,
            symbol: 'ETH',
            fiatValue: '10',
          }),
        ),
      },
    };
    const service = new ServiceWebviewPerp({ backgroundApi });
    const fetchData = (
      service as unknown as {
        fetchPerpsDepositTokenListDataUncached: IFetchPerpsDepositTokenListDataUncached;
      }
    ).fetchPerpsDepositTokenListDataUncached.bind(service);

    const result = await fetchData({
      ownerKey: 'owner-key',
      allNetworksAccountId: 'all-networks-account-id',
      ownerIndexId: 'indexed-account-id',
      supportedNetworkIds: [ethNetworkId, solNetworkId],
    });

    expect(result.tokens.map((token) => token.symbol)).toEqual(['ETH']);
    expect(result.tokensByNetwork[ethNetworkId]).toEqual([
      expect.objectContaining({ symbol: 'ETH', fiatValue: '10' }),
    ]);
    expect(result.tokensByNetwork[solNetworkId]).toEqual([]);
  });

  it('publishes server defaults when the wallet token list is empty', async () => {
    const ownerKey = 'account-1::index-1';
    const defaultUsdc = makePerpsDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      symbol: 'USDC',
      decimals: 6,
      isDefault: true,
    });
    await perpsDepositTokensAtom.set({
      tokens: { 'evm--42161': [] },
      serverTokens: [defaultUsdc],
      defaultTokens: [defaultUsdc],
      depositTokenListOwnerKey: ownerKey,
    });

    const result = await createDepositTokenPublisher()({
      ownerKey,
      tokens: [],
      tokensByNetwork: { 'evm--42161': [] },
    });

    expect(result.tokens).toEqual([
      expect.objectContaining({
        ...defaultUsdc,
        balanceParsed: '0',
        fiatValue: '0',
      }),
    ]);
    expect(result.tokensByNetwork['evm--42161']).toEqual([
      expect.objectContaining({
        ...defaultUsdc,
        balanceParsed: '0',
        fiatValue: '0',
      }),
    ]);
    expect((await perpsDepositTokensAtom.get()).tokens['evm--42161']).toEqual([
      expect.objectContaining({
        ...defaultUsdc,
        balanceParsed: '0',
        fiatValue: '0',
      }),
    ]);
  });

  it('publishes the complete server token list when the wallet token list is empty', async () => {
    const ownerKey = 'account-1::index-1';
    const defaultEth = makePerpsDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      isDefault: true,
      isNative: true,
    });
    const serverUsdt = makePerpsDepositToken({
      networkId: 'evm--1',
      contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      symbol: 'USDT',
      decimals: 6,
    });
    const serverState: IPerpsDepositTokensAtom = {
      tokens: { 'evm--1': [defaultEth, serverUsdt] },
      serverTokens: [defaultEth, serverUsdt],
      defaultTokens: [defaultEth],
      depositTokenListOwnerKey: ownerKey,
    };
    await perpsDepositTokensAtom.set(serverState);

    const result = await createDepositTokenPublisher()({
      ownerKey,
      tokens: [],
      tokensByNetwork: { 'evm--1': [] },
    });

    expect(result.tokens.map((token) => token.symbol)).toEqual(['ETH', 'USDT']);
    expect(
      result.tokensByNetwork['evm--1'].map((token) => token.symbol),
    ).toEqual(['ETH', 'USDT']);
  });

  it('publishes wallet tokens first and appends missing server tokens', async () => {
    const ownerKey = 'account-1::index-1';
    const walletEth = makePerpsDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      balanceParsed: '0.2',
      fiatValue: '350',
      price: '1750',
      isNative: true,
    });
    const defaultUsdc = makePerpsDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      symbol: 'USDC',
      decimals: 6,
      isDefault: true,
    });
    await perpsDepositTokensAtom.set({
      tokens: { 'evm--1': [], 'evm--42161': [] },
      serverTokens: [defaultUsdc],
      defaultTokens: [defaultUsdc],
      depositTokenListOwnerKey: ownerKey,
    });

    const result = await createDepositTokenPublisher()({
      ownerKey,
      tokens: [walletEth],
      tokensByNetwork: {
        'evm--1': [walletEth],
        'evm--42161': [],
      },
    });

    expect(result.tokens.map((token) => token.symbol)).toEqual(['ETH', 'USDC']);
  });

  it('deduplicates defaults and keeps wallet values with the default marker', async () => {
    const ownerKey = 'account-1::index-1';
    const defaultEth = makePerpsDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      isDefault: true,
      isNative: true,
    });
    const walletEth = makePerpsDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      balanceParsed: '0.2',
      fiatValue: '350',
      price: '1750',
      isNative: true,
    });
    await perpsDepositTokensAtom.set({
      tokens: { 'evm--1': [] },
      serverTokens: [defaultEth],
      defaultTokens: [defaultEth],
      depositTokenListOwnerKey: ownerKey,
    });

    const result = await createDepositTokenPublisher()({
      ownerKey,
      tokens: [walletEth],
      tokensByNetwork: { 'evm--1': [walletEth] },
    });

    expect(result.tokens).toEqual([
      expect.objectContaining({
        symbol: 'ETH',
        balanceParsed: '0.2',
        fiatValue: '350',
        price: '1750',
        isDefault: true,
      }),
    ]);
  });
});
