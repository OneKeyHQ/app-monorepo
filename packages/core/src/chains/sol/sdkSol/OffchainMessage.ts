/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable no-bitwise */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { EOffChainMessageType } from '../types';

import type {
  ICreateOffChainMessageOptions,
  ICreateOffChainMessageV1Options,
  IOffChainMessageHeaderLegacy,
  IOffChainMessageHeaderStandard,
  IOffChainMessageHeaderV1,
} from '../types';

// Max off-chain message length supported by Ledger
const OFFCM_MAX_LEDGER_LEN = 1212;
// Max length of version 0 off-chain message
const OFFCM_MAX_V0_LEN = 65_515;
// Version 1 has no length prefix and no ceiling in the spec; this bounds the body anyway.
const OFFCM_MAX_V1_LEN = 1024 * 1024;

function isValidUTF8(data: Uint8Array): boolean {
  const length = data.length;
  let i = 0;

  while (i < length) {
    if (data[i] < 0x80) {
      /* 0xxxxxxx */
      // eslint-disable-next-line no-plusplus
      ++i;
    } else if ((data[i] & 0xe0) === 0xc0) {
      /* 110XXXXx 10xxxxxx */
      if (
        i + 1 >= length ||
        (data[i + 1] & 0xc0) !== 0x80 ||
        (data[i] & 0xfe) === 0xc0
      ) {
        /* overlong? */ return false;
      }
      i += 2;
    } else if ((data[i] & 0xf0) === 0xe0) {
      /* 1110XXXX 10Xxxxxx 10xxxxxx */
      if (
        i + 2 >= length ||
        (data[i + 1] & 0xc0) !== 0x80 ||
        (data[i + 2] & 0xc0) !== 0x80 ||
        (data[i] === 0xe0 && (data[i + 1] & 0xe0) === 0x80) /* overlong? */ ||
        (data[i] === 0xed && (data[i + 1] & 0xe0) === 0xa0) /* surrogate? */ ||
        (data[i] === 0xef &&
          data[i + 1] === 0xbf &&
          (data[i + 2] & 0xfe) === 0xbe)
      ) {
        /* U+FFFE or U+FFFF? */ return false;
      }
      i += 3;
    } else if ((data[i] & 0xf8) === 0xf0) {
      /* 11110XXX 10XXxxxx 10xxxxxx 10xxxxxx */
      if (
        i + 3 >= length ||
        (data[i + 1] & 0xc0) !== 0x80 ||
        (data[i + 2] & 0xc0) !== 0x80 ||
        (data[i + 3] & 0xc0) !== 0x80 ||
        (data[i] === 0xf0 && (data[i + 1] & 0xf0) === 0x80) /* overlong? */ ||
        (data[i] === 0xf4 && data[i + 1] > 0x8f) ||
        data[i] > 0xf4
      ) {
        /* > U+10FFFF? */ return false;
      }
      i += 4;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * The only place that knows which offchain message versions exist. Callers map the
 * result to whatever error they owe their own caller — a dapp gets invalidParams, a
 * hardware account gets the firmware message — but none of them repeat this list.
 * Adding a version here makes every `switch` over the result fail to compile until
 * it says what to do with it.
 */
export type IOffchainMessageVersionKind = 'v0' | 'v1' | 'unsupported';

export function classifyOffchainMessageVersion(
  version: number | undefined,
): IOffchainMessageVersionKind {
  // Absent means version 0: it predates the field.
  if (version === undefined || version === 0) return 'v0';
  if (version === 1) return 'v1';
  return 'unsupported';
}

export class OffchainMessage {
  version: number;

  messageFormat: number | undefined;

  message: Buffer | undefined;

  /**
   * Constructs a new OffchainMessage
   * @param {version: number, messageFormat: number, message: string | Buffer} opts - Constructor parameters
   */
  constructor(opts: {
    version?: number;
    messageFormat?: number;
    message: Buffer;
  }) {
    this.version = 0;
    this.messageFormat = undefined;
    this.message = undefined;

    if (!opts) {
      return;
    }
    if (opts.version) {
      this.version = opts.version;
    }
    if (opts.messageFormat) {
      this.messageFormat = opts.messageFormat;
    }
    if (opts.message) {
      this.message = Buffer.from(opts.message);
      if (this.version === 0) {
        if (!this.messageFormat) {
          this.messageFormat = OffchainMessage.guessMessageFormat(this.message);
        }
      }
    }
  }

  static guessMessageFormat(message: Buffer) {
    if (Object.prototype.toString.call(message) !== '[object Uint8Array]') {
      return undefined;
    }
    if (message.length <= OFFCM_MAX_LEDGER_LEN) {
      if (OffchainMessage.isPrintableASCII(message)) {
        return 0;
      }
      if (OffchainMessage.isUTF8(message)) {
        return 1;
      }
    } else if (message.length <= OFFCM_MAX_V0_LEN) {
      if (OffchainMessage.isUTF8(message)) {
        return 2;
      }
    }
    return undefined;
  }

  static isPrintableASCII(buffer: Buffer) {
    return (
      buffer && buffer.every((element) => element >= 0x20 && element <= 0x7e)
    );
  }

  static isUTF8(buffer: Buffer) {
    return buffer && isValidUTF8(buffer);
  }

  private static createMessageBytes(
    message: string,
    format: number,
  ): Uint8Array {
    if (format === 0) {
      if (!/^[\x20-\x7E]*$/.test(message)) {
        throw new OneKeyLocalError(
          'Format 0 only supports printable ASCII characters (0x20-0x7E)',
        );
      }
    }
    return new TextEncoder().encode(message);
  }

  private static validateMessageLength(
    totalLength: number,
    format: number,
    isLegacy: boolean,
  ) {
    let maxLength;
    if (isLegacy) {
      maxLength = OFFCM_MAX_LEDGER_LEN;
    } else if (format === 2) {
      maxLength = 65_535;
    } else {
      maxLength = 1232;
    }

    if (totalLength > maxLength) {
      throw new OneKeyLocalError(
        `Total message length (${totalLength}) exceeds maximum (${maxLength}) for format ${format}`,
      );
    }
  }

  private static createBasicHeader(): {
    signingDomain: Uint8Array;
    version: Uint8Array;
  } {
    const SIGNING_DOMAIN = new Uint8Array([
      0xff, 0x73, 0x6f, 0x6c, 0x61, 0x6e, 0x61, 0x20, 0x6f, 0x66, 0x66, 0x63,
      0x68, 0x61, 0x69, 0x6e,
    ]); // "\xffsolana offchain"

    return {
      signingDomain: SIGNING_DOMAIN,
      version: new Uint8Array([0]), // version 0
    };
  }

  private static processApplicationDomain(
    applicationDomain: Uint8Array | string | undefined,
  ): Uint8Array {
    if (!applicationDomain) {
      return new Uint8Array(32).fill(0);
    }

    if (typeof applicationDomain === 'string') {
      const appDomainBytes = new Uint8Array(32).fill(0);
      const tempBytes = new TextEncoder().encode(applicationDomain);
      appDomainBytes.set(tempBytes.slice(0, Math.min(tempBytes.length, 32)));
      return appDomainBytes;
    }

    if (applicationDomain.length !== 32) {
      throw new OneKeyLocalError('Application domain must be 32 bytes');
    }
    return applicationDomain;
  }

  private static validateSignerPublicKeys(signerPublicKeys: Uint8Array[]) {
    if (signerPublicKeys.length === 0) {
      throw new OneKeyLocalError('At least one signer public key is required');
    }

    for (const pubkey of signerPublicKeys) {
      if (pubkey.length !== 32) {
        throw new OneKeyLocalError('Each signer public key must be 32 bytes');
      }
    }
  }

  static createOffChainMessage({
    message,
    applicationDomain,
    signerPublicKeys = [],
    format = 0,
    isLegacy = false,
  }: ICreateOffChainMessageOptions) {
    if (message.length === 0) {
      throw new OneKeyLocalError('Message cannot be empty');
    }

    const messageBytes = this.createMessageBytes(message, format);
    const { signingDomain, version } = this.createBasicHeader();

    if (isLegacy) {
      // Legacy format
      const formatBytes = new Uint8Array([format]);
      const lengthBytes = new Uint8Array(2);
      lengthBytes[0] = messageBytes.length & 0xff;
      lengthBytes[1] = (messageBytes.length >> 8) & 0xff;

      this.validateMessageLength(
        signingDomain.length +
          version.length +
          formatBytes.length +
          lengthBytes.length +
          messageBytes.length,
        format,
        true,
      );

      const result = new Uint8Array(
        signingDomain.length +
          version.length +
          formatBytes.length +
          lengthBytes.length +
          messageBytes.length,
      );

      let offset = 0;
      result.set(signingDomain, offset);
      offset += signingDomain.length;
      result.set(version, offset);
      offset += version.length;
      result.set(formatBytes, offset);
      offset += formatBytes.length;
      result.set(lengthBytes, offset);
      offset += lengthBytes.length;
      result.set(messageBytes, offset);

      return Buffer.from(result).toString('hex');
    }
    // Standard format
    this.validateSignerPublicKeys(signerPublicKeys);
    const appDomainBytes = this.processApplicationDomain(applicationDomain);

    const preambleLength =
      16 + 1 + 32 + 1 + 1 + signerPublicKeys.length * 32 + 2;
    this.validateMessageLength(
      preambleLength + messageBytes.length,
      format,
      false,
    );

    const preamble = new Uint8Array(preambleLength);
    let offset = 0;

    preamble.set(signingDomain, offset);
    offset += signingDomain.length;

    preamble[offset] = version[0];
    offset += 1;

    preamble.set(appDomainBytes, offset);
    offset += 32;

    preamble[offset] = format;
    offset += 1;

    preamble[offset] = signerPublicKeys.length;
    offset += 1;

    for (const pubkey of signerPublicKeys) {
      preamble.set(pubkey, offset);
      offset += 32;
    }

    preamble[offset] = messageBytes.length & 0xff;
    offset += 1;
    preamble[offset] = (messageBytes.length >> 8) & 0xff;
    offset += 1;

    const result = new Uint8Array(preambleLength + messageBytes.length);
    result.set(preamble, 0);
    result.set(messageBytes, preambleLength);

    return Buffer.from(result).toString('hex');
  }

  static createStandardSolanaOffChainMessage(
    options: Omit<ICreateOffChainMessageOptions, 'isLegacy'>,
  ) {
    return this.createOffChainMessage({ ...options, isLegacy: false });
  }

  static createLegacySolanaOffchainMessage(message: string) {
    return this.createOffChainMessage({ message, isLegacy: true });
  }

  /** Byte-wise lexicographic order, matching `@solana/offchain-messages`. */
  private static compareRequiredSigners(a: Uint8Array, b: Uint8Array): number {
    if (a.length !== b.length) {
      return a.length < b.length ? -1 : 1;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] === b[i]) {
        // eslint-disable-next-line no-continue
        continue;
      }
      return a[i] < b[i] ? -1 : 1;
    }
    return 0;
  }

  /**
   * Builds the bytes of a version 1 offchain message.
   *
   * Version 0 is a separate code path on purpose: v1 has no message format enum, no u16 length
   * prefix and no application domain, and it requires the signer list to be unique and sorted.
   */
  static createOffChainMessageV1Bytes({
    message,
    requiredSigners,
  }: ICreateOffChainMessageV1Options): Uint8Array {
    if (message.length === 0) {
      throw new OneKeyLocalError('Message cannot be empty');
    }
    if (!requiredSigners || requiredSigners.length === 0) {
      throw new OneKeyLocalError('At least one required signer is required');
    }
    if (requiredSigners.length > 255) {
      throw new OneKeyLocalError('At most 255 required signers are allowed');
    }
    if (Buffer.byteLength(message, 'utf8') > OFFCM_MAX_V1_LEN) {
      throw new OneKeyLocalError(
        `Message exceeds the maximum (${OFFCM_MAX_V1_LEN} bytes) for version 1`,
      );
    }
    for (const signer of requiredSigners) {
      if (signer.length !== 32) {
        throw new OneKeyLocalError('Each required signer must be 32 bytes');
      }
    }

    const signers = requiredSigners
      .map((signer) => Uint8Array.from(signer))
      // oxlint-disable-next-line unicorn/no-array-sort -- sorting a freshly mapped copy
      .sort((a, b) => this.compareRequiredSigners(a, b));
    for (let i = 1; i < signers.length; i += 1) {
      if (this.compareRequiredSigners(signers[i - 1], signers[i]) === 0) {
        throw new OneKeyLocalError('Required signers must be unique');
      }
    }

    const { signingDomain } = this.createBasicHeader();
    const contentBytes = new TextEncoder().encode(message);

    const result = new Uint8Array(
      signingDomain.length + 1 + 1 + signers.length * 32 + contentBytes.length,
    );

    let offset = 0;
    result.set(signingDomain, offset);
    offset += signingDomain.length;

    result[offset] = 1; // version 1
    offset += 1;

    result[offset] = signers.length;
    offset += 1;

    for (const signer of signers) {
      result.set(signer, offset);
      offset += 32;
    }

    result.set(contentBytes, offset);

    return result;
  }

  static createOffChainMessageV1(
    options: ICreateOffChainMessageV1Options,
  ): string {
    return Buffer.from(this.createOffChainMessageV1Bytes(options)).toString(
      'hex',
    );
  }

  static detectOffChainMessageType(message: Uint8Array): {
    type: EOffChainMessageType;
    header?:
      | IOffChainMessageHeaderLegacy
      | IOffChainMessageHeaderStandard
      | IOffChainMessageHeaderV1;
  } {
    const SIGNING_DOMAIN = new Uint8Array([
      0xff, 0x73, 0x6f, 0x6c, 0x61, 0x6e, 0x61, 0x20, 0x6f, 0x66, 0x66, 0x63,
      0x68, 0x61, 0x69, 0x6e,
    ]); // "\xffsolana offchain"

    if (message.length < SIGNING_DOMAIN.length) {
      return { type: EOffChainMessageType.INVALID };
    }

    try {
      let isStandardFormat = true;
      for (let i = 0; i < SIGNING_DOMAIN.length; i += 1) {
        if (message[i] !== SIGNING_DOMAIN[i]) {
          isStandardFormat = false;
          break;
        }
      }

      if (isStandardFormat) {
        let offset = SIGNING_DOMAIN.length;
        const version = message[offset];
        offset += 1;

        // Version 1 replaces the whole version 0 preamble:
        // signerCount(1) | signers(32 each) | content, no application domain, no format,
        // no length prefix.
        if (version === 1) {
          const signersOffset = offset + 1;
          // The signer count byte itself has to be there: reading past the end yields undefined,
          // which turns every length check below into a NaN comparison that never trips.
          if (message.length < signersOffset) {
            return { type: EOffChainMessageType.INVALID };
          }

          const signersCount = message[offset];
          const contentOffset = signersOffset + signersCount * 32;
          // Content is trailing and must not be empty.
          if (signersCount === 0 || message.length <= contentOffset) {
            return { type: EOffChainMessageType.INVALID };
          }
          return {
            type: EOffChainMessageType.V1,
            header: {
              version: 1,
              signersCount,
              requiredSigners: Array.from({ length: signersCount }, (_, i) =>
                message.slice(
                  signersOffset + i * 32,
                  signersOffset + (i + 1) * 32,
                ),
              ),
            },
          };
        }

        // Version 0 only. Without this gate a newer version byte is parsed with the version 0
        // layout and reported as STANDARD with fields read from the wrong offsets.
        if (version === 0 && message.length >= offset + 32) {
          const applicationDomain = message.slice(offset, offset + 32);
          offset += 32;

          if (message.length >= offset + 2) {
            const format = message[offset];
            offset += 1;

            const signersCount = message[offset];
            offset += 1;

            if (message.length >= offset + signersCount * 32 + 2) {
              const messageLength =
                message[offset + signersCount * 32] +
                (message[offset + signersCount * 32 + 1] << 8);

              const signerPublicKeys = Array.from(
                { length: signersCount },
                (_, i) => message.slice(offset + i * 32, offset + (i + 1) * 32),
              );

              return {
                type: EOffChainMessageType.STANDARD,
                header: {
                  version,
                  applicationDomain,
                  format,
                  signersCount,
                  signerPublicKeys,
                  messageLength,
                } as IOffChainMessageHeaderStandard,
              };
            }
          }
        }
      }

      for (let i = 0; i < SIGNING_DOMAIN.length; i += 1) {
        if (message[i] !== SIGNING_DOMAIN[i]) {
          return { type: EOffChainMessageType.INVALID };
        }
      }

      let offset = SIGNING_DOMAIN.length;
      const version = message[offset];
      offset += 1;

      const format = message[offset];
      offset += 1;

      const length = message[offset] + (message[offset + 1] << 8);
      offset += 2;

      if (version === 0 && [0, 1, 2].includes(format)) {
        const maxLength = format === 2 ? 65_535 : 1232;
        if (length <= maxLength) {
          return {
            type: EOffChainMessageType.LEGACY,
            header: { version, format, length },
          };
        }
      }
    } catch (_error) {
      // noop
    }

    return { type: EOffChainMessageType.INVALID };
  }

  isValid() {
    if (this.version !== 0) {
      return false;
    }
    if (!this.message) {
      return false;
    }
    const format = OffchainMessage.guessMessageFormat(this.message);
    return (
      format !== null && format !== undefined && format === this.messageFormat
    );
  }

  isLedgerSupported(allowBlindSigning: boolean) {
    return (
      this.isValid() &&
      (this.messageFormat === 0 ||
        (this.messageFormat === 1 && allowBlindSigning))
    );
  }

  serialize() {
    if (!this.isValid()) {
      throw new OneKeyLocalError(
        `Invalid OffchainMessage: ${JSON.stringify(this)}`,
      );
    }
    const buffer = Buffer.alloc(4);
    if (!this.message) {
      throw new OneKeyLocalError('message is null');
    }
    if (this.messageFormat === undefined) {
      throw new OneKeyLocalError('messageFormat is null');
    }
    let offset = buffer.writeUInt8(this.version);
    offset = buffer.writeUInt8(this.messageFormat, offset);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    offset = buffer.writeUInt16LE(this.message.length, offset);
    return Buffer.concat([
      Buffer.from([255]),
      Buffer.from('solana offchain'),
      buffer,
      this.message,
    ]);
  }
}
