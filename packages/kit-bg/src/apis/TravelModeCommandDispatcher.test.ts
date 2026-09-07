import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mockRunCommand = jest.fn(async () => {
  throw new OneKeyLocalError('Unknown error');
});
const mockGetRuntimeState = jest.fn(async () => 'active');
const mockGetRuntimeEnvironment = jest.fn(async () => ({
  commands: {
    run: mockRunCommand,
  },
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironment: mockGetRuntimeEnvironment,
    getRuntimeState: mockGetRuntimeState,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TravelModeCommandDispatcher } =
  require('./TravelModeCommandDispatcher') as typeof import('./TravelModeCommandDispatcher');

describe('TravelModeCommandDispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects protected service commands from the authoritative dispatcher', async () => {
    const dispatcher = new TravelModeCommandDispatcher();
    const operation = jest.fn(async () => 'should-not-run');

    await expect(
      dispatcher.runServiceCall({
        methodName: 'sendTransaction',
        operation,
        serviceName: 'serviceSend',
      }),
    ).rejects.toThrow('Unknown error');

    expect(operation).not.toHaveBeenCalled();
    expect(mockGetRuntimeEnvironment).toHaveBeenCalledTimes(1);
    expect(mockRunCommand).toHaveBeenCalledTimes(1);
  });

  it('default-denies a serialized native transport service call', async () => {
    const dispatcher = new TravelModeCommandDispatcher();
    const operation = jest.fn(async () => 'should-not-run');

    await expect(
      dispatcher.runTransportServiceCall({
        method: 'serviceFutureFeature.runFutureCommand',
        operation,
      }),
    ).rejects.toThrow('Unknown error');

    expect(operation).not.toHaveBeenCalled();
    expect(mockGetRuntimeEnvironment).toHaveBeenCalledTimes(1);
    expect(mockRunCommand).toHaveBeenCalledTimes(1);
  });

  it('normalizes root methods from the native transport', async () => {
    const dispatcher = new TravelModeCommandDispatcher();
    const operation = jest.fn(async () => 'root-state');

    await expect(
      dispatcher.runTransportServiceCall({
        method: 'ROOT.getAtomStates',
        operation,
      }),
    ).resolves.toBe('root-state');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockGetRuntimeState).toHaveBeenCalledTimes(1);
    expect(mockGetRuntimeEnvironment).not.toHaveBeenCalled();
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('default-denies business reads instead of relying on method names', async () => {
    const dispatcher = new TravelModeCommandDispatcher();
    const operation = jest.fn(async () => 'network');

    await expect(
      dispatcher.runServiceCall({
        methodName: 'getNetwork',
        operation,
        serviceName: 'serviceNetwork',
      }),
    ).rejects.toThrow('Unknown error');

    expect(operation).not.toHaveBeenCalled();
    expect(mockGetRuntimeEnvironment).toHaveBeenCalledTimes(1);
    expect(mockRunCommand).toHaveBeenCalledTimes(1);
  });

  it('allows only the explicit Travel Mode control plane while blocked', async () => {
    const dispatcher = new TravelModeCommandDispatcher();
    const operation = jest.fn(async () => 'enabled');

    await expect(
      dispatcher.runServiceCall({
        methodName: 'enterPage',
        operation,
        serviceName: 'serviceTravelMode',
      }),
    ).resolves.toBe('enabled');

    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockGetRuntimeState).toHaveBeenCalledTimes(1);
    expect(mockGetRuntimeEnvironment).not.toHaveBeenCalled();
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it('exposes only restart retry while transition recovery is active', async () => {
    mockGetRuntimeState.mockResolvedValue('transition-recovery');
    const dispatcher = new TravelModeCommandDispatcher();
    const operation = jest.fn(async () => 'control-result');

    await expect(
      dispatcher.runServiceCall({
        methodName: 'requestPageAdmission',
        operation,
        serviceName: 'serviceTravelMode',
      }),
    ).rejects.toThrow('Unknown error');
    expect(operation).not.toHaveBeenCalled();

    await expect(
      dispatcher.runServiceCall({
        methodName: 'retryRestart',
        operation,
        serviceName: 'serviceTravelMode',
      }),
    ).resolves.toBe('control-result');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
