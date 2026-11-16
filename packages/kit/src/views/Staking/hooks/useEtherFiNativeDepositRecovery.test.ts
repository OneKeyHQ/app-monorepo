/* eslint-disable import/first */

const mockAccount = jest.fn<Promise<{ address: string }>, []>();
const mockBalances = jest.fn<Promise<unknown[]>, []>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: { getAccount: () => mockAccount() },
    serviceToken: { fetchTokensDetailsBatch: () => mockBalances() },
  },
}));

import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

import { etherFiDepositRecovery } from './etherFiDepositRecovery';
import { prepareEtherFiNativeDepositRecovery } from './useEtherFiNativeDepositRecovery';

const account = '0x1111111111111111111111111111111111111111';
const vault = '0xf0bb20865277abd641a307ece5ee04e79073416c';
const scope = {
  accountId: 'account-1',
  accountAddress: account,
  networkId: 'evm--1',
  vault,
};
let nextTx = 0;
const token = {
  address: EthereumWETH,
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
  isNative: false,
  networkId: 'evm--1',
};
const asset: IEarnTokenItem = {
  info: token,
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: '1',
  price24h: '1',
};

function retainedWrap() {
  nextTx += 1;
  const txid = `0x${nextTx.toString(16).padStart(64, '0')}`;
  const id = etherFiDepositRecovery.begin(scope, '0.1', 'wrap');
  const attempt = etherFiDepositRecovery.markSending(id, id, 'wrap');
  if (!attempt) throw new OneKeyLocalError('Missing attempt');
  etherFiDepositRecovery.recordTxid(id, attempt, txid);
  etherFiDepositRecovery.recordFinal(id, attempt, txid, 'success');
  etherFiDepositRecovery.detach(id, id);
  return id;
}

describe('preparing a retained EtherFi native deposit', () => {
  beforeEach(() => {
    mockAccount.mockReset().mockResolvedValue({ address: account });
    mockBalances.mockReset().mockResolvedValue([
      {
        accountAddress: account,
        tokens: [
          {
            info: token,
            balance: '100000000000000000',
            balanceParsed: '0.1',
          },
        ],
      },
    ]);
  });

  it('uses an address-bound WETH balance and atomically claims the old intent', async () => {
    const id = retainedWrap();
    const prepared = await prepareEtherFiNativeDepositRecovery({
      id,
      asset,
      isCurrent: () => true,
    });
    expect(prepared.balanceParsed).toBe('0.1');
    expect(etherFiDepositRecovery.get(id)?.detached).toBe(false);
    await expect(
      prepareEtherFiNativeDepositRecovery({ id, asset, isCurrent: () => true }),
    ).rejects.toThrow();
  });

  it.each([
    {
      label: 'wrong returned account',
      address: vault,
      balance: '100000000000000000',
      parsed: '0.1',
    },
    {
      label: 'insufficient balance',
      address: account,
      balance: '1',
      parsed: '0.000000000000000001',
    },
    {
      label: 'inconsistent raw amount',
      address: account,
      balance: '1',
      parsed: '0.1',
    },
  ])('does not claim on $label', async ({ address, balance, parsed }) => {
    const id = retainedWrap();
    mockBalances.mockResolvedValueOnce([
      {
        accountAddress: address,
        tokens: [{ info: token, balance, balanceParsed: parsed }],
      },
    ]);
    await expect(
      prepareEtherFiNativeDepositRecovery({ id, asset, isCurrent: () => true }),
    ).rejects.toThrow();
    expect(etherFiDepositRecovery.get(id)?.detached).toBe(true);
  });

  it('does not claim after an account or view scope changes during the read', async () => {
    const id = retainedWrap();
    let current = true;
    mockBalances.mockImplementationOnce(async () => {
      current = false;
      return [
        {
          accountAddress: account,
          tokens: [
            {
              info: token,
              balance: '100000000000000000',
              balanceParsed: '0.1',
            },
          ],
        },
      ];
    });
    await expect(
      prepareEtherFiNativeDepositRecovery({
        id,
        asset,
        isCurrent: () => current,
      }),
    ).rejects.toThrow();
    expect(etherFiDepositRecovery.get(id)?.detached).toBe(true);
  });
});
