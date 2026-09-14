import { RuntimeEnvironment } from '@onekeyhq/shared/src/travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '@onekeyhq/shared/src/travelMode/runtimeProfile';
import { EWalletConnectSessionEvents } from '@onekeyhq/shared/src/walletConnect/types';

import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';

let mockTransitionBlocked = false;
const mockGetEnvironment = jest.fn(async () =>
  RuntimeEnvironment.create(
    getTravelModeRuntimeProfile(false),
    () => mockTransitionBlocked,
  ),
);

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { getRuntimeEnvironment: mockGetEnvironment },
}));
jest.mock('../../services/ServiceWalletConnect/walletConnectClient', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./WalletConnectRequestProxyAlgo', () => ({
  WalletConnectRequestProxyAlgo: jest.fn(),
}));
jest.mock('./WalletConnectRequestProxyCosmos', () => ({
  WalletConnectRequestProxyCosmos: jest.fn(),
}));
jest.mock('./WalletConnectRequestProxyEth', () => ({
  WalletConnectRequestProxyEth: jest.fn(),
}));

describe('WalletConnect Travel Mode event gating', () => {
  it('blocks existing session listeners after activation and unregisters the same callbacks', async () => {
    const { default: ProviderApiWalletConnect } =
      await import('./ProviderApiWalletConnect');
    const getWcChainInfo = jest.fn(async () => undefined);
    const handleSessionDelete = jest.fn(async () => undefined);
    const provider = new ProviderApiWalletConnect({
      backgroundApi: {
        serviceWalletConnect: { getWcChainInfo, handleSessionDelete },
        serviceApp: { showToast: jest.fn(async () => undefined) },
      },
    });
    const on = jest.fn();
    const off = jest.fn();
    const pingOn = jest.fn();
    const pingOff = jest.fn();
    const respondSessionRequest = jest.fn(async () => undefined);
    provider.web3Wallet = {
      on,
      off,
      engine: { signClient: { events: { on: pingOn, off: pingOff } } },
      respondSessionRequest,
    } as unknown as IWalletKit;
    provider.registerEvents();
    const requestListener = on.mock.calls.find(
      ([event]) => event === EWalletConnectSessionEvents.session_request,
    )?.[1] as (request: WalletKitTypes.SessionRequest) => Promise<void>;
    const request = {
      topic: 'session-topic',
      id: 1,
      params: {
        chainId: 'eip155:1',
        request: { method: 'eth_sendTransaction', params: [] },
      },
    } as unknown as WalletKitTypes.SessionRequest;

    await requestListener(request);
    expect(getWcChainInfo).toHaveBeenCalledTimes(1);
    expect(respondSessionRequest).toHaveBeenCalledTimes(1);
    getWcChainInfo.mockClear();
    respondSessionRequest.mockClear();
    mockTransitionBlocked = true;

    for (const [, listener] of on.mock.calls as Array<
      [string, (args: unknown) => Promise<void>]
    >) {
      await listener(request);
    }
    expect(getWcChainInfo).not.toHaveBeenCalled();
    expect(handleSessionDelete).not.toHaveBeenCalled();
    expect(respondSessionRequest).not.toHaveBeenCalled();
    provider.unregisterEvents();
    expect(off.mock.calls).toEqual(on.mock.calls);
    expect(pingOff.mock.calls).toEqual(pingOn.mock.calls);
  });
});
