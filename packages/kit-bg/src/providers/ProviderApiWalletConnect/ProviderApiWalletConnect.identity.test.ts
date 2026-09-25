import { RuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';
import { EWalletConnectSessionEvents } from '@onekeyhq/shared/src/walletConnect/types';

import { SimpleDbEntityDappConnection } from '../../dbs/simple/entity/SimpleDbEntityDappConnection';
import ServiceDApp from '../../services/ServiceDApp';

import ProviderApiWalletConnect from './ProviderApiWalletConnect';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDappConnectionData } from '../../dbs/simple/entity/SimpleDbEntityDappConnection';
import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';

let mockStored = '';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    discovery: { dapp: { dappUse: jest.fn() } },
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
      mockStored = JSON.stringify(update(await this.getRawData()));
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
        .spyOn(service, 'deleteExistSessionBeforeConnect')
        .mockResolvedValue(undefined);
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
      expect(Object.keys(saved?.data.walletConnect ?? {})).toEqual([origin]);
      expect(saved?.data.walletConnect[origin]).toMatchObject({
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
      walletConnectTopic: 'new-topic',
      displayOrigin: '',
      imageURL: '',
    });
    const saved = await new SimpleDbEntityDappConnection().getRawData();
    expect(saved?.data.walletConnect[connection.origin]).toMatchObject({
      displayOrigin: '',
      imageURL: '',
      walletConnectTopic: 'new-topic',
    });
  });
});
