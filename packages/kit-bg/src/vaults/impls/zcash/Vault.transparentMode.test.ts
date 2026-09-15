/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import type {
  IZcashHistoryItem,
  IZcashSdkApi,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import VaultBtc from '../btc/Vault';

import { KeyringHardware } from './KeyringHardware';
import Vault, {
  isTerminalTransparentHistoryStatus,
  shouldPreferTransparentForShieldedSend,
} from './Vault';

import type { IEncodedTxZcash } from './types';
import type { IZcashAccountMeta } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

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
    const publicHistory = jest
      .spyOn(
        vault as unknown as {
          zcashFetchTransparentHistory: () => Promise<{
            txs: IAccountHistoryTx[];
            snapshotComplete: boolean;
          }>;
        },
        'zcashFetchTransparentHistory',
      )
      .mockResolvedValue({ txs: [], snapshotComplete: true });
    return { runtime, vault, publicHistory };
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
    const { runtime, vault, publicHistory } = createVault();
    publicHistory.mockResolvedValue({
      txs: [{ decodedTx: { txid: '11'.repeat(32) } } as IAccountHistoryTx],
      snapshotComplete: true,
    });

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

  it('does not disclose a stale private detail request after Privacy Mode is off', async () => {
    const { runtime, vault } = createVault();
    const backend = jest.spyOn(VaultBtc.prototype, 'fetchAccountHistoryDetail');

    await expect(
      vault.fetchAccountHistoryDetail({
        accountId,
        networkId: 'zec--0',
        txid: '44'.repeat(32),
      }),
    ).rejects.toThrow('transaction not found');
    expect(runtime).not.toHaveBeenCalled();
    expect(backend).not.toHaveBeenCalled();
  });
});

describe('Zcash hardware account address authority', () => {
  const staleMeta = {
    ufvk: 'uview1-device',
    unifiedAddress: 'u1-device',
    transparentAddress: 't1-device',
    seedFingerprintHex: '00'.repeat(32),
    hdIndex: 0,
    birthdayHeight: 3_000_000,
    birthdaySource: 'manual-height',
    addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION - 1,
    createdAt: 1,
  } as IZcashAccountMeta;

  function createVault() {
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: {
            getAccountMeta: jest.fn(async () => staleMeta),
            saveAccountMeta: jest.fn(async () => undefined),
          },
        },
      },
    });
    const runtime = jest
      .spyOn(vault, 'zcashGetApi')
      .mockRejectedValue(new Error('keys module must not be consulted'));
    return { runtime, vault };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the address the device displayed when the scheme version moves', async () => {
    const { runtime, vault } = createVault();

    await expect(
      vault.zcashGetAccountMeta({ accountId: "hw-1--m/44'/133'/0'" }),
    ).resolves.toBe(staleMeta);
    expect(runtime).not.toHaveBeenCalled();
  });

  it('still re-derives for software accounts, where the app is the authority', async () => {
    const { runtime, vault } = createVault();

    await vault.zcashGetAccountMeta({ accountId: "hd-1--m/44'/133'/0'" });
    expect(runtime).toHaveBeenCalledTimes(1);
  });
});

describe('Zcash hardware transparent send', () => {
  const accountId = "hw-1--m/44'/133'/0'";

  function createVault() {
    return Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: 'zec--0',
      keyring: Object.create(KeyringHardware.prototype) as KeyringHardware,
      backgroundApi: {
        simpleDb: {
          zcash: {
            getPrivacyModeState: jest.fn(async () => ({ intent: 'off' })),
          },
        },
      },
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['t1-recipient', false],
    ['t1-recipient', true],
    ['u1-recipient', false],
    ['u1-recipient', true],
  ] as const)(
    'routes hardware funds to %s (max=%s) without privacy setup',
    async (to, sendMax) => {
      const transferInfo = { from: 't1-account', to, amount: '0.1' };
      const encodedTx: IEncodedTxZcash = {
        inputs: [],
        outputs: [{ address: to, value: '10000000' }],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        fee: '10000',
        txSize: 0,
        zcashMode: 'transparent',
        zcashTo: to,
        zcashAmountValue: '10000000',
      };
      const build = jest.fn(async () => encodedTx);
      const vault = createVault();
      Object.assign(vault, { zcashBuildTransparentEncodedTx: build });

      await expect(
        vault.buildEncodedTx({
          transfersInfo: [transferInfo],
          transferPayload: {
            amountToSend: '0.1',
            isMaxSend: sendMax,
            isNFT: false,
            originalRecipient: to,
          },
        }),
      ).resolves.toBe(encodedTx);
      expect(build).toHaveBeenCalledWith({ transferInfo, sendMax });
    },
  );
});

describe('Zcash private history detail routing', () => {
  const accountId = "hd-1--m/44'/133'/0'";
  const txid = '44'.repeat(32);
  const params = {
    accountId,
    networkId: 'zec--0',
    txid,
    accountAddress: 't1-account',
  };
  const item: IZcashHistoryItem = {
    txid,
    minedHeight: 1,
    timestamp: 1,
    valueZat: '1',
    fee: null,
    pending: false,
    expired: false,
    txType: 'received',
    recipient: null,
    poolIds: [4],
    perPoolBalanceDeltaZat: { '4': '1' },
  };

  function createVault() {
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: params.networkId,
      backgroundApi: {
        simpleDb: {
          zcash: {
            getPrivacyModeState: jest.fn(async () => ({ intent: 'on' })),
          },
        },
      },
    });
    jest.spyOn(vault, 'zcashGetWalletAccount').mockResolvedValue({
      ufvk: 'synthetic-ufvk',
      network: 'main',
      lightwalletdUrl: 'https://lightwalletd.invalid',
      seedFingerprintHex: '00'.repeat(32),
      hdIndex: 0,
    });
    const getHistory = jest.fn(async () => [item]);
    const getTxDetails = jest.fn(async () => ({
      spent: [],
      received: [],
      external: [],
    }));
    jest.spyOn(vault, 'zcashGetApi').mockResolvedValue({
      getHistory,
      getTxDetails,
    } as unknown as IZcashSdkApi);
    const backend = jest
      .spyOn(VaultBtc.prototype, 'fetchAccountHistoryDetail')
      .mockRejectedValue(new Error('unexpected backend detail disclosure'));
    const publicHistory = jest
      .spyOn(
        vault as unknown as {
          zcashFetchTransparentHistory: () => Promise<{
            txs: IAccountHistoryTx[];
            snapshotComplete: boolean;
          }>;
        },
        'zcashFetchTransparentHistory',
      )
      .mockResolvedValue({ txs: [], snapshotComplete: true });
    return { vault, getHistory, getTxDetails, backend, publicHistory };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([{ poolIds: [4] }, { poolIds: [0, 4] }])(
    'keeps the detail of local pools $poolIds entirely runtime-owned',
    async ({ poolIds }) => {
      const { vault, getHistory, backend, publicHistory } = createVault();
      getHistory.mockResolvedValue([{ ...item, poolIds }]);

      const response = await vault.fetchAccountHistoryDetail(params);

      expect(response.data.data.data.tx).toBe(txid);
      expect(backend).not.toHaveBeenCalled();
      expect(publicHistory).not.toHaveBeenCalled();
    },
  );

  it('does not probe the backend when local detail fails', async () => {
    const { vault, getTxDetails, backend, publicHistory } = createVault();
    getTxDetails.mockRejectedValue(new Error('local database unavailable'));

    await expect(vault.fetchAccountHistoryDetail(params)).rejects.toThrow(
      'local database unavailable',
    );
    expect(backend).not.toHaveBeenCalled();
    expect(publicHistory).not.toHaveBeenCalled();
  });

  it('does not disclose a txid that is absent from both histories', async () => {
    const { vault, getHistory, backend, publicHistory } = createVault();
    getHistory.mockResolvedValue([]);

    await expect(vault.fetchAccountHistoryDetail(params)).rejects.toThrow(
      'transaction not found',
    );
    expect(publicHistory).toHaveBeenCalledWith({
      accountId,
      networkId: params.networkId,
      accountAddress: params.accountAddress,
      xpub: undefined,
    });
    expect(backend).not.toHaveBeenCalled();
  });

  it('allows backend detail only for an association already in public history', async () => {
    const { vault, getHistory, backend, publicHistory } = createVault();
    getHistory.mockResolvedValue([]);
    publicHistory.mockResolvedValue({
      txs: [{ decodedTx: { txid } } as IAccountHistoryTx],
      snapshotComplete: true,
    });

    await expect(vault.fetchAccountHistoryDetail(params)).rejects.toThrow(
      'unexpected backend detail disclosure',
    );
    expect(backend).toHaveBeenCalledTimes(1);
  });

  it('does not probe the backend when the local history lookup fails', async () => {
    const { vault, getHistory, backend, publicHistory } = createVault();
    getHistory.mockRejectedValue(new Error('local history unavailable'));

    await expect(vault.fetchAccountHistoryDetail(params)).rejects.toThrow(
      'local history unavailable',
    );
    expect(publicHistory).not.toHaveBeenCalled();
    expect(backend).not.toHaveBeenCalled();
  });

  it('does not send the target txid when public history lookup fails', async () => {
    const { vault, getHistory, backend, publicHistory } = createVault();
    getHistory.mockResolvedValue([]);
    publicHistory.mockRejectedValue(new Error('public history unavailable'));

    await expect(vault.fetchAccountHistoryDetail(params)).rejects.toThrow(
      'public history unavailable',
    );
    expect(backend).not.toHaveBeenCalled();
  });
});

describe('Zcash transparent history address resolution', () => {
  const accountId = "hd-1--m/44'/133'/0'";

  function createVault({ address }: { address?: string }) {
    const getClient = jest.fn(async () => {
      throw new OneKeyLocalError('backend reached');
    });
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: { zcash: { getAccountMeta: jest.fn(async () => null) } },
        serviceAccount: {
          getDBAccountSafe: jest.fn(async () =>
            address ? { id: accountId, address } : undefined,
          ),
        },
        serviceHistory: { getClient },
      },
    });
    const fetchHistory = (
      vault as unknown as {
        zcashFetchTransparentHistory: (params: {
          accountId: string;
          networkId: string;
          accountAddress: string;
        }) => Promise<{ txs: unknown[]; snapshotComplete: boolean }>;
      }
    ).zcashFetchTransparentHistory.bind(vault);
    return { fetchHistory, getClient };
  }

  // Detail requests for the raw input/output breakdown carry no account
  // address, and Transparent Mode never writes viewing metadata -- without the
  // fallback the association check answered "not found" for every such tx.
  it('uses the account t-address when metadata and params have none', async () => {
    const { fetchHistory, getClient } = createVault({ address: 't1-self' });

    await expect(
      fetchHistory({ accountId, networkId: 'zec--0', accountAddress: '' }),
    ).rejects.toThrow('backend reached');
    expect(getClient).toHaveBeenCalledTimes(1);
  });

  it('stays empty when the account has no transparent address at all', async () => {
    const { fetchHistory, getClient } = createVault({});

    await expect(
      fetchHistory({ accountId, networkId: 'zec--0', accountAddress: '' }),
    ).resolves.toEqual({ txs: [], snapshotComplete: true });
    expect(getClient).not.toHaveBeenCalled();
  });
});

describe('Zcash history detail pool split', () => {
  const accountId = "hd-1--m/44'/133'/0'";
  const txid = '55'.repeat(32);
  const baseParams = {
    accountId,
    networkId: 'zec--0',
    txid,
    accountAddress: 't1-account',
  };
  const item: IZcashHistoryItem = {
    txid,
    minedHeight: 1,
    timestamp: 1,
    valueZat: '1',
    fee: null,
    pending: false,
    expired: false,
    txType: 'received',
    recipient: null,
    poolIds: [0, 4],
    perPoolBalanceDeltaZat: { '0': '1', '4': '1' },
  };

  function createVault({ poolIds }: { poolIds: number[] }) {
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: baseParams.networkId,
      backgroundApi: {
        simpleDb: {
          zcash: {
            getPrivacyModeState: jest.fn(async () => ({ intent: 'on' })),
          },
        },
      },
    });
    jest.spyOn(vault, 'zcashGetWalletAccount').mockResolvedValue({
      ufvk: 'synthetic-ufvk',
      network: 'main',
      lightwalletdUrl: 'https://lightwalletd.invalid',
      seedFingerprintHex: '00'.repeat(32),
      hdIndex: 0,
    });
    const getHistory = jest.fn(async () => [{ ...item, poolIds }]);
    const getTxDetails = jest.fn(async () => ({
      spent: [],
      received: [],
      external: [],
    }));
    jest.spyOn(vault, 'zcashGetApi').mockResolvedValue({
      getHistory,
      getTxDetails,
    } as unknown as IZcashSdkApi);
    const backend = jest
      .spyOn(VaultBtc.prototype, 'fetchAccountHistoryDetail')
      .mockResolvedValue({
        data: { data: { data: { tx: txid } } },
      } as unknown as Awaited<
        ReturnType<typeof VaultBtc.prototype.fetchAccountHistoryDetail>
      >);
    jest
      .spyOn(
        vault as unknown as {
          zcashFetchTransparentHistory: () => Promise<{
            txs: IAccountHistoryTx[];
            snapshotComplete: boolean;
          }>;
        },
        'zcashFetchTransparentHistory',
      )
      .mockResolvedValue({
        txs: [{ decodedTx: { txid } }] as unknown as IAccountHistoryTx[],
        snapshotComplete: true,
      });
    return { vault, getTxDetails, backend };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers the public tab from the backend even on a mixed transaction', async () => {
    const { vault, getTxDetails, backend } = createVault({ poolIds: [0, 4] });

    await vault.fetchAccountHistoryDetail({
      ...baseParams,
      privacyChainPoolId: 0,
    });

    expect(backend).toHaveBeenCalledTimes(1);
    expect(getTxDetails).not.toHaveBeenCalled();
  });

  it('answers a private tab from the runtime on the same transaction', async () => {
    const { vault, getTxDetails, backend } = createVault({ poolIds: [0, 4] });

    await vault.fetchAccountHistoryDetail({
      ...baseParams,
      privacyChainPoolId: 4,
    });

    expect(getTxDetails).toHaveBeenCalledTimes(1);
    expect(backend).not.toHaveBeenCalled();
  });

  // A deep link carries no tab. A row the runtime knows only as transparent is
  // the backend's to describe.
  it('sends a transparent-only transaction to the backend without a tab', async () => {
    const { vault, getTxDetails, backend } = createVault({ poolIds: [0] });

    await vault.fetchAccountHistoryDetail(baseParams);

    expect(backend).toHaveBeenCalledTimes(1);
    expect(getTxDetails).not.toHaveBeenCalled();
  });
});
