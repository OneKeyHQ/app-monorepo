import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import RNShare from '@onekeyhq/shared/src/modules3rdParty/expo-sharing';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { downloadAsFile } from './downloadAsFile.native';

jest.mock('@onekeyhq/shared/src/modules3rdParty/react-native-fs', () => ({
  __esModule: true,
  default: {
    CachesDirectoryPath: '/cache',
    exists: jest.fn(async () => false),
    writeFile: jest.fn(async () => {}),
    unlink: jest.fn(async () => {}),
  },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/expo-sharing', () => ({
  __esModule: true,
  default: { shareAsync: jest.fn(async () => {}) },
}));

if (!RNFS) throw new OneKeyLocalError('Expected the mocked native filesystem');
const filesystem = RNFS;

const archive = {
  content: 'UEsDBA==',
  filename: 'backup.zip',
  encoding: 'base64' as const,
  mimeType: 'application/zip',
  UTI: 'public.zip-archive',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(filesystem.exists).mockResolvedValue(false);
});

it.each([true, false])(
  'shares ZIP bytes with the correct URI on Android=%s, then cleans up',
  async (isAndroid) => {
    platformEnv.isNativeAndroid = isAndroid;
    jest
      .mocked(filesystem.exists)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await downloadAsFile(archive);
    expect(filesystem.writeFile).toHaveBeenCalledWith(
      '/cache/backup.zip',
      archive.content,
      'base64',
    );
    expect(RNShare.shareAsync).toHaveBeenCalledWith(
      isAndroid ? 'file:///cache/backup.zip' : '/cache/backup.zip',
      {
        dialogTitle: 'OneKey Cloud Backup',
        mimeType: 'application/zip',
        UTI: 'public.zip-archive',
      },
    );
    expect(filesystem.unlink).toHaveBeenCalledWith('/cache/backup.zip');
  },
);

it('removes the temporary ZIP if sharing fails', async () => {
  jest
    .mocked(filesystem.exists)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  jest
    .mocked(RNShare.shareAsync)
    .mockRejectedValueOnce(new Error('Share failed'));
  await expect(downloadAsFile(archive)).rejects.toThrow('Share failed');
  expect(filesystem.unlink).toHaveBeenCalledWith('/cache/backup.zip');
});

it('cleans up a partial write without opening the share sheet', async () => {
  jest
    .mocked(filesystem.exists)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  jest
    .mocked(filesystem.writeFile)
    .mockRejectedValueOnce(new Error('Write failed'));
  await expect(downloadAsFile(archive)).rejects.toThrow('Write failed');
  expect(RNShare.shareAsync).not.toHaveBeenCalled();
  expect(filesystem.unlink).toHaveBeenCalledWith('/cache/backup.zip');
});
