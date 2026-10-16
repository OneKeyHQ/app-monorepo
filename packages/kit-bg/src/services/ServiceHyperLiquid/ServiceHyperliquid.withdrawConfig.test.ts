import ServiceHyperliquid from './ServiceHyperliquid';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IPerpsCommonConfigPersistAtom } from '../../states/jotai/atoms';
import type { IPerpServerConfigResponse } from '../ServiceWebviewPerp/ServiceWebviewPerp';

let configState: IPerpsCommonConfigPersistAtom;
const request = jest.fn();

jest.mock('p-timeout', () => ({
  __esModule: true,
  default: <T>(promise: Promise<T>) => promise,
}));
jest.mock('./hyperLiquidApiClients', () => ({ hyperLiquidApiClients: {} }));
jest.mock('@nktkas/hyperliquid', () => ({ HttpTransport: jest.fn() }));

jest.mock('../../states/jotai/atoms', () => ({
  perpsCommonConfigPersistAtom: {
    set: async (
      update: (
        previous: IPerpsCommonConfigPersistAtom,
      ) => IPerpsCommonConfigPersistAtom,
    ) => {
      configState = update(configState);
    },
  },
  perpTokenSelectorTabsAtom: { set: jest.fn() },
}));

describe('withdrawal policy configuration', () => {
  let service: ServiceHyperliquid;
  const previousScope = globalThis.$onekeyIsInBackground;

  beforeEach(() => {
    globalThis.$onekeyIsInBackground = true;
    request.mockReset();
    configState = { perpConfigCommon: {} };
    service = new ServiceHyperliquid({
      backgroundApi: {
        simpleDb: {
          perp: {
            getPerpData: async () => ({}),
            setPerpData: jest.fn(),
          },
        },
      } as unknown as IBackgroundApi,
    });
    jest.spyOn(service, 'parseDepositConfig').mockResolvedValue(undefined);
    jest.spyOn(service, 'getClient').mockResolvedValue({
      get: request,
    } as unknown as Awaited<ReturnType<typeof service.getClient>>);
  });
  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
    jest.restoreAllMocks();
  });

  const respond = (
    commonConfig?: IPerpServerConfigResponse['commonConfig'],
  ) => {
    request.mockResolvedValueOnce({
      data: {
        code: 0,
        message: '',
        data: { referrerConfig: {}, commonConfig },
      },
    });
  };

  it('enables the override, then clears it on a successful omitted field or cctp', async () => {
    for (const value of ['legacy', undefined, 'legacy', 'cctp'] as const) {
      respond(value === undefined ? undefined : { withdrawChannel: value });
      await service.updatePerpsConfigByServerSilently({ ignoreCache: true });
      expect(configState.perpConfigCommon.withdrawChannel).toBe(
        value === 'legacy' ? 'legacy' : 'cctp',
      );
    }
  });

  it('preserves the last successful policy on network failure and retries later', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    respond({ withdrawChannel: 'legacy' });
    await service.updatePerpsConfigByServerSilently({ ignoreCache: true });
    request.mockRejectedValueOnce(new Error('offline'));
    await service.updatePerpsConfigByServerSilently({ ignoreCache: true });
    expect(configState.perpConfigCommon.withdrawChannel).toBe('legacy');
    expect(warn).toHaveBeenCalled();
    respond({ withdrawChannel: 'cctp' });
    await service.updatePerpsConfigByServerSilently({ ignoreCache: true });
    expect(configState.perpConfigCommon.withdrawChannel).toBe('cctp');
  });

  it('does not clear the policy on an unreadable successful HTTP response', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    configState.perpConfigCommon.withdrawChannel = 'legacy';
    request.mockResolvedValueOnce({ data: {} });
    await service.updatePerpsConfigByServerSilently({ ignoreCache: true });
    expect(configState.perpConfigCommon.withdrawChannel).toBe('legacy');
  });

  it('shares a single in-flight request even when a caller bypasses the cache', async () => {
    let resolveRequest!: (value: unknown) => void;
    request.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const first = service.updatePerpsConfigByServerSilently({
      ignoreCache: true,
    });
    const second = service.updatePerpsConfigByServerSilently({
      ignoreCache: true,
    });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest({
      data: {
        data: {
          referrerConfig: {},
          commonConfig: { withdrawChannel: 'legacy' },
        },
      },
    });
    await Promise.all([first, second]);
    expect(configState.perpConfigCommon.withdrawChannel).toBe('legacy');
  });
});
