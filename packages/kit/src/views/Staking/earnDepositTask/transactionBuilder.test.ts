import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EEarnLabels,
  EInternalDappEnum,
  EInternalStakingAction,
  type IStakeBaseParams,
  type IStakeTxResponse,
} from '@onekeyhq/shared/types/staking';

import { buildEarnStakeConfirmation } from './transactionBuilder';

const buildStake = jest.fn<Promise<IStakeTxResponse>, [IStakeBaseParams]>();
const buildInternal = jest.fn<Promise<IEncodedTx>, [unknown]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      buildStakeTransaction: (params: IStakeBaseParams) => buildStake(params),
      buildInternalDappTx: (params: unknown) => buildInternal(params),
    },
  },
}));

const request: IStakeBaseParams = {
  accountId: 'account',
  networkId: 'evm--1',
  amount: '1',
  symbol: 'eETH',
  provider: 'etherfi',
  protocolVault: 'vault',
  inputTokenAddress: '',
  stakeType: 'wrap',
};
const transaction = {
  from: '0x1',
  to: '0x2',
  value: '0x1',
  data: '0xd0e30db0',
};

describe('Earn stake confirmation builder', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    buildStake.mockResolvedValue({ tx: transaction, orderId: 'order' });
    buildInternal.mockResolvedValue(transaction);
  });

  it('preserves the request and passes the result to internal transaction encoding', async () => {
    const result = await buildEarnStakeConfirmation({
      request,
      stakingInfo: null,
    });
    expect(buildStake.mock.calls[0][0]).toEqual(request);
    expect(buildInternal.mock.calls[0][0]).toEqual({
      networkId: 'evm--1',
      accountId: 'account',
      tx: transaction,
      internalDappType: EInternalDappEnum.Staking,
      stakingAction: EInternalStakingAction.Stake,
    });
    expect(result).toMatchObject({ encodedTx: transaction });
    expect(result.stakeInfoWithOrderId).toBeUndefined();
  });

  it.each([
    ['BTC fee', getNetworkIdsMap().btc, '100', true],
    ['BTC zero-string fee', getNetworkIdsMap().btc, '0', true],
    ['BTC empty fee', getNetworkIdsMap().btc, '', false],
    ['non-BTC fee field', 'evm--1', '100', false],
  ])(
    'preserves the existing fee policy for %s',
    async (_name, networkId, fee, hasFee) => {
      const encoded: IEncodedTxBtc = {
        inputs: [],
        outputs: [],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee,
        txSize: undefined,
      };
      buildInternal.mockResolvedValue(encoded);
      const result = await buildEarnStakeConfirmation({
        request: { ...request, networkId },
      });
      expect(result.useFeeInTx).toBe(hasFee ? true : undefined);
      expect(result.feeInfoEditable).toBe(hasFee ? false : undefined);
    },
  );

  it('attaches the server order only when a stake record was requested', async () => {
    const stakingInfo = {
      label: EEarnLabels.Stake,
      protocol: 'EtherFi',
      tags: [EEarnLabels.Stake],
    };
    const result = await buildEarnStakeConfirmation({
      request: { ...request, stakeType: 'normal', inputTokenAddress: 'weth' },
      stakingInfo,
    });
    expect(result.stakeInfoWithOrderId).toEqual({
      ...stakingInfo,
      orderId: 'order',
    });
  });
});
