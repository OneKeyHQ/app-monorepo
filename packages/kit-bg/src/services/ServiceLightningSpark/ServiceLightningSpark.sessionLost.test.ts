/*
yarn jest packages/kit-bg/src/services/ServiceLightningSpark/ServiceLightningSpark.sessionLost.test.ts

In the extension the SDK runs in the offscreen document. When that document
is reloaded or replaced the session ends without a disconnect call; the
service then starts over and connects again while a Spark screen is open.
*/

// --- mocks MUST be defined before the import of ServiceLightningSpark ---

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  backgroundMethodForDev:
    () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
      d,
}));

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    LockApp: 'LockApp',
    UnlockApp: 'UnlockApp',
    AccountDataUpdate: 'AccountDataUpdate',
    HistoryTxStatusChanged: 'HistoryTxStatusChanged',
  },
  appEventBus: { on: jest.fn(), emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { lightning: { spark: { sessionLost: jest.fn() } } },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/appRestart/beforeAppRestart',
  () => ({ addBeforeAppRestartHandler: jest.fn() }),
);

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
  InvalidLightningPaymentRequest: Error,
}));

jest.mock('@onekeyhq/shared/types/setting', () => ({
  EReasonForNeedPassword: { Default: 'Default' },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/core/src/chains/spark/utils', () => ({
  getSparkNetworkFromImpl: jest.fn(),
}));

jest.mock('../../vaults/factory', () => ({
  vaultFactory: {},
}));

jest.mock('./sdk/breezSdk', () => ({
  loadBreezSdk: jest.fn(),
}));

/* eslint-disable import/first, import/order */
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { loadBreezSdk } from './sdk/breezSdk';
import ServiceLightningSpark from './ServiceLightningSpark';

import type { ISparkSdk } from './sdk/types';
/* eslint-enable import/first, import/order */

const sparkLog = defaultLogger.lightning.spark as unknown as Record<
  'sessionLost',
  jest.Mock
>;

type ISparkInternals = {
  sdk: unknown;
  connectHeldSession: () => Promise<void>;
  connectGeneration: number;
  connectWithChildMnemonic: (params: {
    intent: {
      walletId: string;
      generation: number;
      cancelled: boolean;
      settled: Promise<void>;
    };
    network: string;
    apiKey: string;
    childMnemonic: string;
  }) => Promise<unknown>;
};

function makeSdk() {
  let lost: (() => void) | undefined;
  const sdk = {
    addEventListener: jest.fn(async () => 'listener-1'),
    getUserSettings: jest.fn(async () => ({ sparkPrivateModeEnabled: false })),
    updateUserSettings: jest.fn(async () => undefined),
    getInfo: jest.fn(async () => ({ identityPubkey: '02ab', balanceSats: 0 })),
    disconnect: jest.fn(async () => undefined),
    onSessionLost: jest.fn((listener: () => void) => {
      lost = listener;
    }),
  };
  return { sdk, loseSession: () => lost?.() };
}

async function setup() {
  const first = makeSdk();
  const breez = {
    defaultConfig: jest.fn(() => ({})),
    connect: jest.fn(async () => first.sdk as unknown as ISparkSdk),
  };
  jest.mocked(loadBreezSdk).mockResolvedValue(breez as never);
  const service = new ServiceLightningSpark({ backgroundApi: {} });
  const internals = service as unknown as ISparkInternals;
  const connectHeldSession = jest
    .spyOn(internals, 'connectHeldSession')
    .mockResolvedValue(undefined);
  await internals.connectWithChildMnemonic({
    intent: {
      walletId: 'hd-1',
      generation: internals.connectGeneration,
      cancelled: false,
      settled: Promise.resolve(),
    },
    network: 'mainnet',
    apiKey: 'test-key',
    childMnemonic: 'test mnemonic',
  });
  return { service, internals, first, connectHeldSession };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ServiceLightningSpark when the offscreen session is lost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts over and connects the held session again', async () => {
    const { internals, first, connectHeldSession } = await setup();
    expect(internals.sdk).toBe(first.sdk);

    first.loseSession();
    await flush();

    expect(sparkLog.sessionLost).toHaveBeenCalledTimes(1);
    expect(first.sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
    expect(connectHeldSession).toHaveBeenCalledTimes(1);
  });

  it('ignores the loss of a session the service already left', async () => {
    const { service, first, connectHeldSession } = await setup();
    await service.disconnect();

    first.loseSession();
    await flush();

    expect(sparkLog.sessionLost).not.toHaveBeenCalled();
    expect(connectHeldSession).not.toHaveBeenCalled();
  });
});
