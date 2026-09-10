import type { IBackupDataExportArchive } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

export async function createBackupExportArchive(
  data: IPrimeTransferData,
): Promise<IBackupDataExportArchive> {
  // Hermes has no Streams API. Load it before evaluating zip.js, on demand.
  if (typeof globalThis.TransformStream === 'undefined') {
    await import('web-streams-polyfill/polyfill');
  }
  const { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } =
    await import('@zip.js/zip.js/index-native.js');
  const password = stringUtils.randomString(32, {
    chars: stringUtils.randomStringCharsSet.base58,
  });
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    password,
    encryptionStrength: 3,
    zipCrypto: false,
    useWebWorkers: false,
    useCompressionStream: false,
    dataDescriptor: false,
    level: 6,
  });
  const json = Buffer.from(stringUtils.stableStringify(data), 'utf8');
  try {
    await writer.add('backup.json', new Uint8ArrayReader(json));
    const archive = await writer.close();
    return { archiveBase64: Buffer.from(archive).toString('base64'), password };
  } finally {
    json.fill(0);
  }
}
