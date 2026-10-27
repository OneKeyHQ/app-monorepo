/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance');

const mockQuoteTokenDetails = jest.fn();
jest.mock('../../factory', () => ({
  vaultFactory: {
    getChainOnlyVault: async () => ({
      fetchTokenDetails: mockQuoteTokenDetails,
    }),
  },
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
} from '@onekeyhq/shared/types/serverToken';

import Vault from './Vault';

const own = 'synthetic-own-transparent-address';

function createVault(backend: {
  tokenList?: () => Promise<IFetchServerTokenListResponse>;
}) {
  const failed = () =>
    Promise.reject(new OneKeyLocalError('backend unavailable'));
  return Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId: 'hd-1--zec',
    networkId: 'zec--0',
    backgroundApi: {
      simpleDb: {
        privacyChainState: {
          getZcashPrivacyModeState: async () => ({ intent: 'on' }),
        },
      },
      serviceToken: { getNativeTokenAddress: async () => '' },
    },
    getNetwork: async () => ({
      decimals: 8,
      name: 'Zcash',
      symbol: 'ZEC',
      logoURI: '',
      backendIndex: true,
    }),
    baseFetchTokenList: backend.tokenList ?? failed,
    baseFetchTokenDetails: failed,
    zcashGetComposedBalanceSafe: async () => ({
      total: '300000000',
      spendable: '125000000',
      frozen: '175000000',
    }),
  });
}

const listParams = {
  accountId: 'hd-1--zec',
  requestApiParams: { networkId: 'zec--0', accountAddress: own },
  requestCurrency: 'usd',
} as IFetchServerTokenListParams;

describe('Zcash fiat without a backend token row', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuoteTokenDetails.mockResolvedValue({
      data: { data: [{ info: { address: '' }, price: 40 }] },
    });
  });

  it('values the composed balance in the home row at the asset-only quote', async () => {
    const response = await createVault({}).fetchTokenList(listParams);
    expect(Object.values(response.data.data.tokens.map)[0]).toMatchObject({
      price: 40,
      fiatValue: '120',
    });
    expect(response.data.data.tokens.fiatValue).toBe('120');
    expect(mockQuoteTokenDetails.mock.calls).toEqual([
      [{ networkId: 'zec--0', contractList: [''], requestCurrency: 'usd' }],
    ]);
  });

  it('values spendable, frozen and total in the token details', async () => {
    const response = await createVault({}).fetchTokenDetails({
      accountId: 'hd-1--zec',
      networkId: 'zec--0',
      accountAddress: own,
      contractList: [''],
      requestCurrency: 'usd',
    } as IFetchServerTokenDetailParams);
    expect(response.data.data[0]).toMatchObject({
      price: 40,
      fiatValue: '50',
      frozenBalanceFiatValue: '70',
      totalBalanceFiatValue: '120',
    });
  });

  it('keeps the backend quote and asks for no other when the backend row exists', async () => {
    const response = await createVault({
      tokenList: async () => ({
        data: {
          data: {
            tokens: {
              data: [
                {
                  $key: 'zec--0_own_',
                  decimals: 8,
                  name: 'Zcash',
                  symbol: 'ZEC',
                  address: '',
                  isNative: true,
                },
              ],
              map: {
                'zec--0_own_': {
                  balance: '100000000',
                  balanceParsed: '1',
                  fiatValue: '45',
                  price: 45,
                  price24h: 1,
                },
              },
              keys: 'server',
              fiatValue: '45',
            },
            riskTokens: { data: [], map: {}, keys: 'risk' },
            smallBalanceTokens: { data: [], map: {}, keys: 'small' },
          },
        },
      }),
    }).fetchTokenList(listParams);
    expect(response.data.data.tokens.map['zec--0_own_']).toMatchObject({
      price: 45,
      fiatValue: '135',
    });
    expect(response.data.data.tokens.fiatValue).toBe('135');
    expect(mockQuoteTokenDetails).not.toHaveBeenCalled();
  });
});
