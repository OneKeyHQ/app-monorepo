/*
yarn jest packages/kit-bg/src/services/ServiceStarknetPrivacy/index.test.ts
*/

const starknetPrivacy = {
  getRecord: jest.fn(),
  recordConsent: jest.fn(),
  patchRecord: jest.fn(),
  setOptInStatus: jest.fn(),
};

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    get starknetPrivacy() {
      return starknetPrivacy;
    },
  },
}));

const getVault = jest.fn<Promise<unknown>, unknown[]>();
jest.mock('../../vaults/factory', () => ({
  __esModule: true,
  vaultFactory: {
    getVault: (...args: unknown[]) => getVault(...args),
    getChainOnlyVault: (...args: unknown[]) => getVault(...args),
  },
}));

// eslint-disable-next-line import/first, import-path/forbidden
import ServiceStarknetPrivacy from './index';

// eslint-disable-next-line import/first
import { ETranslations } from '@onekeyhq/shared/src/locale';
// eslint-disable-next-line import/first
import {
  EStrk20ErrorCode,
  EStrk20SequencingStatus,
} from '@onekeyhq/shared/types/starknetPrivacy';

// eslint-disable-next-line import/first
import { STRK20_PRIVACY_CONFIG } from '../../vaults/impls/starknet/sdkStarknet/consts';
// eslint-disable-next-line import/first
import { isSpecVersionAtLeast } from '../../vaults/impls/starknet/strk20Protocol';
// eslint-disable-next-line import/first
import { setLocalWalletRemoteConfigs } from '../../vaults/localWallet/remoteConfig';

const NETWORK_ID = 'starknet--mainnet';
const ACCOUNT_ID = "hd-1--m/44'/9004'/0'/0/0";
const MAINNET_POOL =
  '0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a';
const ACCOUNT_ADDRESS =
  '0x0157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec';

function buildService(options?: {
  specVersion?: string;
  isAccountDeployed?: boolean;
  blockNumber?: number;
  privacyPool?: unknown;
}) {
  const client = {
    getSpecVersion: jest.fn(async () => options?.specVersion ?? '0.10.2'),
    isAccountDeployed: jest.fn(async () => options?.isAccountDeployed ?? true),
    getBlockNumber: jest.fn(async () => options?.blockNumber ?? 1000),
  };
  const vault = {
    getClient: async () => client,
    getAccountAddress: async () => ACCOUNT_ADDRESS,
    getAccount: async () => ({
      address: ACCOUNT_ADDRESS,
      path: "m/44'/9004'/0'/0/0",
    }),
    getNetwork: async () => ({ chainId: '0x534e5f4d41494e' }),
  };
  getVault.mockResolvedValue(vault);

  const privacyPool =
    options && 'privacyPool' in options
      ? options.privacyPool
      : {
          sequencingCooldownBlocks: 10,
        };

  const backgroundApi = {
    serviceNetwork: {
      getVaultSettings: jest.fn(async () => ({ privacyPool })),
    },
    serviceCustomRpc: {
      ensureLocalWalletRemoteConfigLoaded: jest.fn(async () => undefined),
    },
  };
  const service = new ServiceStarknetPrivacy({
    backgroundApi:
      backgroundApi as unknown as import('../../apis/IBackgroundApi').IBackgroundApi,
  });
  return { service, client, backgroundApi };
}

const previousBackgroundScope = globalThis.$onekeyIsInBackground;

beforeAll(() => {
  // @backgroundClass() refuses to construct outside the background runtime
  globalThis.$onekeyIsInBackground = true;
});

afterAll(() => {
  globalThis.$onekeyIsInBackground = previousBackgroundScope;
});

beforeEach(() => {
  jest.clearAllMocks();
  setLocalWalletRemoteConfigs({});
  starknetPrivacy.getRecord.mockResolvedValue(undefined);
});

describe('isSpecVersionAtLeast', () => {
  it.each([
    ['0.10.2', '0.10.1', true],
    ['0.10.1', '0.10.1', true],
    ['0.10.0', '0.10.1', false],
    ['0.9.0', '0.10.1', false],
    ['1.0.0', '0.10.1', true],
    ['0.11', '0.10.1', true],
  ])('%s >= %s is %s', (actual, minimum, expected) => {
    expect(isSpecVersionAtLeast(actual, minimum)).toBe(expected);
  });
});

describe('STRK20_PRIVACY_CONFIG', () => {
  it('routes mainnet proving through the OneKey wallet proxy', () => {
    expect(STRK20_PRIVACY_CONFIG[NETWORK_ID]).toMatchObject({
      provingKind: 'starkscan',
      provingUrl: '',
    });
  });
  it('pins the operator-provided Discovery public key without a relay', () => {
    const config = STRK20_PRIVACY_CONFIG[NETWORK_ID];
    expect(config.ohttp?.relayUrl).toBeUndefined();
    expect(
      Buffer.from(
        config.ohttp?.publicKeyConfig?.replace(/^0x/, '') ?? '',
        'hex',
      ).toString('base64'),
    ).toBe('ACkAACCeGbuojwxfTxCRM3ekNnJlvdWbfUNe6Dy6MynzXiY5OQAEAAEAAQ==');
  });
  // Built in, so nothing checks it at runtime: plaintext http would put the
  // viewing key on the wire, and an unpinned key config lets the SDK trust the
  // first /ohttp-keys response it sees.
  it.each(Object.values(STRK20_PRIVACY_CONFIG))(
    'keeps $networkId on https with a pinned OHTTP key config',
    (config) => {
      expect(config.discoveryUrl).toMatch(/^https:\/\//);
      if (config.provingKind !== 'starkscan') {
        expect(config.provingUrl).toMatch(/^https:\/\//);
      }
      expect(config.ohttp?.enabled).toBe(true);
      expect(config.ohttp?.publicKeyConfig).toMatch(/^0x(?:[0-9a-f]{2})+$/i);
    },
  );
});

describe('ServiceStarknetPrivacy.getPrivacyConfig', () => {
  it('returns the built-in config', async () => {
    const { service } = buildService();
    const config = await service.getPrivacyConfig({ networkId: NETWORK_ID });
    expect(config?.poolAddress).toBe(MAINNET_POOL);
    expect(config?.discoveryUrl).toBe('https://discovery.nodes.starknet.org');
  });

  it('returns undefined for a network without one', async () => {
    const { service } = buildService();
    await expect(
      service.getPrivacyConfig({ networkId: 'evm--1' }),
    ).resolves.toBeUndefined();
  });
});

describe('ServiceStarknetPrivacy.isPrivacyAvailable', () => {
  it('is available with direct pinned-OHTTP Discovery and a supported node', async () => {
    const { service } = buildService();
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID }),
    ).resolves.toBe(true);
    expect(STRK20_PRIVACY_CONFIG[NETWORK_ID].ohttp?.relayUrl).toBeUndefined();
  });

  it('is false once the server switches privacy off', async () => {
    setLocalWalletRemoteConfigs({ [NETWORK_ID]: { privacyDisabled: true } });
    const { service, backgroundApi } = buildService();
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID }),
    ).resolves.toBe(false);
    expect(
      backgroundApi.serviceCustomRpc.ensureLocalWalletRemoteConfigLoaded,
    ).toHaveBeenCalled();
  });

  it('is false when the chain has no privacyPool descriptor', async () => {
    const { service } = buildService({ privacyPool: undefined });
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID }),
    ).resolves.toBe(false);
  });

  it('is false against a node that cannot carry a proof', async () => {
    const { service } = buildService({ specVersion: '0.9.0' });
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID }),
    ).resolves.toBe(false);
  });

  it.each([
    ['watching', 'watching--9004--0xabc'],
    ['external', 'external--9004--0xabc'],
  ])('is false for a %s account', async (_name, accountId) => {
    const { service } = buildService();
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID, accountId }),
    ).resolves.toBe(false);
  });

  it('allows a deployed hardware account through the same privacy capability gate', async () => {
    const { service } = buildService();
    await expect(
      service.isPrivacyAvailable({
        networkId: NETWORK_ID,
        accountId: "hw-1--m/44'/9004'/0'/0/0",
      }),
    ).resolves.toBe(true);
  });

  it('allows an undeployed account to enter the activation flow', async () => {
    const { service } = buildService({ isAccountDeployed: false });
    await expect(
      service.isPrivacyAvailable({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).resolves.toBe(true);
  });
});

describe('ServiceStarknetPrivacy with privacy switched off by the server', () => {
  it('refuses private operations', async () => {
    setLocalWalletRemoteConfigs({ [NETWORK_ID]: { privacyDisabled: true } });
    const { service } = buildService();
    await expect(
      service.refreshPrivateBalances({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).rejects.toMatchObject({
      key: ETranslations.global_not_available,
      data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Unavailable },
    });
  });
});

describe('ServiceStarknetPrivacy.getSequencingState', () => {
  it('is ready and proves nine blocks back when nothing has landed', async () => {
    const { service } = buildService({ blockNumber: 1000 });
    await expect(
      service.getSequencingState({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).resolves.toMatchObject({
      status: EStrk20SequencingStatus.Ready,
      latestBlock: 1000,
      blocksRemaining: 0,
      provingBlockId: 991,
    });
  });

  it('waits out the remaining blocks after a recent transaction', async () => {
    starknetPrivacy.getRecord.mockResolvedValue({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      lastTxBlockNumber: 996,
      optInStatus: 'registered',
    });
    const { service } = buildService({ blockNumber: 1000 });
    const state = await service.getSequencingState({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
    });
    expect(state).toMatchObject({
      status: EStrk20SequencingStatus.Waiting,
      blocksRemaining: 6,
      lastTxBlockNumber: 996,
    });
    // 2s per block, measured; never a provingBlockId while waiting
    expect(state.estimatedSecondsRemaining).toBe(12);
    expect(state.provingBlockId).toBeUndefined();
  });

  it('becomes ready exactly at the cooldown boundary', async () => {
    starknetPrivacy.getRecord.mockResolvedValue({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      lastTxBlockNumber: 990,
      optInStatus: 'registered',
    });
    const { service } = buildService({ blockNumber: 1000 });
    await expect(
      service.getSequencingState({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).resolves.toMatchObject({
      status: EStrk20SequencingStatus.Ready,
      blocksRemaining: 0,
      provingBlockId: 991,
    });
  });

  it('is unavailable on a chain with no privacy pool', async () => {
    const { service } = buildService({ privacyPool: undefined });
    await expect(
      service.getSequencingState({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).resolves.toMatchObject({
      status: EStrk20SequencingStatus.Unavailable,
    });
  });
});

describe('ServiceStarknetPrivacy.noteAccountTouchedByTx', () => {
  it('does nothing when the account has no privacy record', async () => {
    const { service } = buildService();
    await service.noteAccountTouchedByTx({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      blockNumber: 1000,
    });
    expect(starknetPrivacy.patchRecord).not.toHaveBeenCalled();
  });

  it('stamps a later block', async () => {
    starknetPrivacy.getRecord.mockResolvedValue({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      lastTxBlockNumber: 900,
    });
    const { service } = buildService();
    await service.noteAccountTouchedByTx({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      blockNumber: 1000,
    });
    expect(starknetPrivacy.patchRecord).toHaveBeenCalledWith(
      expect.objectContaining({ patch: { lastTxBlockNumber: 1000 } }),
    );
  });

  it('never rewinds on a late receipt', async () => {
    starknetPrivacy.getRecord.mockResolvedValue({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      lastTxBlockNumber: 1000,
    });
    const { service } = buildService();
    await service.noteAccountTouchedByTx({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      blockNumber: 990,
    });
    expect(starknetPrivacy.patchRecord).not.toHaveBeenCalled();
  });
});

describe('first-use privacy sequencing', () => {
  it('requires account activation before a proof can be prepared', async () => {
    const { service } = buildService({ isAccountDeployed: false });
    await expect(
      service.getSequencingState({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).resolves.toMatchObject({
      status: EStrk20SequencingStatus.ActivationRequired,
    });
  });

  it('waits when the account exists at the head but not at the proof block', async () => {
    const { service, client } = buildService();
    client.isAccountDeployed
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(
      service.getSequencingState({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).resolves.toMatchObject({ status: EStrk20SequencingStatus.Waiting });
    expect(client.isAccountDeployed).toHaveBeenLastCalledWith(ACCOUNT_ADDRESS, {
      block_number: 991,
    });
  });

  it('does not rebuild a deployment while its receipt is unknown', async () => {
    starknetPrivacy.getRecord.mockResolvedValue({
      networkId: NETWORK_ID,
      accountId: ACCOUNT_ID,
      activationTxid: '0xabc',
      optInStatus: 'consented',
    });
    const { service, client } = buildService();
    Object.assign(client, { getTransactionReceipt: jest.fn(async () => null) });
    await expect(
      service.prepareAccountActivation({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).rejects.toMatchObject({
      data: { starknetPrivacyErrorCode: EStrk20ErrorCode.Waiting },
    });
  });
});
