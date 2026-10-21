/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc/networks';
import { ZCASH_ADDRESS_SCHEME_VERSION } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import type {
  IZcashHistoryItem,
  IZcashSdkApi,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EOnChainHistoryTransferType,
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';
import VaultBtc from '../btc/Vault';

import { KeyringHardware } from './KeyringHardware';
import Vault from './Vault';
import { isTerminalTransparentHistoryStatus } from './vaultUtils';

import type { IEncodedTxZcash } from './types';
import type { IZcashAccountMeta } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

describe('Zcash Transparent Mode runtime boundary', () => {
  const accountId = "hd-1--m/44'/133'/0'";

  function createVault() {
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId,
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            getZcashPrivacyModeState: jest.fn(async () => ({ intent: 'off' })),
          },
        },
        // Our transparent output is the address Receive displays.
        servicePrivacyChain: {
          getLocalWalletAccountAddresses: async () => ({
            publicAddress: 't1-public-output',
          }),
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

  it.each([true, false])(
    'only exposes health from the selected sync endpoint (matching: %s)',
    async (matches) => {
      const { runtime, vault } = createVault();
      const url = 'https://selected.example.invalid';
      const health = {
        url: matches ? url : 'https://previous.example.invalid',
        ok: true,
        latencyMs: 42,
        atMs: 123,
      };
      runtime.mockResolvedValue({
        getEndpointHealth: async () => health,
      } as unknown as IZcashSdkApi);
      jest.spyOn(vault, 'zcashResolveLightwalletdUrl').mockResolvedValue(url);

      const endpoint = await vault
        .getLocalWalletCapability()
        .getSyncEndpoint?.();

      expect(endpoint?.url).toBe(url);
      expect(endpoint?.health).toEqual(matches ? health : undefined);
    },
  );

  const unifiedAddress =
    'u1y2z9wqt9du4stq2keex78l4vvlkfh3c0n7le0pz80lc4ttcuz5h9qyts73awns77lkgw8zy67qwf0s86rauwg6e9wz7te7yf6vxjtk5g';

  it('validates Unified addresses locally while the WASM carrier is unavailable', async () => {
    const { runtime, vault } = createVault();
    runtime.mockRejectedValue(new Error('keys WASM unavailable'));
    await expect(vault.validateAddress(unifiedAddress)).resolves.toEqual({
      isValid: true,
      normalizedAddress: unifiedAddress,
      displayAddress: unifiedAddress,
    });
    await expect(
      vault.validateAddress(`${unifiedAddress.slice(0, -1)}q`),
    ).resolves.toMatchObject({ isValid: false });
    expect(runtime).not.toHaveBeenCalled();
  });

  it('validates transparent addresses without loading the WASM runtime', async () => {
    const { runtime, vault } = createVault();
    jest
      .spyOn(vault, 'getBtcForkNetwork')
      .mockResolvedValue(getBtcForkNetwork('zec'));
    await expect(
      vault.validateAddress('t1UYsZVJkLPeMjxEtACvSxfWuNmddpWfxzs'),
    ).resolves.toMatchObject({ isValid: true });
    expect(runtime).not.toHaveBeenCalled();
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

  it('keeps history direction summaries separate from real public input/output counts', async () => {
    const { runtime, vault, publicHistory } = createVault();
    publicHistory.mockResolvedValue({
      txs: [{ decodedTx: { txid: '22'.repeat(32) } } as IAccountHistoryTx],
      snapshotComplete: true,
    });
    const shielded = {
      type: EOnChainHistoryTransferType.Shielded,
      address: 'Shielded',
      label: 'Shielded',
      amount: '1',
      from: '',
      to: '',
      token: '',
      key: '',
      isOwn: false,
    };
    const publicOutput = {
      ...shielded,
      type: EOnChainHistoryTransferType.Transfer,
      address: 't1-public-output',
      label: '',
      isOwn: true,
    };
    jest
      .spyOn(VaultBtc.prototype, 'fetchAccountHistoryDetail')
      .mockImplementation(
        async () =>
          ({
            data: {
              data: {
                data: {
                  tx: '22'.repeat(32),
                  type: EOnChainHistoryTxType.Receive,
                  value: '1',
                  sends: [{ ...shielded }],
                  receives: [{ ...publicOutput }],
                  status: EOnChainHistoryTxStatus.Success,
                },
                tokens: {},
                nfts: {},
              },
            },
          }) as Awaited<ReturnType<Vault['fetchAccountHistoryDetail']>>,
      );
    const request = { accountId, networkId: 'zec--0', txid: '22'.repeat(32) };
    const summary = (await vault.fetchAccountHistoryDetail(request)).data.data
      .data;
    expect(summary.sends?.[0].type).toBe(EOnChainHistoryTransferType.Shielded);
    const io = (
      await vault.fetchAccountHistoryDetail({ ...request, withUTXOs: true })
    ).data.data.data;
    expect(io.sends).toEqual([]);
    expect(io.receives).toEqual([publicOutput]);
    expect(io.inputOutputSource).toBe('public');
    expect(runtime).not.toHaveBeenCalled();
  });
});

describe('Zcash hardware account address authority', () => {
  const deviceUfvk = 'uview1-device';
  const storedMeta = {
    vkFp: getViewingKeyFingerprint({
      networkId: 'zec--0',
      viewingKey: deviceUfvk,
    }),
    unifiedAddress: 'u1-device',
    transparentAddress: 't1-device',
    addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
    seedFingerprintHex: '00'.repeat(32),
    hdIndex: 0,
    birthdayHeight: 3_000_000,
    birthdaySource: 'manual-height',
    createdAt: 1,
  } as IZcashAccountMeta;

  function createVault(meta = storedMeta) {
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainKeys: {
            getKey: jest.fn(async () => ({
              networkId: 'zec--0',
              vkFp: storedMeta.vkFp,
              sealed: { format: 'plain', value: deviceUfvk },
            })),
          },
          privacyChainState: {
            getZcashAccountMeta: jest.fn(async () => meta),
            saveZcashAccountMeta: jest.fn(async () => undefined),
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

  it('keeps the address the device displayed', async () => {
    const { runtime, vault } = createVault();

    await expect(
      vault.zcashGetAccountMeta({ accountId: "hw-1--m/44'/133'/0'" }),
    ).resolves.toBe(storedMeta);
    expect(runtime).not.toHaveBeenCalled();
  });

  it('reads software account addresses without loading the runtime', async () => {
    const { runtime, vault } = createVault();

    await vault.zcashGetAccountMeta({ accountId: "hd-1--m/44'/133'/0'" });
    expect(runtime).not.toHaveBeenCalled();
  });

  it.each([
    ["hw-1--m/44'/133'/0'", 'u1-device', 'u1-refreshed'],
    ["hd-1--m/44'/133'/0'", 'u1-refreshed', undefined],
  ] as const)(
    'refreshes an old address cache offline for %s',
    async (accountId, unifiedAddress, derivedUnifiedAddress) => {
      const oldMeta = { ...storedMeta, addressSchemeVersion: undefined };
      const { runtime, vault } = createVault(oldMeta);
      const deriveAddressFromUfvk = jest.fn(async () => ({
        unifiedAddress: 'u1-refreshed',
        transparentAddress: oldMeta.transparentAddress,
      }));
      runtime.mockResolvedValue({
        deriveAddressFromUfvk,
      } as unknown as IZcashSdkApi);
      await expect(
        vault.zcashGetAccountMeta({ accountId }),
      ).resolves.toMatchObject({
        unifiedAddress,
        derivedUnifiedAddress,
        addressSchemeVersion: ZCASH_ADDRESS_SCHEME_VERSION,
      });
      expect(deriveAddressFromUfvk).toHaveBeenCalledWith({
        network: 'main',
        ufvk: deviceUfvk,
        lightwalletdUrl: '',
      });
      expect(
        vault.backgroundApi.simpleDb.privacyChainState.saveZcashAccountMeta,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ accountId, expectedMeta: oldMeta }),
      );
    },
  );
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
          privacyChainState: {
            getZcashPrivacyModeState: jest.fn(async () => ({ intent: 'off' })),
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
          privacyChainState: {
            getZcashPrivacyModeState: jest.fn(async () => ({ intent: 'on' })),
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
      getSyncProgress: async () => ({ chainTip: 10 }),
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

  it('keeps the detail of a fully shielded transaction runtime-owned', async () => {
    const { vault, getHistory, backend, publicHistory } = createVault();
    getHistory.mockResolvedValue([{ ...item, poolIds: [4] }]);

    const response = await vault.fetchAccountHistoryDetail(params);

    expect(response.data.data.data.tx).toBe(txid);
    expect(response.data.data.data).toMatchObject({
      block: 1,
      confirmations: 10,
      timestamp: 1,
    });
    expect(backend).not.toHaveBeenCalled();
    expect(publicHistory).not.toHaveBeenCalled();
  });

  // A deep link has no tab. A transparent leg makes the transaction the
  // indexer's to judge: the list shows the backend's status, so must this.
  it('takes the status of a mixed transaction from the backend on a deep link', async () => {
    const { vault, getHistory, backend, publicHistory } = createVault();
    getHistory.mockResolvedValue([{ ...item, poolIds: [0, 4] }]);
    publicHistory.mockResolvedValue({
      txs: [{ decodedTx: { txid } } as IAccountHistoryTx],
      snapshotComplete: true,
    });
    backend.mockResolvedValue({
      data: {
        data: {
          data: { tx: txid, status: EOnChainHistoryTxStatus.Failed },
          tokens: {},
          nfts: {},
        },
      },
    } as never);

    const response = await vault.fetchAccountHistoryDetail(params);

    expect(response.data.data.data.tx).toBe(txid);
    expect(response.data.data.data.status).toBe(EOnChainHistoryTxStatus.Failed);
  });

  it('passes text memos as text and the rest as hex plus hash', async () => {
    const { vault, getTxDetails } = createVault();
    const binary = { hex: 'ff010203', hash: 'ab'.repeat(32) };
    getTxDetails.mockResolvedValue({
      spent: [],
      received: [
        {
          value: '1',
          pool: 'ironwood',
          internal: false,
          memo: 'hi',
          memoBinary: null,
          address: null,
        },
        {
          value: '1',
          pool: 'ironwood',
          internal: false,
          memo: null,
          memoBinary: binary,
          address: null,
        },
      ],
      external: [],
    } as never);

    const { data } = (await vault.fetchAccountHistoryDetail(params)).data.data;

    expect(data.memo).toBe('hi');
    expect(data.binaryMemos).toEqual([binary]);
  });

  it('does not probe the backend when local detail fails', async () => {
    const { vault, getTxDetails, backend, publicHistory } = createVault();
    getTxDetails.mockRejectedValue(new Error('local database unavailable'));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(vault.fetchAccountHistoryDetail(params)).rejects.toThrow(
      'local database unavailable',
    );
    expect(backend).not.toHaveBeenCalled();
    expect(publicHistory).not.toHaveBeenCalled();
    // A genuine runtime failure is still worth a console error.
    expect(consoleError).toHaveBeenCalled();
  });

  it('does not disclose a txid that is absent from both histories', async () => {
    const { vault, getHistory, backend, publicHistory } = createVault();
    getHistory.mockResolvedValue([]);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

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
    // A pending (not yet indexed) tx is the normal state, not a runtime error.
    expect(consoleError).not.toHaveBeenCalled();
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
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(vault.fetchAccountHistoryDetail(params)).rejects.toThrow(
      'local history unavailable',
    );
    expect(publicHistory).not.toHaveBeenCalled();
    expect(backend).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
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
        simpleDb: {
          privacyChainState: { getZcashAccountMeta: jest.fn(async () => null) },
        },
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

  // Raw I/O detail requests carry no account address and Transparent Mode
  // writes no viewing metadata, so the account t-address must answer.
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
          privacyChainState: {
            getZcashPrivacyModeState: jest.fn(async () => ({ intent: 'on' })),
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
      getSyncProgress: async () => ({ chainTip: 10 }),
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
