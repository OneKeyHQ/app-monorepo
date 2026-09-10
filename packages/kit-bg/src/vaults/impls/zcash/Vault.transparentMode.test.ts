/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import {
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import VaultBtc from '../btc/Vault';

import Vault, {
  isTerminalTransparentHistoryStatus,
  shouldPreferTransparentForShieldedSend,
} from './Vault';

describe('Zcash Transparent Mode runtime boundary', () => {
  const accountId = "hd-1--m/44'/133'/0'";

  function createVault() {
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: {
            getPrivacyModeState: jest.fn(async () => ({ intent: 'off' })),
          },
        },
      },
    });
    const runtime = jest
      .spyOn(vault, 'zcashGetApi')
      .mockRejectedValue(new Error('wallet runtime must stay unloaded'));
    return { runtime, vault };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enables transparent-first only for shielded destinations', () => {
    expect(
      shouldPreferTransparentForShieldedSend({
        enabled: true,
        toAddress: 'u1-recipient',
      }),
    ).toBe(true);
    expect(
      shouldPreferTransparentForShieldedSend({
        enabled: true,
        toAddress: 't1-recipient',
      }),
    ).toBe(false);
    expect(
      shouldPreferTransparentForShieldedSend({
        enabled: false,
        toAddress: 'u1-recipient',
      }),
    ).toBe(false);
  });

  it('keeps inputs locked while backend history is still pending', () => {
    expect(isTerminalTransparentHistoryStatus(EDecodedTxStatus.Pending)).toBe(
      false,
    );
    expect(isTerminalTransparentHistoryStatus(EDecodedTxStatus.Confirmed)).toBe(
      true,
    );
    expect(isTerminalTransparentHistoryStatus(EDecodedTxStatus.Failed)).toBe(
      true,
    );
    expect(isTerminalTransparentHistoryStatus(EDecodedTxStatus.Dropped)).toBe(
      true,
    );
  });

  it('returns backend account details without touching the wallet runtime', async () => {
    const backendResponse = {
      data: { data: { address: 't1-address', balance: '42' } },
    };
    const backend = jest
      .spyOn(VaultBtc.prototype, 'fetchAccountDetails')
      .mockResolvedValue(backendResponse);
    const { runtime, vault } = createVault();

    await expect(
      vault.fetchAccountDetails({
        accountId,
        networkId: 'zec--0',
        accountAddress: 't1-address',
      }),
    ).resolves.toBe(backendResponse);
    expect(backend).toHaveBeenCalledTimes(1);
    expect(runtime).not.toHaveBeenCalled();
  });

  it('returns backend history detail without touching the wallet runtime', async () => {
    const backendResponse = {
      data: {
        data: {
          data: {
            key: 'history-key',
            networkId: 'zec--0',
            tx: '11'.repeat(32),
            riskLevel: 0,
            type: EOnChainHistoryTxType.Send,
            sends: [],
            receives: [],
            status: EOnChainHistoryTxStatus.Success,
            from: 't1-from',
            to: 't1-to',
            timestamp: 1,
            nonce: 0,
            gasFee: '0',
            gasFeeFiatValue: '0',
            functionCode: '',
            params: [],
            value: '0',
            label: '',
          },
          tokens: {},
          nfts: {},
        },
      },
    };
    const backend = jest
      .spyOn(VaultBtc.prototype, 'fetchAccountHistoryDetail')
      .mockResolvedValue(backendResponse);
    const { runtime, vault } = createVault();

    await expect(
      vault.fetchAccountHistoryDetail({
        accountId,
        networkId: 'zec--0',
        txid: '11'.repeat(32),
      }),
    ).resolves.toBe(backendResponse);
    expect(backend).toHaveBeenCalledTimes(1);
    expect(runtime).not.toHaveBeenCalled();
  });
});
