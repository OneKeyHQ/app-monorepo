const path = require('node:path');

const {
  isPathInside,
  prepareDevRendererPort,
} = require('./prepare-dev-renderer-port');

describe('prepare Desktop renderer port', () => {
  const desktopRoot = path.join('workspace', 'apps', 'desktop');

  test('does nothing when renderer port is available', async () => {
    const getListenerPidsImpl = jest.fn().mockReturnValue([]);
    const killProcessImpl = jest.fn();

    await expect(
      prepareDevRendererPort({
        desktopRoot,
        getListenerPidsImpl,
        killProcessImpl,
        platform: 'darwin',
      }),
    ).resolves.toEqual([]);
    expect(killProcessImpl).not.toHaveBeenCalled();
  });

  test('terminates a previous renderer from the same Desktop project', async () => {
    const getListenerPidsImpl = jest
      .fn()
      .mockReturnValueOnce([4242])
      .mockReturnValueOnce([]);
    const getProcessCwdImpl = jest.fn().mockReturnValue(desktopRoot);
    const killProcessImpl = jest.fn();
    const logger = { log: jest.fn() };

    await expect(
      prepareDevRendererPort({
        desktopRoot,
        getListenerPidsImpl,
        getProcessCwdImpl,
        killProcessImpl,
        logger,
        platform: 'darwin',
      }),
    ).resolves.toEqual([4242]);
    expect(killProcessImpl).toHaveBeenCalledWith(4242, 'SIGTERM');
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('previous Desktop process: 4242'),
    );
  });

  test('refuses to terminate a listener owned by another project', async () => {
    const getListenerPidsImpl = jest.fn().mockReturnValue([4242]);
    const getProcessCwdImpl = jest
      .fn()
      .mockReturnValue(path.join('workspace', 'another-project'));
    const killProcessImpl = jest.fn();

    await expect(
      prepareDevRendererPort({
        desktopRoot,
        getListenerPidsImpl,
        getProcessCwdImpl,
        killProcessImpl,
        platform: 'darwin',
      }),
    ).rejects.toThrow(
      'Port 3001 is in use by a process outside this Desktop project',
    );
    expect(killProcessImpl).not.toHaveBeenCalled();
  });

  test('leaves existing behavior unchanged on unsupported platforms', async () => {
    const getListenerPidsImpl = jest.fn();
    const killProcessImpl = jest.fn();

    await expect(
      prepareDevRendererPort({
        desktopRoot,
        getListenerPidsImpl,
        killProcessImpl,
        platform: 'win32',
      }),
    ).resolves.toEqual([]);
    expect(getListenerPidsImpl).not.toHaveBeenCalled();
    expect(killProcessImpl).not.toHaveBeenCalled();
  });

  test('recognizes the Desktop root and its descendants only', () => {
    expect(isPathInside(desktopRoot, desktopRoot)).toBe(true);
    expect(isPathInside(path.join(desktopRoot, 'app'), desktopRoot)).toBe(true);
    expect(isPathInside(`${desktopRoot}-copy`, desktopRoot)).toBe(false);
    expect(
      isPathInside(path.join(desktopRoot, '..', 'another-app'), desktopRoot),
    ).toBe(false);
  });
});
