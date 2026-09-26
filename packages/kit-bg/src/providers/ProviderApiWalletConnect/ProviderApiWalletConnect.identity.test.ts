import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { RuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import { EWalletConnectSessionEvents } from '@onekeyhq/shared/src/walletConnect/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import { SimpleDbEntityDappConnection } from '../../dbs/simple/entity/SimpleDbEntityDappConnection';
import ServiceDApp from '../../services/ServiceDApp';

import ProviderApiWalletConnect from './ProviderApiWalletConnect';
import { WalletConnectRequestProxy } from './WalletConnectRequestProxy';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDappConnectionData } from '../../dbs/simple/entity/SimpleDbEntityDappConnection';
import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';
import type { Verify } from '@walletconnect/types';

let mockStored = '';
let mockWriteQueue = Promise.resolve();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    discovery: { dapp: { dappUse: jest.fn(), dappOpenModal: jest.fn() } },
  },
}));
jest.mock('../../dbs/simple/base/SimpleDbEntityBase', () => ({
  SimpleDbEntityBase: class {
    async getRawData(): Promise<IDappConnectionData | undefined> {
      return mockStored
        ? (JSON.parse(mockStored) as IDappConnectionData)
        : undefined;
    }

    async setRawData(
      update: (data?: IDappConnectionData) => IDappConnectionData,
    ) {
      // Match SimpleDB's serialized read-modify-write boundary.
      mockWriteQueue = mockWriteQueue.then(async () => {
        mockStored = JSON.stringify(update(await this.getRawData()));
      });
      await mockWriteQueue;
    }
  },
}));
jest.mock('../../services/ServiceBase', () => ({
  __esModule: true,
  // oxlint-disable-next-line max-classes-per-file -- Service and storage boundaries use separate test doubles.
  default: class {
    backgroundApi: IBackgroundApi;

    constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironment: async () =>
      RuntimeEnvironment.create(getTravelModeRuntimeProfile(false)),
  },
}));
jest.mock('../../services/ServiceWalletConnect/walletConnectClient', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../backgroundProviders', () => ({ providerApiLoaders: {} }));
jest.mock('../../vaults/factory', () => ({ vaultFactory: {} }));
jest.mock('../../states/jotai/atoms', () => ({ settingsPersistAtom: {} }));
jest.mock('./WalletConnectRequestProxyAlgo', () => ({
  WalletConnectRequestProxyAlgo: jest.fn(),
}));
jest.mock('./WalletConnectRequestProxyCosmos', () => ({
  WalletConnectRequestProxyCosmos: jest.fn(),
}));
jest.mock('./WalletConnectRequestProxyEth', () => ({
  WalletConnectRequestProxyEth: jest.fn(),
}));

describe('WalletConnect persisted display identity', () => {
  beforeEach(() => {
    mockStored = '';
    mockWriteQueue = Promise.resolve();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([
    ['VALID', 'https://help.onekey.so/path', 'https://help.onekey.so'],
    ['INVALID', 'https://actual.example/path', 'https://actual.example'],
    ['UNKNOWN', 'https://help.onekey.so', ''],
    ['INVALID', 'https://help.onekey.so', ''],
    [undefined, 'https://help.onekey.so', ''],
  ] as const)(
    'retains %s display identity after approval and storage reload',
    async (validation, verifiedOrigin, displayOrigin) => {
      const origin = 'https://help.onekey.so';
      const buildWebsiteIconUrl = jest.fn(
        async (url: string) => `https://icons.example/${new URL(url).host}`,
      );
      const backgroundApi = {
        simpleDb: { dappConnection: new SimpleDbEntityDappConnection() },
        serviceDiscovery: { buildWebsiteIconUrl },
        serviceSignature: { addConnectedSite: jest.fn() },
        serviceWalletConnect: {
          getNotSupportedChains: jest.fn(async () => []),
          batchEmitNetworkChangedEvent: jest.fn(),
          getActiveSessions: jest.fn(async () => ({ 'session-topic': {} })),
        },
        serviceDApp: undefined as ServiceDApp | undefined,
      };
      const service = new ServiceDApp({ backgroundApi });
      backgroundApi.serviceDApp = service;
      jest.spyOn(service, 'openModal').mockResolvedValue({
        accountsInfo: [],
        supportedNamespaces: {},
        // UI-returned identity must not override the original proposal.
        displayOrigin: 'https://forged.example',
      });
      jest
        .spyOn(service, 'syncDappAccountIfPrimaryMode')
        .mockResolvedValue(undefined);
      const provider = new ProviderApiWalletConnect({ backgroundApi });
      const on = jest.fn();
      const rejectSession = jest.fn();
      provider.web3Wallet = {
        on,
        engine: { signClient: { events: { on: jest.fn() } } },
        approveSession: jest.fn(async () => ({ topic: 'session-topic' })),
        rejectSession,
      } as unknown as IWalletKit;
      provider.registerEvents();
      const listener = on.mock.calls.find(
        ([event]) => event === EWalletConnectSessionEvents.session_proposal,
      )?.[1] as (proposal: WalletKitTypes.SessionProposal) => Promise<void>;
      const proposal: WalletKitTypes.SessionProposal = {
        id: 1,
        params: {
          id: 1,
          expiryTimestamp: 2,
          pairingTopic: 'pairing-topic',
          relays: [{ protocol: 'irn' }],
          proposer: {
            publicKey: 'test-key',
            metadata: {
              name: 'Claimed site',
              description: '',
              url: origin,
              icons: [],
            },
          },
          requiredNamespaces: {},
          optionalNamespaces: {},
        },
        verifyContext: {
          verified: {
            validation: validation ?? 'UNKNOWN',
            origin: verifiedOrigin,
            verifyUrl: 'https://verify.walletconnect.org',
          },
        },
      };
      if (!validation) Reflect.deleteProperty(proposal, 'verifyContext');

      await listener(proposal);

      expect(rejectSession).not.toHaveBeenCalled();
      // Read a fresh deserialized record, including the original protocol key.
      backgroundApi.simpleDb.dappConnection =
        new SimpleDbEntityDappConnection();
      const saved = await backgroundApi.simpleDb.dappConnection.getRawData();
      expect(Object.keys(saved?.data.walletConnect ?? {})).toEqual([
        'session-topic',
      ]);
      expect(saved?.data.walletConnect['session-topic']).toMatchObject({
        origin,
        displayOrigin,
        imageURL: displayOrigin
          ? `https://icons.example/${new URL(displayOrigin).host}`
          : '',
        walletConnectTopic: 'session-topic',
      });
      expect((await service.getAllConnectedList())[0]).toMatchObject({
        origin,
        displayOrigin,
        storageType: 'walletConnect',
      });
      if (displayOrigin) {
        expect(buildWebsiteIconUrl).toHaveBeenCalledWith(displayOrigin, 128);
      } else {
        expect(buildWebsiteIconUrl).not.toHaveBeenCalled();
      }
    },
  );

  it('clears an old verified icon when an existing record becomes unverified', async () => {
    const entity = new SimpleDbEntityDappConnection();
    const connection = {
      origin: 'https://help.onekey.so',
      accountsInfo: [],
      storageType: 'walletConnect' as const,
      walletConnectTopic: 'old-topic',
    };
    await entity.upsertConnection({
      ...connection,
      displayOrigin: connection.origin,
      imageURL: 'https://icons.example/help.onekey.so',
    });
    await entity.upsertConnection({
      ...connection,
      walletConnectTopic: 'old-topic',
      displayOrigin: '',
      imageURL: '',
    });
    const saved = await new SimpleDbEntityDappConnection().getRawData();
    expect(saved?.data.walletConnect['old-topic']).toMatchObject({
      displayOrigin: '',
      imageURL: '',
      walletConnectTopic: 'old-topic',
    });
  });
});

const claimedOrigin = 'https://help.onekey.so';
const makeAccount = (id: string): IConnectionAccountInfo => ({
  networkImpl: 'evm',
  walletId: `wallet-${id}`,
  accountId: `account-${id}`,
  networkId: 'evm--1',
  address: `address-${id}`,
  indexedAccountId: '',
  othersWalletAccountId: '',
  deriveType: 'default',
  focusedWallet: `wallet-${id}`,
});

function createSessionFixture() {
  const disconnect = jest.fn(async (_topic: string) => {});
  const backgroundApi = {
    simpleDb: { dappConnection: new SimpleDbEntityDappConnection() },
    serviceDiscovery: {
      buildWebsiteIconUrl: jest.fn(async (origin: string) => origin),
    },
    serviceSignature: { addConnectedSite: jest.fn() },
    serviceWalletConnect: {
      walletConnectDisconnect: disconnect,
      updateNamespaceAndSession: jest.fn(),
    },
    serviceDApp: undefined as ServiceDApp | undefined,
  };
  const service = new ServiceDApp({ backgroundApi });
  backgroundApi.serviceDApp = service;
  const syncPrimaryAccount = jest
    .spyOn(service, 'syncDappAccountIfPrimaryMode')
    .mockResolvedValue();
  jest
    .spyOn(service, 'notifyDAppAccountsChangedAfterConnected')
    .mockResolvedValue();
  jest.spyOn(service, 'notifyDAppAccountsChanged').mockResolvedValue();
  const save = (topic: string, displayOrigin = claimedOrigin) =>
    service.saveConnectionSession({
      origin: claimedOrigin,
      displayOrigin,
      accountsInfo: [makeAccount(topic)],
      storageType: 'walletConnect',
      walletConnectTopic: topic,
    });
  return {
    backgroundApi,
    service,
    entity: backgroundApi.simpleDb.dappConnection,
    disconnect,
    syncPrimaryAccount,
    save,
  };
}

describe('WalletConnect topic isolation', () => {
  beforeEach(() => {
    mockStored = '';
    mockWriteQueue = Promise.resolve();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([false, true])(
    'keeps same-origin sessions separate (concurrent: %s)',
    async (concurrent) => {
      const { save, entity, service, disconnect, syncPrimaryAccount } =
        createSessionFixture();
      await entity.upsertConnection({
        origin: claimedOrigin,
        accountsInfo: [makeAccount('injected')],
        storageType: 'injectedProvider',
      });
      if (concurrent) {
        await Promise.all([save('trusted'), save('unverified', '')]);
      } else {
        await save('trusted');
        await save('unverified', '');
      }
      const restored = await new SimpleDbEntityDappConnection().getRawData();
      expect(
        Object.keys(restored?.data.walletConnect ?? {}).toSorted(),
      ).toEqual(['trusted', 'unverified']);
      expect(restored?.data.walletConnect.trusted.displayOrigin).toBe(
        claimedOrigin,
      );
      expect(restored?.data.walletConnect.unverified).toMatchObject({
        displayOrigin: '',
        imageURL: '',
      });
      expect(restored?.data.injectedProvider[claimedOrigin]).toBeDefined();
      expect(disconnect).not.toHaveBeenCalled();
      expect(syncPrimaryAccount).not.toHaveBeenCalled();

      // Request identity follows the SDK topic, regardless of claimed/verified URL.
      const accounts = await service.getConnectedAccountsInfo({
        origin: 'https://different-verified-origin.example',
        scope: IInjectedProviderNames.ethereum,
        isWalletConnectRequest: true,
        walletConnectTopic: 'trusted',
      });
      expect(accounts).toEqual([
        expect.objectContaining(makeAccount('trusted')),
      ]);
      await service.disconnectWebsite({
        origin: claimedOrigin,
        storageType: 'walletConnect',
        walletConnectTopic: 'unverified',
      });
      expect(disconnect).toHaveBeenCalledWith('unverified');
      expect(await entity.getWalletConnectConnection('trusted')).toBeDefined();
      expect(
        await entity.getWalletConnectConnection('unverified'),
      ).toBeUndefined();
      expect(
        (await entity.getRawData())?.data.injectedProvider[claimedOrigin],
      ).toBeDefined();
    },
  );

  it('does not delete a new same-origin session when an old disconnect completes late', async () => {
    const { save, entity, service, disconnect } = createSessionFixture();
    await save('old', '');
    let release = () => {};
    let started = () => {};
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    disconnect.mockImplementationOnce(async () => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const pending = service.disconnectWebsite({
      origin: claimedOrigin,
      storageType: 'walletConnect',
      walletConnectTopic: 'old',
    });
    await entered;
    await save('new');
    release();
    await pending;
    expect(await entity.getWalletConnectConnection('old')).toBeUndefined();
    expect(await entity.getWalletConnectConnection('new')).toMatchObject({
      displayOrigin: claimedOrigin,
    });
  });

  it('updates accounts and networks only for the selected topic', async () => {
    const { save, entity, service, backgroundApi } = createSessionFixture();
    await save('a');
    await save('b');
    const a = await entity.getWalletConnectConnection('a');
    const b = await entity.getWalletConnectConnection('b');
    const num = Number(Object.keys(a.connectionMap)[0]);
    const changed = makeAccount('changed');
    await service.updateConnectionSession({
      origin: claimedOrigin,
      storageType: 'walletConnect',
      walletConnectTopic: 'a',
      accountSelectorNum: num,
      updatedAccountInfo: changed,
    });
    expect(
      backgroundApi.serviceWalletConnect.updateNamespaceAndSession,
    ).toHaveBeenCalledWith('a', [changed]);
    await entity.updateNetworkId(
      claimedOrigin,
      'evm',
      'evm--137',
      'walletConnect',
      'a',
    );
    expect(
      await entity.getAccountSelectorMap({
        sceneUrl: accountSelectorUtils.buildWalletConnectSceneUrl({
          topic: 'a',
        }),
      }),
    ).toEqual({
      [num]: { ...changed, networkId: 'evm--137' },
    });
    expect(
      await entity.getAccountSelectorMap({
        sceneUrl: accountSelectorUtils.buildWalletConnectSceneUrl({
          topic: 'b',
        }),
      }),
    ).toEqual(b.connectionMap);
    expect(await entity.getWalletConnectConnection('b')).toEqual(b);
    expect(
      await entity.getAccountSelectorMap({ sceneUrl: claimedOrigin }),
    ).toBeUndefined();
  });

  it('rejects requests without a topic and never borrows another topic authorization', async () => {
    const { save, service, entity } = createSessionFixture();
    await save('known');
    const params = {
      origin: claimedOrigin,
      scope: IInjectedProviderNames.ethereum,
      isWalletConnectRequest: true,
    };
    await expect(service.getConnectedAccountsInfo(params)).rejects.toThrow(
      'WalletConnect topic is required',
    );
    await expect(
      service.getConnectedAccountsInfo({
        ...params,
        walletConnectTopic: 'unknown',
      }),
    ).resolves.toBeNull();
    await expect(
      service.disconnectWebsite({
        origin: claimedOrigin,
        storageType: 'walletConnect',
      }),
    ).rejects.toThrow('WalletConnect topic is required');
    expect(await entity.getWalletConnectConnection('known')).toBeDefined();
  });

  it('reads and updates legacy records by their saved topic without merging same-origin sessions', async () => {
    const { save, service, entity } = createSessionFixture();
    await save('legacy');
    const raw = await entity.getRawData();
    if (!raw) throw new OneKeyLocalError('Missing fixture record');
    raw.data.walletConnect[claimedOrigin] = raw.data.walletConnect.legacy;
    delete raw.data.walletConnect.legacy;
    mockStored = JSON.stringify(raw);
    await save('new', '');
    const legacy = await entity.getWalletConnectConnection('legacy');
    expect(legacy.walletConnectTopic).toBe('legacy');
    expect(
      await entity.getAccountSelectorMap({
        sceneUrl: accountSelectorUtils.buildWalletConnectSceneUrl({
          topic: 'legacy',
        }),
      }),
    ).toEqual(legacy.connectionMap);
    await entity.updateNetworkId(
      claimedOrigin,
      'evm',
      'evm--137',
      'walletConnect',
      'legacy',
    );
    expect(
      (await entity.getWalletConnectConnection('legacy')).connectionMap[1000]
        .networkId,
    ).toBe('evm--137');
    expect(
      (await entity.getWalletConnectConnection('new')).connectionMap[1000]
        .networkId,
    ).toBe('evm--1');
    await service.disconnectWebsite({
      origin: claimedOrigin,
      storageType: 'walletConnect',
      walletConnectTopic: 'legacy',
    });
    expect(await entity.getWalletConnectConnection('legacy')).toBeUndefined();
    expect(await entity.getWalletConnectConnection('new')).toBeDefined();
  });

  it('does not let stale inactive-session cleanup remove a newly approved session', async () => {
    const { save, service, entity, disconnect } = createSessionFixture();
    await save('expired');
    const raw = await entity.getRawData();
    await save('new');
    await service.disconnectInactiveSessions(
      raw?.data.walletConnect ?? {},
      new Set(),
    );
    expect(disconnect).toHaveBeenCalledWith('expired');
    expect(await entity.getWalletConnectConnection('new')).toBeDefined();
  });

  it('forwards the SDK topic instead of peer-controlled RPC data', async () => {
    const handleProviderMethods = jest.fn(async () => ({ result: 'ok' }));
    const provider = new ProviderApiWalletConnect({
      backgroundApi: { handleProviderMethods },
    });
    class TestRequestProxy extends WalletConnectRequestProxy {
      override providerName = IInjectedProviderNames.ethereum;
    }
    const proxy = new TestRequestProxy({ client: provider });
    const request: WalletKitTypes.SessionRequest = {
      id: 1,
      topic: 'sdk-topic',
      params: {
        chainId: 'eip155:1',
        request: { method: 'eth_accounts', params: [] },
      },
      verifyContext: {
        verified: {
          validation: 'UNKNOWN',
          origin: claimedOrigin,
          verifyUrl: '',
        },
      },
    };
    await proxy.request(
      { sessionRequest: request, wcChain: '1' },
      { method: 'eth_accounts', walletConnectTopic: 'forged-topic' },
    );
    expect(handleProviderMethods).toHaveBeenCalledWith(
      expect.objectContaining({
        isWalletConnectRequest: true,
        data: expect.objectContaining({ walletConnectTopic: 'sdk-topic' }),
      }),
    );
  });
});

describe('WalletConnect signing prompt identity', () => {
  const verifyContext = (
    validation: Verify.Context['verified']['validation'],
    origin = claimedOrigin,
  ): Verify.Context => ({
    verified: { validation, origin, verifyUrl: '' },
  });

  it.each([
    ['UNKNOWN', verifyContext('UNKNOWN'), ''],
    ['missing context', undefined, ''],
    ['missing verified', {} as Verify.Context, ''],
    ['empty origin', verifyContext('VALID', ''), ''],
    ['malformed origin', verifyContext('VALID', 'not a URL'), ''],
    ['VALID', verifyContext('VALID', `${claimedOrigin}/path`), claimedOrigin],
    ['INVALID copied metadata', verifyContext('INVALID'), ''],
    [
      'INVALID attested mismatch',
      verifyContext('INVALID', 'https://actual.example/path'),
      'https://actual.example',
    ],
  ] as const)(
    'carries only the SDK-attested display identity to serialized signing UI: %s',
    async (_name, context, expectedDisplayOrigin) => {
      let sourceInfo: IDappSourceInfo | undefined;
      let resolveModal: (value: unknown) => void = () => undefined;
      const service = new ServiceDApp({
        backgroundApi: {
          servicePromise: {
            createCallback: ({
              resolve,
            }: {
              resolve: (value: unknown) => void;
            }) => {
              resolveModal = resolve;
              return 'test-callback';
            },
          },
        },
      });
      jest
        .spyOn(service, 'tryOpenExistingExtensionWindow')
        .mockImplementation(() => undefined);
      jest
        .spyOn(service, '_openModalByRouteParamsDebounced')
        .mockImplementation(({ routeParams }) => {
          sourceInfo = (
            JSON.parse(routeParams.query) as { $sourceInfo: IDappSourceInfo }
          ).$sourceInfo;
          resolveModal('ok');
          return undefined;
        });
      const provider = new ProviderApiWalletConnect({
        backgroundApi: {
          handleProviderMethods: async (
            request: Parameters<ServiceDApp['openModal']>[0]['request'],
          ) => ({
            result: await service.openModal({
              request,
              screens: ['SignatureConfirm', 'MessageConfirm'],
            }),
          }),
        },
      });
      provider.web3Wallet = {
        getActiveSessions: () => ({
          'sdk-topic': {
            peer: { metadata: { url: `${claimedOrigin}/metadata-path` } },
          },
        }),
      } as unknown as IWalletKit;
      class SigningRequestProxy extends WalletConnectRequestProxy {
        override providerName = IInjectedProviderNames.ethereum;
      }
      const proxy = new SigningRequestProxy({ client: provider });
      const request = {
        id: 1,
        topic: 'sdk-topic',
        params: {
          chainId: 'eip155:1',
          request: { method: 'personal_sign', params: [] },
        },
        verifyContext: context,
      } as WalletKitTypes.SessionRequest;
      await proxy.request(
        { sessionRequest: request },
        {
          method: 'personal_sign',
          params: [],
          walletConnectTopic: 'forged-topic',
          walletConnectDisplayOrigin: 'https://forged.example',
          walletConnectVerifyContext: verifyContext(
            'VALID',
            'https://forged.example',
          ),
        },
      );
      expect(sourceInfo).toEqual(
        expect.objectContaining({
          displayOrigin: expectedDisplayOrigin,
          isWalletConnectRequest: true,
          walletConnectTopic: 'sdk-topic',
        }),
      );
      expect(sourceInfo?.walletConnectVerifyContext).toEqual(context);
      expect(sourceInfo?.origin).toBe(
        provider.getDAppOrigin({ sessionRequest: request }),
      );
      jest.restoreAllMocks();
    },
  );
});
