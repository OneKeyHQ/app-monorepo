import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import { EvmApiProvider } from './EvmApiProvider';

const networkId = 'evm--10';
const storageKey = `0x${'22'.repeat(32)}`;
const accessList = [
  { address: `0x${'33'.repeat(20)}`, storageKeys: [storageKey] },
];
const encodedTx: IEncodedTxEvm = {
  from: `0x${'11'.repeat(20)}`,
  to: `0x${'44'.repeat(20)}`,
  value: '0x0',
  data: '0x12345678',
  nonce: 1,
  gasLimit: '0x5208',
  chainId: '10',
};

function createProvider() {
  const call = jest.fn();
  const backgroundApi = {
    serviceNetwork: {
      getNetwork: jest
        .fn()
        .mockResolvedValue({ feeMeta: { isWithL1BaseFee: true } }),
    },
  } as unknown as IBackgroundApi;
  const provider = new EvmApiProvider({
    url: 'https://rpc.example.invalid',
    networkId,
    backgroundApi,
  });
  (provider as unknown as { client: { call: jest.Mock } }).client = { call };
  return { provider, call };
}

// Custom RPC estimation runs on the node directly, so the access list has to
// be sent with each request the same way the server-side estimate does.
describe('EvmApiProvider access list', () => {
  it('estimates gas with the access list', async () => {
    const { provider, call } = createProvider();
    call.mockResolvedValue('0x5208');

    await provider.getGasLimit({
      networkId,
      encodedTx: { ...encodedTx, accessList },
    });

    expect(call).toHaveBeenCalledWith('eth_estimateGas', [
      expect.objectContaining({ accessList }),
    ]);
  });

  it('estimates gas without an access-list field when the list is empty', async () => {
    const { provider, call } = createProvider();
    call.mockResolvedValue('0x5208');

    await provider.getGasLimit({
      networkId,
      encodedTx: { ...encodedTx, accessList: [] },
    });

    const [, [txForEstimate]] = call.mock.calls[0] as [string, [object]];
    expect(txForEstimate).not.toHaveProperty('accessList');
  });

  it('estimates gas without the access list on a chain that rejects access lists', async () => {
    const { provider, call } = createProvider();
    call.mockResolvedValue('0x5208');

    await provider.getGasLimit({
      // zkSync Era
      networkId: 'evm--324',
      encodedTx: { ...encodedTx, chainId: '324', accessList },
    });

    const [, [txForEstimate]] = call.mock.calls[0] as [string, [object]];
    expect(txForEstimate).not.toHaveProperty('accessList');
  });

  it('prices the access list bytes into the L1 data fee', async () => {
    const { provider, call } = createProvider();
    call.mockResolvedValue('0x1');
    const oracleCallData = async (tx: IEncodedTxEvm) => {
      call.mockClear();
      await provider.getGasFee({ networkId, encodedTx: tx });
      const [, [oracleCall]] = call.mock.calls[0] as [
        string,
        [{ data: string }],
      ];
      return oracleCall.data;
    };

    const withList = await oracleCallData({ ...encodedTx, accessList });
    const withoutList = await oracleCallData(encodedTx);

    expect(withList).toContain(storageKey.slice(2));
    expect(withList.length).toBeGreaterThan(withoutList.length);
  });
});
