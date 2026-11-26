/*
yarn jest packages/kit-bg/src/services/ServiceLightningSpark/sdk/sparkStorage.native.test.ts

iOS and Android keep each Breez wallet in its own directory under the app's
documents directory.
*/
jest.mock('@onekeyhq/shared/src/modules3rdParty/react-native-fs', () => ({
  __esModule: true,
  default: {
    DocumentDirectoryPath: '/app/Documents',
    mkdir: jest.fn(async (_path: string) => undefined),
    readDir: jest.fn(),
    unlink: jest.fn(async (_path: string) => undefined),
  },
}));

/* eslint-disable import/first */
import {
  removeSparkStorage,
  resolveSparkStorageDir,
} from './sparkStorage.native';
/* eslint-enable import/first */

const mockFs = (
  jest.requireMock('@onekeyhq/shared/src/modules3rdParty/react-native-fs') as {
    default: {
      mkdir: jest.Mock;
      readDir: jest.Mock;
      unlink: jest.Mock;
    };
  }
).default;

function entry(name: string, isDirectory = true) {
  return {
    name,
    path: `/app/Documents/${name}`,
    isDirectory: () => isDirectory,
  };
}

describe('Spark storage on mobile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the storage directory in the documents directory', async () => {
    await expect(
      resolveSparkStorageDir('onekey-breez-mainnet-hd-1'),
    ).resolves.toBe('/app/Documents/onekey-breez-mainnet-hd-1');
    expect(mockFs.mkdir).toHaveBeenCalledWith(
      '/app/Documents/onekey-breez-mainnet-hd-1',
    );
  });

  it('deletes only the directories the match accepts', async () => {
    mockFs.readDir.mockResolvedValue([
      entry('onekey-breez-mainnet-hd-1'),
      entry('onekey-breez-mainnet-hd-10'),
      entry('onekey-breez-regtest-hd-2'),
      entry('onekey-breez-mainnet-hd-1.log', false),
      entry('other-app-data'),
    ]);

    await removeSparkStorage(
      (storageDir) => storageDir === 'onekey-breez-mainnet-hd-1',
    );

    expect(mockFs.readDir).toHaveBeenCalledWith('/app/Documents');
    expect(mockFs.unlink.mock.calls).toEqual([
      ['/app/Documents/onekey-breez-mainnet-hd-1'],
    ]);
  });

  it('deletes every Spark directory for App Reset', async () => {
    mockFs.readDir.mockResolvedValue([
      entry('onekey-breez-mainnet-hd-1'),
      entry('onekey-breez-regtest-hd-2'),
      entry('other-app-data'),
    ]);

    await removeSparkStorage((storageDir) =>
      storageDir.startsWith('onekey-breez-'),
    );

    expect(mockFs.unlink.mock.calls).toEqual([
      ['/app/Documents/onekey-breez-mainnet-hd-1'],
      ['/app/Documents/onekey-breez-regtest-hd-2'],
    ]);
  });
});
