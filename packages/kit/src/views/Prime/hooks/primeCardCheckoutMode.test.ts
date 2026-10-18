import type { IPrimeCardCheckoutMode } from './primeCardCheckoutMode';

/*
yarn test packages/kit/src/views/Prime/hooks/primeCardCheckoutMode.test.ts
*/

const mockGetDevSetting = jest.fn<Promise<unknown>, []>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      getDevSetting: () => mockGetDevSetting(),
    },
  },
}));

// The mode is cached per runtime, so each case loads a fresh module.
function loadMode(): Promise<IPrimeCardCheckoutMode> | undefined {
  let mod: typeof import('./primeCardCheckoutMode') | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual('./primeCardCheckoutMode');
  });
  return mod?.getPrimeCardCheckoutMode();
}

describe('getPrimeCardCheckoutMode', () => {
  beforeEach(() => {
    mockGetDevSetting.mockReset();
  });

  it('defaults to the embedded checkout', async () => {
    mockGetDevSetting.mockResolvedValue({ enabled: false, settings: {} });
    await expect(loadMode()).resolves.toBe('embedded');
  });

  it('ignores the hosted override while dev settings are off', async () => {
    mockGetDevSetting.mockResolvedValue({
      enabled: false,
      settings: { usePrimeHostedCardCheckout: true },
    });
    await expect(loadMode()).resolves.toBe('embedded');
  });

  it('uses the hosted Purchase Link when the dev override is on', async () => {
    mockGetDevSetting.mockResolvedValue({
      enabled: true,
      settings: { usePrimeHostedCardCheckout: true },
    });
    await expect(loadMode()).resolves.toBe('hostedLink');
  });

  it('stays embedded when reading dev settings fails', async () => {
    mockGetDevSetting.mockRejectedValue(new Error('bg unavailable'));
    await expect(loadMode()).resolves.toBe('embedded');
  });
});
