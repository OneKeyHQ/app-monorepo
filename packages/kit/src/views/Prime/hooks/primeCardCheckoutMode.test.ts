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
function loadModule() {
  let mod: typeof import('./primeCardCheckoutMode') | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual('./primeCardCheckoutMode');
  });
  return mod;
}

function loadMode(): Promise<IPrimeCardCheckoutMode> | undefined {
  return loadModule()?.getPrimeCardCheckoutMode();
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

  it('uses the current Stripe.js by default', async () => {
    mockGetDevSetting.mockResolvedValue({ enabled: true, settings: {} });
    await expect(loadModule()?.shouldUseFaultyPrimeStripeJs()).resolves.toBe(
      false,
    );
  });

  it('selects faulty Stripe.js while keeping the normal embedded flow', async () => {
    mockGetDevSetting.mockResolvedValue({
      enabled: true,
      settings: { useFaultyPrimeStripeJs: true },
    });
    const mod = loadModule();
    await expect(mod?.getPrimeCardCheckoutMode()).resolves.toBe('embedded');
    await expect(mod?.shouldUseFaultyPrimeStripeJs()).resolves.toBe(true);
    expect(mockGetDevSetting).toHaveBeenCalledTimes(1);
  });

  it('ignores faulty Stripe.js when developer mode is off', async () => {
    mockGetDevSetting.mockResolvedValue({
      enabled: false,
      settings: { useFaultyPrimeStripeJs: true },
    });
    await expect(loadModule()?.shouldUseFaultyPrimeStripeJs()).resolves.toBe(
      false,
    );
  });

  it('keeps the forced hosted override ahead of faulty Stripe.js', async () => {
    mockGetDevSetting.mockResolvedValue({
      enabled: true,
      settings: {
        usePrimeHostedCardCheckout: true,
        useFaultyPrimeStripeJs: true,
      },
    });
    const mod = loadModule();
    await expect(mod?.getPrimeCardCheckoutMode()).resolves.toBe('hostedLink');
    await expect(mod?.shouldUseFaultyPrimeStripeJs()).resolves.toBe(false);
  });

  it('keeps the selected version until the runtime restarts', async () => {
    mockGetDevSetting.mockResolvedValue({ enabled: true, settings: {} });
    const mod = loadModule();
    await expect(mod?.shouldUseFaultyPrimeStripeJs()).resolves.toBe(false);
    mockGetDevSetting.mockResolvedValue({
      enabled: true,
      settings: { useFaultyPrimeStripeJs: true },
    });
    await expect(mod?.shouldUseFaultyPrimeStripeJs()).resolves.toBe(false);
    expect(mockGetDevSetting).toHaveBeenCalledTimes(1);
  });

  it('keeps the current Stripe.js when reading settings fails', async () => {
    mockGetDevSetting.mockRejectedValue(new Error('bg unavailable'));
    await expect(loadModule()?.shouldUseFaultyPrimeStripeJs()).resolves.toBe(
      false,
    );
  });
});
