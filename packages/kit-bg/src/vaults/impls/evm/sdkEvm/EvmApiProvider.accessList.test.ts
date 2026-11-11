import { Interface, Transaction } from 'ethersV6';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import { EvmApiProvider } from './EvmApiProvider';

const accessList = [
  {
    address: '0x3333333333333333333333333333333333333333',
    storageKeys: [`0x${'11'.repeat(32)}`],
  },
];
const encodedTx = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  data: '0x1234',
  value: '0x0',
  accessList,
};

/** 构造真实费用服务并替换 RPC 传输，返回服务与调用记录，避免测试依赖外部网络。 */
function fixture() {
  const provider = new EvmApiProvider({
    url: 'https://rpc.example.invalid',
    networkId: 'evm--1',
    backgroundApi: {
      serviceNetwork: {
        getNetwork: jest
          .fn()
          .mockResolvedValue({ feeMeta: { isWithL1BaseFee: true } }),
      },
    } as unknown as IBackgroundApi,
  });
  const call = jest.fn().mockResolvedValue('0x10000');
  Object.assign(provider, { client: { call } });
  return { provider, call };
}

describe('custom RPC access-list fee estimation', () => {
  it('includes the list in eth_estimateGas without reusing a stale gas limit', async () => {
    const { provider, call } = fixture();
    await provider.getGasLimit({
      networkId: 'evm--1',
      encodedTx: { ...encodedTx, gasLimit: '21000' },
    });
    expect(call).toHaveBeenCalledWith('eth_estimateGas', [encodedTx]);
  });

  it('includes the list in the bytes priced by the L1 fee oracle', async () => {
    const { provider, call } = fixture();
    await provider.getGasFee({ networkId: 'evm--1', encodedTx });
    const oracle = new Interface([
      'function getL1Fee(bytes) view returns (uint256)',
    ]);
    const bytes = oracle.decodeFunctionData(
      'getL1Fee',
      call.mock.calls[0][1][0].data,
    )[0] as string;
    expect(Transaction.from(bytes).accessList).toEqual(accessList);
  });
});
