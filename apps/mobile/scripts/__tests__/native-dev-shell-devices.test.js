/* eslint-disable onekey/no-raw-error */

const { PassThrough } = require('stream');

const {
  promptIosSimulator,
  resolveTargetDevice,
} = require('../native-dev-shell');

function createSimulator(id, state = 'Shutdown') {
  return { isAvailable: true, name: `iPhone ${id}`, state, udid: id };
}

function createResolution(devices, overrides = {}) {
  const options = {
    chooseDevice: jest.fn(async (candidates) => candidates[1]),
    interactive: true,
    platform: 'ios',
    runCheckedCommand: jest.fn(),
    runForOutputCommand: jest.fn(() =>
      JSON.stringify({
        devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-26-5': devices },
      }),
    ),
    ...overrides,
  };
  return options;
}

describe('iOS simulator selection', () => {
  it('automatically boots a sole shutdown simulator before opening Simulator', async () => {
    const options = createResolution([createSimulator('A')]);

    await expect(resolveTargetDevice(options)).resolves.toMatchObject({
      id: 'A',
    });

    expect(options.chooseDevice).not.toHaveBeenCalled();
    expect(options.runCheckedCommand.mock.calls).toEqual([
      ['xcrun', ['simctl', 'bootstatus', 'A', '-b']],
      ['open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', 'A']],
    ]);
  });

  it('prefers the sole booted simulator without prompting', async () => {
    const options = createResolution([
      createSimulator('A', 'Booted'),
      createSimulator('B'),
    ]);

    await expect(resolveTargetDevice(options)).resolves.toMatchObject({
      id: 'A',
    });
    expect(options.chooseDevice).not.toHaveBeenCalled();
  });

  it.each(['Shutdown', 'Booted'])(
    'prompts for multiple %s simulators and boots only the selected device',
    async (state) => {
      const options = createResolution([
        createSimulator('A', state),
        createSimulator('B', state),
      ]);

      await expect(resolveTargetDevice(options)).resolves.toMatchObject({
        id: 'B',
      });
      expect(options.chooseDevice).toHaveBeenCalledWith([
        { id: 'A', name: 'iPhone A', runtime: 'iOS 26.5', state },
        { id: 'B', name: 'iPhone B', runtime: 'iOS 26.5', state },
      ]);
      expect(options.runCheckedCommand).toHaveBeenNthCalledWith(1, 'xcrun', [
        'simctl',
        'bootstatus',
        'B',
        '-b',
      ]);
    },
  );

  it('honors an explicit shutdown device even if another simulator is booted', async () => {
    const options = createResolution(
      [createSimulator('A', 'Booted'), createSimulator('B')],
      { requestedDevice: 'B', interactive: false },
    );

    await expect(resolveTargetDevice(options)).resolves.toMatchObject({
      id: 'B',
    });
    expect(options.chooseDevice).not.toHaveBeenCalled();
  });

  it('lists shutdown devices and an explicit command in a non-interactive terminal', async () => {
    const options = createResolution(
      [createSimulator('A'), createSimulator('B')],
      { interactive: false },
    );

    await expect(resolveTargetDevice(options)).rejects.toThrow(
      'Run yarn app:ios --device <UDID>. Available devices:\n- A (iPhone A, iOS 26.5, Shutdown)\n- B (iPhone B, iOS 26.5, Shutdown)',
    );
    expect(options.chooseDevice).not.toHaveBeenCalled();
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('explains how to create a simulator when none are installed', async () => {
    const options = createResolution([]);

    await expect(resolveTargetDevice(options)).rejects.toThrow(
      'No available iOS simulators. Create an iOS simulator in Xcode',
    );
    expect(options.chooseDevice).not.toHaveBeenCalled();
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('rejects an unavailable explicit device without booting another one', async () => {
    const options = createResolution([createSimulator('A')], {
      requestedDevice: 'missing',
    });

    await expect(resolveTargetDevice(options)).rejects.toThrow(
      'Device missing is not available',
    );
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('propagates simulator service failures instead of reporting an empty list', async () => {
    const options = createResolution([], {
      runForOutputCommand: () => {
        throw new Error('CoreSimulator unavailable');
      },
    });

    await expect(resolveTargetDevice(options)).rejects.toThrow(
      'CoreSimulator unavailable',
    );
    expect(options.chooseDevice).not.toHaveBeenCalled();
  });

  it('stops when selection is cancelled or booting fails', async () => {
    const cancelled = createResolution(
      [createSimulator('A'), createSimulator('B')],
      {
        chooseDevice: async () => {
          throw new Error('cancelled');
        },
      },
    );
    await expect(resolveTargetDevice(cancelled)).rejects.toThrow('cancelled');
    expect(cancelled.runCheckedCommand).not.toHaveBeenCalled();

    const bootFailure = createResolution([createSimulator('A')], {
      runCheckedCommand: jest.fn(() => {
        throw new Error('boot failed');
      }),
    });
    await expect(resolveTargetDevice(bootFailure)).rejects.toThrow(
      'boot failed',
    );
    expect(bootFailure.runCheckedCommand).toHaveBeenCalledTimes(1);
  });

  it('keeps Android selection free of simulator commands', async () => {
    const options = createResolution([], {
      platform: 'android',
      runForOutputCommand: () =>
        'List of devices attached\nemulator-5554 device\n',
    });

    await expect(resolveTargetDevice(options)).resolves.toEqual({
      id: 'emulator-5554',
      name: 'emulator-5554',
    });
    expect(options.chooseDevice).not.toHaveBeenCalled();
    expect(options.runCheckedCommand).not.toHaveBeenCalled();
  });

  it('shows device details, rejects invalid numbers and returns the chosen simulator', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const candidates = [
      { id: 'A', name: 'iPhone A', runtime: 'iOS 26.5', state: 'Shutdown' },
      { id: 'B', name: 'iPhone B', runtime: 'iOS 18.3', state: 'Booted' },
    ];
    const selection = promptIosSimulator(candidates, { input, output });
    input.write('0\n3\n1.5\nabc\n\n2\n');

    await expect(selection).resolves.toEqual(candidates[1]);
    const displayed = output.read().toString();
    expect(displayed).toContain('1. A (iPhone A, iOS 26.5, Shutdown)');
    expect(displayed).toContain('2. B (iPhone B, iOS 18.3, Booted)');
    expect(displayed.match(/Enter a number from 1 to 2/gu)).toHaveLength(5);
    input.destroy();
    output.destroy();
  });

  it('cancels cleanly when the terminal input closes', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const selection = promptIosSimulator([{ id: 'A', name: 'iPhone A' }], {
      input,
      output,
    });
    input.end();

    await expect(selection).rejects.toThrow(
      'iOS simulator selection cancelled',
    );
    input.destroy();
    output.destroy();
  });
});
