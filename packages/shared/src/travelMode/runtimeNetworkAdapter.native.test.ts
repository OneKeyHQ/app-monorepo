import axios from 'axios';

import { OneKeyLocalError } from '../errors';

import type { IApiAvailabilityTiming } from '../request/availabilityMetrics';
import type { AxiosAdapter, AxiosResponse } from 'axios';

const mockRunOrReject = jest.fn();

jest.mock('./runtimeWalletEffect', () => ({
  runRuntimeWalletEffect: mockRunOrReject,
}));

const { createRuntimeNetworkAdapter } =
  require('./runtimeNetworkAdapter.native') as typeof import('./runtimeNetworkAdapter.native');

const { RuntimeEnvironment } = jest.requireActual<
  typeof import('./runtimeEnvironment')
>('./runtimeEnvironment');
const { getTravelModeRuntimeProfile } =
  jest.requireActual<typeof import('./runtimeProfile')>('./runtimeProfile');

function createTiming(): IApiAvailabilityTiming {
  return {
    startedAt: 0,
    target: { routeGroup: '/wallet/v1', service: 'wallet' },
  };
}

describe('createRuntimeNetworkAdapter.native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the complete request through the runtime effect capability', async () => {
    const response = { data: 'ok', status: 200 } as AxiosResponse;
    const delegate = jest.fn<
      ReturnType<AxiosAdapter>,
      Parameters<AxiosAdapter>
    >(async () => response);
    mockRunOrReject.mockImplementation(
      async (operation: () => Promise<AxiosResponse>) => operation(),
    );

    const adapter = createRuntimeNetworkAdapter(delegate);
    const config = { url: '/test' } as Parameters<AxiosAdapter>[0];

    await expect(adapter(config)).resolves.toBe(response);
    expect(mockRunOrReject).toHaveBeenCalledTimes(1);
    expect(delegate).toHaveBeenCalledWith(config);
  });

  it('allows allowlisted top-level requests in Travel Mode', async () => {
    const response = { data: 'ok', status: 200 } as AxiosResponse;
    const delegate = jest.fn<
      ReturnType<AxiosAdapter>,
      Parameters<AxiosAdapter>
    >(async () => response);
    mockRunOrReject.mockImplementation(
      async (
        operation: () => Promise<AxiosResponse>,
        options?: { allowInTravelMode?: boolean },
      ) => {
        if (options?.allowInTravelMode) {
          return operation();
        }
        throw new OneKeyLocalError('Unknown error');
      },
    );

    const adapter = createRuntimeNetworkAdapter(delegate);
    const config = {
      baseURL: 'https://utility.onekeycn.com',
      method: 'get',
      url: '/utility/v2/market/basic-config',
    } as Parameters<AxiosAdapter>[0];

    await expect(adapter(config)).resolves.toBe(response);
    expect(mockRunOrReject).toHaveBeenCalledWith(expect.any(Function), {
      allowInTravelMode: true,
    });
    expect(delegate).toHaveBeenCalledWith(config);
  });

  it('does not invoke the transport when runtime effects are suppressed', async () => {
    const delegate = jest.fn<
      ReturnType<AxiosAdapter>,
      Parameters<AxiosAdapter>
    >();
    mockRunOrReject.mockRejectedValue(new Error('Unknown error'));

    const adapter = createRuntimeNetworkAdapter(delegate);

    await expect(adapter({} as Parameters<AxiosAdapter>[0])).rejects.toThrow(
      'Unknown error',
    );
    expect(delegate).not.toHaveBeenCalled();
  });

  describe('availability exclusion', () => {
    it('marks a request blocked by the Travel Mode gate as reported and never calls the transport', async () => {
      const delegate = jest.fn<
        ReturnType<AxiosAdapter>,
        Parameters<AxiosAdapter>
      >();
      const gateError = new OneKeyLocalError('Unknown error');
      mockRunOrReject.mockRejectedValue(gateError);
      const timing = createTiming();

      const adapter = createRuntimeNetworkAdapter(delegate);
      const request = adapter({
        url: '/wallet/v1/account',
        $oneKeyAvailabilityTiming: timing,
      } as Parameters<AxiosAdapter>[0]);

      await expect(request).rejects.toBe(gateError);
      expect(timing.reported).toBe(true);
      expect(delegate).not.toHaveBeenCalled();
    });

    it('leaves the timing of an allowed request untouched and calls the transport', async () => {
      const response = { data: 'ok', status: 200 } as AxiosResponse;
      const delegate = jest.fn<
        ReturnType<AxiosAdapter>,
        Parameters<AxiosAdapter>
      >(async () => response);
      mockRunOrReject.mockImplementation(
        async (operation: () => Promise<AxiosResponse>) => operation(),
      );
      const timing = createTiming();
      const config = {
        url: '/wallet/v1/account',
        $oneKeyAvailabilityTiming: timing,
      } as Parameters<AxiosAdapter>[0];

      const adapter = createRuntimeNetworkAdapter(delegate);

      await expect(adapter(config)).resolves.toBe(response);
      expect(timing.reported).toBeUndefined();
      expect(delegate).toHaveBeenCalledWith(config);
    });

    it('keeps transport failures after the gate as API outcomes', async () => {
      const transportError = new Error('Network Error');
      const delegate = jest.fn<
        ReturnType<AxiosAdapter>,
        Parameters<AxiosAdapter>
      >(async () => {
        throw transportError;
      });
      mockRunOrReject.mockImplementation(
        async (operation: () => Promise<AxiosResponse>) => operation(),
      );
      const timing = createTiming();

      const adapter = createRuntimeNetworkAdapter(delegate);
      const request = adapter({
        url: '/wallet/v1/account',
        $oneKeyAvailabilityTiming: timing,
      } as Parameters<AxiosAdapter>[0]);

      await expect(request).rejects.toBe(transportError);
      expect(timing.reported).toBeUndefined();
      expect(delegate).toHaveBeenCalledTimes(1);
    });

    it('returns the gate promise itself so settle timing is unchanged', async () => {
      const response = { data: 'ok', status: 200 } as AxiosResponse;
      const gatePromise = Promise.resolve(response);
      mockRunOrReject.mockReturnValue(gatePromise);

      const adapter = createRuntimeNetworkAdapter(jest.fn());
      const request = adapter({
        url: '/wallet/v1/account',
      } as Parameters<AxiosAdapter>[0]);

      expect(request).toBe(gatePromise);
      await expect(request).resolves.toBe(response);
    });

    it('rethrows a synchronous gate failure unchanged and marks it reported', () => {
      const delegate = jest.fn<
        ReturnType<AxiosAdapter>,
        Parameters<AxiosAdapter>
      >();
      const gateError = new OneKeyLocalError('Unknown error');
      mockRunOrReject.mockImplementation(() => {
        throw gateError;
      });
      const timing = createTiming();

      const adapter = createRuntimeNetworkAdapter(delegate);
      let thrown: unknown;
      try {
        void adapter({
          url: '/wallet/v1/account',
          $oneKeyAvailabilityTiming: timing,
        } as Parameters<AxiosAdapter>[0]);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(gateError);
      expect(timing.reported).toBe(true);
      expect(delegate).not.toHaveBeenCalled();
    });

    it('closes the timing before axios observes a request aborted during the real gate delay', async () => {
      const environment = RuntimeEnvironment.create(
        getTravelModeRuntimeProfile(true),
      );
      let markGateEntered = () => {};
      const gateEntered = new Promise<void>((resolve) => {
        markGateEntered = resolve;
      });
      mockRunOrReject.mockImplementation(
        (
          operation: () => Promise<AxiosResponse>,
          options?: { allowInTravelMode?: boolean },
        ) => {
          markGateEntered();
          return environment.walletEffects.runOrReject(operation, options);
        },
      );
      const delegate = jest.fn<
        ReturnType<AxiosAdapter>,
        Parameters<AxiosAdapter>
      >();
      const timing = createTiming();
      let reportedWhenAxiosObserved: boolean | undefined;
      const client = axios.create({
        adapter: createRuntimeNetworkAdapter(delegate),
      });
      client.interceptors.request.use((config) => {
        config.$oneKeyAvailabilityTiming = timing;
        return config;
      });
      client.interceptors.response.use(undefined, (error: unknown) => {
        reportedWhenAxiosObserved = axios.isAxiosError(error)
          ? error.config?.$oneKeyAvailabilityTiming?.reported
          : undefined;
        throw error;
      });
      const abortController = new AbortController();

      const request = client.get('https://wallet.onekeycn.com/wallet/v1/x', {
        signal: abortController.signal,
      });
      // Abort only once the adapter is inside the gate delay; an earlier
      // abort is rejected by axios before any adapter runs.
      await gateEntered;
      abortController.abort();

      await expect(request).rejects.toThrow(axios.CanceledError);
      expect(reportedWhenAxiosObserved).toBe(true);
      expect(delegate).not.toHaveBeenCalled();
    });
  });
});
