import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';
import { EDecodedTxStatus, EReplaceTxType } from '@onekeyhq/shared/types/tx';

import simpleDb from '../dbs/simple/simpleDb';
import { VaultBase } from '../vaults/base/VaultBase';
import { vaultFactory } from '../vaults/factory';

import ServiceHistory from './ServiceHistory';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
jest.mock('../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: { localHistory: { getLocalHistoryTxById: jest.fn() } },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

it('logs a failed asynchronous swap replacement without exposing its transaction data', async () => {
  const decodedTx: IDecodedTx = {
    txid: 'new-tx',
    owner: 'sender',
    signer: 'sender',
    nonce: 0,
    actions: [],
    status: EDecodedTxStatus.Pending,
    networkId: 'btc--0',
    accountId: 'account',
    extraInfo: null,
  };
  const newHistory: IAccountHistoryTx = { id: 'new-history', decodedTx };
  const previousHistory: IAccountHistoryTx = {
    id: 'old-history',
    decodedTx: { ...decodedTx, txid: 'old-tx' },
  };
  jest
    .mocked(simpleDb.localHistory.getLocalHistoryTxById)
    .mockResolvedValue(previousHistory);
  const vault = Object.assign(Object.create(VaultBase.prototype) as VaultBase, {
    buildHistoryTx: jest.fn().mockResolvedValue(newHistory),
  });
  jest.mocked(vaultFactory.getVault).mockResolvedValue(vault);
  const log = jest
    .spyOn(defaultLogger.swap.swapSendTx, 'consoleError')
    .mockImplementation(() => undefined);
  const save = jest.fn().mockResolvedValue(undefined);
  const service = Object.assign(
    Object.create(ServiceHistory.prototype) as ServiceHistory,
    {
      backgroundApi: {
        serviceNetwork: { getVaultSettings: jest.fn().mockResolvedValue({}) },
        serviceAccount: {
          getAccountXpub: jest.fn().mockResolvedValue(undefined),
          getAccountAddressForApi: jest.fn().mockResolvedValue('sender'),
        },
        serviceSwap: {
          updateSwapHistoryTx: jest
            .fn()
            .mockRejectedValue(new OneKeyLocalError('private diagnostic')),
        },
        serviceStaking: {
          updateOrderStatusByTxId: jest.fn().mockResolvedValue(undefined),
        },
        serviceFreshAddress: {
          syncBTCFreshAddressByAccountId: jest
            .fn()
            .mockResolvedValue(undefined),
        },
        simpleDb: {
          localHistory: {
            batchUpdateLocalHistoryTxs: save,
            saveLocalHistoryPendingTxs: save,
          },
        },
      },
    },
  );
  await service.saveSendConfirmHistoryTxs({
    networkId: 'btc--0',
    accountId: 'account',
    data: {
      decodedTx,
      signedTx: { txid: 'new-tx', rawTx: '', encodedTx: null },
    },
    replaceTxInfo: {
      replaceHistoryId: 'old-history',
      replaceType: EReplaceTxType.SpeedUp,
    },
  });
  expect(log).toHaveBeenCalledWith('Swap replacement history update failed', {
    errorType: 'OneKeyLocalError',
  });
  expect(save).toHaveBeenCalledTimes(2);
  log.mockRestore();
});
