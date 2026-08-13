// Layout mirrors Suite's `suite/metadata/src/metadataUtils.ts`.
// Only the fileSystem provider keeps key and ciphertext local; cloud providers
// and Suite Sync do not.

const CIPHER_IV_SIZE = 96 / 8;
const AUTH_TAG_SIZE = 128 / 8;

export interface ITrezorSuiteLabelFileContent {
  version?: string;
  accountLabel?: string;
  outputLabels?: Record<string, Record<string, string>>;
  addressLabels?: Record<string, string>;
}

export function decryptTrezorSuiteLabelFile({
  fileContent,
  aesKeyHex,
  createDecipheriv,
}: {
  fileContent: string;
  aesKeyHex: string;
  createDecipheriv: (
    algorithm: string,
    key: Buffer,
    iv: Buffer,
  ) => {
    update: (data: Buffer) => Buffer;
    final: () => Buffer;
    setAuthTag: (tag: Buffer) => void;
  };
}): ITrezorSuiteLabelFileContent | undefined {
  try {
    const trimmed = fileContent.trim();
    if (!trimmed || !/^[0-9a-fA-F]+$/.test(trimmed) || trimmed.length % 2 !== 0) {
      return undefined;
    }
    const payload = Buffer.from(trimmed, 'hex');
    if (payload.length <= CIPHER_IV_SIZE + AUTH_TAG_SIZE) {
      return undefined;
    }
    const key = Buffer.from(aesKeyHex, 'hex');
    if (key.length !== 32) {
      return undefined;
    }
    const iv = payload.subarray(0, CIPHER_IV_SIZE);
    const authTag = payload.subarray(
      CIPHER_IV_SIZE,
      CIPHER_IV_SIZE + AUTH_TAG_SIZE,
    );
    const cipherText = payload.subarray(CIPHER_IV_SIZE + AUTH_TAG_SIZE);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    const start = decipher.update(cipherText);
    decipher.setAuthTag(authTag);
    const end = decipher.final();
    const parsed: unknown = JSON.parse(
      Buffer.concat([start, end]).toString('utf8'),
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as ITrezorSuiteLabelFileContent;
  } catch {
    return undefined;
  }
}

export function pickTrezorSuiteAccountLabel(
  content: ITrezorSuiteLabelFileContent | undefined,
): string | undefined {
  const label = content?.accountLabel;
  if (typeof label !== 'string') {
    return undefined;
  }
  const trimmed = label.trim();
  return trimmed && trimmed.length <= 80 ? trimmed : undefined;
}
