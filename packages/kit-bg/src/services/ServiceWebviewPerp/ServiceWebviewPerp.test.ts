import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import ServiceWebviewPerp from './ServiceWebviewPerp';

import type { IPerpsDepositToken } from '../../states/jotai/atoms';

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
});
