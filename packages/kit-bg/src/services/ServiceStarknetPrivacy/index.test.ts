/*
yarn jest packages/kit-bg/src/services/ServiceStarknetPrivacy/index.test.ts
*/

const starknetPrivacy = {
  getRecord: jest.fn(),
  upsertRecord: jest.fn(),
  patchRecord: jest.fn(),
  setOptInStatus: jest.fn(),
};
const starknetPrivacyConfig = {
  getEnvelope: jest.fn(),
  saveEnvelope: jest.fn(),
};

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {
    get starknetPrivacy() {
      return starknetPrivacy;
    },
    get starknetPrivacyConfig() {
      return starknetPrivacyConfig;
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

// eslint-disable-next-line import/first
import ServiceStarknetPrivacy, {
  isSpecVersionAtLeast,
  parseStrk20ConfigEnvelope,
  // eslint-disable-next-line import-path/forbidden
} from './index';

// eslint-disable-next-line import/first
import { EStrk20SequencingStatus } from '@onekeyhq/shared/types/starknetPrivacy';

const NETWORK_ID = 'starknet--sepolia';
const ACCOUNT_ID = "hd-1--m/44'/9004'/0'/0/0";
const SEPOLIA_POOL =
  '0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91';
const ACCOUNT_ADDRESS =
  '0x0157d9497dee8bbdc5e6a968a96a2408d10c6bf6cfe2b4509602952429d094ec';

const validConfig = {
  networkId: NETWORK_ID,
  enabled: true,
  poolAddress: SEPOLIA_POOL,
  discoveryUrl: 'https://discovery.example',
  provingUrl: 'https://prover.example',
  ohttp: { enabled: true, publicKeyConfig: '0xaabb' },
  auditorPublicKey: '0x01d17f',
  minRpcSpecVersion: '0.10.1',
};

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
    getNetwork: async () => ({ chainId: '0x534e5f5345504f4c4941' }),
  };
  getVault.mockResolvedValue(vault);

  const privacyPool =
    options && 'privacyPool' in options
      ? options.privacyPool
      : {
          activation: 'account-opt-in',
          balanceShape: 'pooled',
          poolsPerToken: true,
          requiresRegistration: true,
          sequencingCooldownBlocks: 10,
        };

  const backgroundApi = {
    serviceNetwork: {
      getVaultSettings: jest.fn(async () => ({ privacyPool })),
    },
  };
  const service = new ServiceStarknetPrivacy({ backgroundApi });
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
  starknetPrivacyConfig.getEnvelope.mockResolvedValue({
    envelope: undefined,
    syncedAt: undefined,
  });
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

describe('parseStrk20ConfigEnvelope', () => {
  const envelope = {
    version: 3,
    updatedAt: 1_758_000_000_000,
    configs: { [NETWORK_ID]: validConfig },
  };

  it('accepts a well-formed envelope', () => {
    expect(parseStrk20ConfigEnvelope(envelope).configs[NETWORK_ID]).toEqual(
      validConfig,
    );
  });

  it.each([
    ['no version', { ...envelope, version: '3' }],
    ['no updatedAt', { ...envelope, updatedAt: null }],
    ['no configs', { version: 1, updatedAt: 1 }],
    ['undefined', undefined],
  ])('rejects an envelope with %s', (_name, input) => {
    expect(() => parseStrk20ConfigEnvelope(input)).toThrow();
  });

  it('rejects a config missing any required field', () => {
    for (const field of [
      'enabled',
      'poolAddress',
      'discoveryUrl',
      'provingUrl',
      'auditorPublicKey',
      'minRpcSpecVersion',
    ]) {
      const broken = { ...validConfig } as Record<string, unknown>;
      delete broken[field];
      expect(() =>
        parseStrk20ConfigEnvelope({
          ...envelope,
          configs: { [NETWORK_ID]: broken },
        }),
      ).toThrow();
    }
  });

  it.each([
    ['discoveryUrl', 'http://discovery.example'],
    ['provingUrl', 'http://prover.example'],
  ])('refuses a plaintext %s when enabled', (field, url) => {
    expect(() =>
      parseStrk20ConfigEnvelope({
        ...envelope,
        configs: { [NETWORK_ID]: { ...validConfig, [field]: url } },
      }),
    ).toThrow(/non-https/);
  });

  describe('provingKind', () => {
    const parse = (overrides: Record<string, unknown>) =>
      parseStrk20ConfigEnvelope({
        ...envelope,
        configs: { [NETWORK_ID]: { ...validConfig, ...overrides } },
      });

    it('rejects an unknown kind', () => {
      expect(() => parse({ provingKind: 'rest' })).toThrow(/provingKind/);
    });

    it('rejects starkscan without a key when enabled', () => {
      expect(() => parse({ provingKind: 'starkscan' })).toThrow(/API key/);
      expect(() =>
        parse({ provingKind: 'starkscan', provingApiKey: '' }),
      ).toThrow(/API key/);
    });

    it('accepts starkscan without a key while disabled', () => {
      expect(() =>
        parse({ provingKind: 'starkscan', enabled: false }),
      ).not.toThrow();
    });

    it('passes kind and key through', () => {
      const parsed = parse({ provingKind: 'starkscan', provingApiKey: 'k-1' });
      expect(parsed.configs[NETWORK_ID]).toMatchObject({
        provingKind: 'starkscan',
        provingApiKey: 'k-1',
      });
    });
  });

  it('allows a plaintext endpoint while the feature is off', () => {
    // a disabled config never reaches the wire, so it is not malformed
    expect(() =>
      parseStrk20ConfigEnvelope({
        ...envelope,
        configs: {
          [NETWORK_ID]: {
            ...validConfig,
            enabled: false,
            discoveryUrl: 'http://discovery.example',
            ohttp: undefined,
          },
        },
      }),
    ).not.toThrow();
  });

  it('refuses to enable the feature without OHTTP', () => {
    expect(() =>
      parseStrk20ConfigEnvelope({
        ...envelope,
        configs: { [NETWORK_ID]: { ...validConfig, ohttp: undefined } },
      }),
    ).toThrow(/without OHTTP/);
  });

  it('refuses to enable the feature without a pinned key config', () => {
    // no pin means the SDK trusts the first /ohttp-keys response it sees
    expect(() =>
      parseStrk20ConfigEnvelope({
        ...envelope,
        configs: {
          [NETWORK_ID]: { ...validConfig, ohttp: { enabled: true } },
        },
      }),
    ).toThrow(/pinned OHTTP key config/);
  });

  it.each([
    ['a non-boolean enabled', { enabled: 'yes', publicKeyConfig: '0xaabb' }],
    [
      'a plaintext relay',
      {
        enabled: true,
        relayUrl: 'http://relay.example',
        publicKeyConfig: '0xaabb',
      },
    ],
    ['odd-length hex', { enabled: true, publicKeyConfig: '0xaab' }],
    ['non-hex', { enabled: true, publicKeyConfig: '0xzz' }],
    ['empty hex', { enabled: true, publicKeyConfig: '0x' }],
  ])('rejects an ohttp block with %s at parse time', (_name, ohttp) => {
    // catching this here keeps the last good envelope; catching it at send time
    // would surface as an unmapped error mid-transaction
    expect(() =>
      parseStrk20ConfigEnvelope({
        ...envelope,
        configs: { [NETWORK_ID]: { ...validConfig, ohttp } },
      }),
    ).toThrow(/ohttp config/);
  });

  it('refuses a config that claims enabled without endpoints', () => {
    expect(() =>
      parseStrk20ConfigEnvelope({
        ...envelope,
        configs: {
          [NETWORK_ID]: { ...validConfig, discoveryUrl: '', provingUrl: '' },
        },
      }),
    ).toThrow(/enabled without endpoints/);
  });
});

describe('ServiceStarknetPrivacy.getPrivacyConfig', () => {
  it('falls back to the bundled disabled config when nothing is stored', async () => {
    const { service } = buildService();
    const config = await service.getPrivacyConfig({ networkId: NETWORK_ID });
    expect(config?.enabled).toBe(false);
    expect(config?.poolAddress).toBe(SEPOLIA_POOL);
    expect(config?.discoveryUrl).toBe('');
  });

  it('prefers a stored envelope over the bundled fallback', async () => {
    starknetPrivacyConfig.getEnvelope.mockResolvedValue({
      envelope: {
        version: 1,
        updatedAt: 1,
        configs: { [NETWORK_ID]: validConfig },
      },
      syncedAt: Date.now(),
    });
    const { service } = buildService();
    await expect(
      service.getPrivacyConfig({ networkId: NETWORK_ID }),
    ).resolves.toEqual(validConfig);
  });

  it('returns undefined for a network with neither stored nor bundled config', async () => {
    const { service } = buildService();
    await expect(
      service.getPrivacyConfig({ networkId: 'evm--1' }),
    ).resolves.toBeUndefined();
  });
});

describe('ServiceStarknetPrivacy.isPrivacyAvailable', () => {
  const enableConfig = () => {
    starknetPrivacyConfig.getEnvelope.mockResolvedValue({
      envelope: {
        version: 1,
        updatedAt: 1,
        configs: { [NETWORK_ID]: validConfig },
      },
      syncedAt: Date.now(),
    });
  };

  it('is false while the bundled fallback is what we have', async () => {
    const { service } = buildService();
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID }),
    ).resolves.toBe(false);
  });

  it('is false when the chain has no privacyPool descriptor', async () => {
    enableConfig();
    const { service } = buildService({ privacyPool: undefined });
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID }),
    ).resolves.toBe(false);
  });

  it('is true with an enabled config and a 0.10.2 node', async () => {
    enableConfig();
    const { service } = buildService();
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID }),
    ).resolves.toBe(true);
  });

  it('is false against a node that cannot carry a proof', async () => {
    enableConfig();
    const { service } = buildService({ specVersion: '0.9.0' });
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID }),
    ).resolves.toBe(false);
  });

  it.each([
    ['watching', 'watching--9004--0xabc'],
    ['external', 'external--9004--0xabc'],
  ])('is false for a %s account', async (_name, accountId) => {
    enableConfig();
    const { service } = buildService();
    await expect(
      service.isPrivacyAvailable({ networkId: NETWORK_ID, accountId }),
    ).resolves.toBe(false);
  });

  it('is false for an account that is not deployed yet', async () => {
    enableConfig();
    const { service } = buildService({ isAccountDeployed: false });
    await expect(
      service.isPrivacyAvailable({
        networkId: NETWORK_ID,
        accountId: ACCOUNT_ID,
      }),
    ).resolves.toBe(false);
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
