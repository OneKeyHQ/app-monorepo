import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockRunWithBlockedResult = jest.fn(
  async <T>({ operation }: { operation: () => Promise<T> }) => operation(),
);
const mockGetRuntimeEnvironment = jest.fn(async () => ({
  dappRequests: {
    runWithBlockedResult: mockRunWithBlockedResult,
  },
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironment: mockGetRuntimeEnvironment,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TravelModeDappRequestIngress } =
  require('./TravelModeDappRequestIngress') as typeof import('./TravelModeDappRequestIngress');

describe('TravelModeDappRequestIngress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes requests through the immutable runtime environment', async () => {
    const ingress = new TravelModeDappRequestIngress();
    const operation = jest.fn(async () => 'result');

    await expect(
      ingress.run({
        onBlocked: () => {
          throw new OneKeyLocalError('Unknown error');
        },
        operation,
      }),
    ).resolves.toBe('result');

    expect(mockGetRuntimeEnvironment).toHaveBeenCalledTimes(1);
    expect(mockRunWithBlockedResult).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('installs an immutable rejection handler without starting an operation', async () => {
    const ingress = new TravelModeDappRequestIngress();
    const operation = jest.fn(async () => 'result');
    ingress.installRequestBlackout();

    await expect(
      ingress.run({
        onBlocked: () => {
          throw new OneKeyLocalError('Unknown error');
        },
        operation,
      }),
    ).rejects.toThrow('Unknown error');

    expect(mockGetRuntimeEnvironment).not.toHaveBeenCalled();
    expect(mockRunWithBlockedResult).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
  });

  it('wraps a protocol handler at its registration boundary', async () => {
    const ingress = new TravelModeDappRequestIngress();
    const operation = jest.fn(async (value: string) => `handled:${value}`);
    const onBlocked = jest.fn(async (value: string) => `blocked:${value}`);
    const handler = ingress.wrap({ onBlocked, operation });

    await expect(handler('request')).resolves.toBe('handled:request');
    expect(operation).toHaveBeenCalledWith('request');

    ingress.installRequestBlackout();
    await expect(handler('request')).resolves.toBe('blocked:request');
    expect(onBlocked).toHaveBeenCalledWith('request');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
