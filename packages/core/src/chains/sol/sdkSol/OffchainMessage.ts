/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable no-bitwise */
/* eslint-disable spellcheck/spell-checker */

// Max off-chain message length supported by Ledger
const OFFCM_MAX_LEDGER_LEN = 1212;
// Max length of version 0 off-chain message
const OFFCM_MAX_V0_LEN = 65_515;

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

  isValid() {
    if (this.version !== 0) {
      return false;
    }
    if (!this.message) {
      return false;
    }
    const format = OffchainMessage.guessMessageFormat(this.message);
    return format != null && format === this.messageFormat;
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
      throw new Error(`Invalid OffchainMessage: ${JSON.stringify(this)}`);
    }
    const buffer = Buffer.alloc(4);
    if (!this.message) {
      throw new Error('message is null');
    }
    if (this.messageFormat === undefined) {
      throw new Error('messageFormat is null');
    }
    let offset = buffer.writeUInt8(this.version);
    offset = buffer.writeUInt8(this.messageFormat, offset);
    offset = buffer.writeUInt16LE(this.message.length, offset);
    return Buffer.concat([
      Buffer.from([255]),
      Buffer.from('solana offchain'),
      buffer,
      this.message,
    ]);
  }
}
