/* eslint-disable no-bitwise */
import { Buffer } from 'buffer';

import BN from 'bn.js';

import { decodeAddress } from './address';
import { getBufferFromBN } from './bn';

export enum ENexaOpcode {
  OP_FALSE = 0,
  OP_0 = 0,
  OP_PUSHDATA1 = 76,
  OP_PUSHDATA2 = 77,
  OP_PUSHDATA4 = 78,
  OP_1NEGATE = 79,
  OP_RESERVED = 80,
  OP_TRUE = 81,
  OP_1 = 81,
  OP_2 = 82,
  OP_3 = 83,
  OP_4 = 84,
  OP_5 = 85,
  OP_6 = 86,
  OP_7 = 87,
  OP_8 = 88,
  OP_9 = 89,
  OP_10 = 90,
  OP_11 = 91,
  OP_12 = 92,
  OP_13 = 93,
  OP_14 = 94,
  OP_15 = 95,
  OP_16 = 96,

  // control
  OP_NOP = 97,
  OP_VER = 98,
  OP_IF = 99,
  OP_NOTIF = 100,
  OP_VERIF = 101,
  OP_VERNOTIF = 102,
  OP_ELSE = 103,
  OP_ENDIF = 104,
  OP_VERIFY = 105,
  OP_RETURN = 106,

  // stack ops
  OP_TOALTSTACK = 107,
  OP_FROMALTSTACK = 108,
  OP_2DROP = 109,
  OP_2DUP = 110,
  OP_3DUP = 111,
  OP_2OVER = 112,
  OP_2ROT = 113,
  OP_2SWAP = 114,
  OP_IFDUP = 115,
  OP_DEPTH = 116,
  OP_DROP = 117,
  OP_DUP = 118,
  OP_NIP = 119,
  OP_OVER = 120,
  OP_PICK = 121,
  OP_ROLL = 122,
  OP_ROT = 123,
  OP_SWAP = 124,
  OP_TUCK = 125,

  // splice ops
  OP_CAT = 126,
  OP_SPLIT = 127,
  OP_NUM2BIN = 128,
  OP_BIN2NUM = 129,
  OP_SIZE = 130,

  // bit logic
  OP_INVERT = 131,
  OP_AND = 132,
  OP_OR = 133,
  OP_XOR = 134,
  OP_EQUAL = 135,
  OP_EQUALVERIFY = 136,
  OP_RESERVED1 = 137,
  OP_RESERVED2 = 138,

  // numeric
  OP_1ADD = 139,
  OP_1SUB = 140,
  OP_2MUL = 141,
  OP_2DIV = 142,
  OP_NEGATE = 143,
  OP_ABS = 144,
  OP_NOT = 145,
  OP_0NOTEQUAL = 146,

  OP_ADD = 147,
  OP_SUB = 148,
  OP_MUL = 149,
  OP_DIV = 150,
  OP_MOD = 151,
  OP_LSHIFT = 152,
  OP_RSHIFT = 153,

  OP_BOOLAND = 154,
  OP_BOOLOR = 155,
  OP_NUMEQUAL = 156,
  OP_NUMEQUALVERIFY = 157,
  OP_NUMNOTEQUAL = 158,
  OP_LESSTHAN = 159,
  OP_GREATERTHAN = 160,
  OP_LESSTHANOREQUAL = 161,
  OP_GREATERTHANOREQUAL = 162,
  OP_MIN = 163,
  OP_MAX = 164,

  OP_WITHIN = 165,

  // crypto
  OP_RIPEMD160 = 166,
  OP_SHA1 = 167,
  OP_SHA256 = 168,
  OP_HASH160 = 169,
  OP_HASH256 = 170,
  OP_CODESEPARATOR = 171,
  OP_CHECKSIG = 172,
  OP_CHECKSIGVERIFY = 173,
  OP_CHECKMULTISIG = 174,
  OP_CHECKMULTISIGVERIFY = 175,

  // timelocks
  OP_NOP2 = 177,
  OP_CHECKLOCKTIMEVERIFY = 177,
  OP_NOP3 = 178,
  OP_CHECKSEQUENCEVERIFY = 178,

  // expansion
  OP_NOP1 = 176,
  OP_NOP4 = 179,
  OP_NOP5 = 180,
  OP_NOP6 = 181,
  OP_NOP7 = 182,
  OP_NOP8 = 183,
  OP_NOP9 = 184,
  OP_NOP10 = 185,

  // More crypto
  OP_CHECKDATASIG = 186,
  OP_CHECKDATASIGVERIFY = 187,
  OP_REVERSEBYTES = 188,

  OP_PREFIX_BEGIN = 240,
  OP_PREFIX_END = 241,

  // template matching params
  OP_SMALLINTEGER = 250,
  OP_PUBKEYS = 251,
  OP_PUBKEYHASH = 253,
  OP_PUBKEY = 254,
  OP_INVALIDOPCODE = 255,

  // introspection
  OP_INPUTINDEX = 192,
  OP_ACTIVEBYTECODE = 193,
  OP_TXVERSION = 194,
  OP_TXINPUTCOUNT = 195,
  OP_TXOUTPUTCOUNT = 196,
  OP_TXLOCKTIME = 197,
  OP_UTXOVALUE = 198,
  OP_UTXOBYTECODE = 199,
  OP_OUTPOINTTXHASH = 200,
  OP_OUTPOINTINDEX = 201,
  OP_INPUTBYTECODE = 202,
  OP_INPUTSEQUENCENUMBER = 203,
  OP_OUTPUTVALUE = 204,
  OP_OUTPUTBYTECODE = 205,

  OP_RESERVED3 = 206,
  OP_RESERVED4 = 207,
}

export interface INexaScriptChunk {
  buf?: Buffer;
  opcodenum: ENexaOpcode;
  len?: number;
}

export function bufferToScripChunk(buffer: Buffer): INexaScriptChunk {
  let opcodenum;
  const len = buffer.length;
  if (len >= 0 && len < ENexaOpcode.OP_PUSHDATA1) {
    opcodenum = len;
  } else if (len < 2 ** 8) {
    opcodenum = ENexaOpcode.OP_PUSHDATA1;
  } else if (len < 2 ** 16) {
    opcodenum = ENexaOpcode.OP_PUSHDATA2;
  } else if (len < 2 ** 32) {
    opcodenum = ENexaOpcode.OP_PUSHDATA4;
  } else {
    throw new Error("You can't push that much data");
  }
  return {
    buf: buffer,
    len,
    opcodenum,
  };
}

export function writeUInt8(n: number) {
  const buf = Buffer.alloc(1);
  buf.writeUInt8(n, 0);
  return buf;
}

function writeUInt16LE(n: number) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(n, 0);
  return buf;
}

export function writeUInt32LE(n: number) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n, 0);
  return buf;
}

export function writeInt32LE(n: number) {
  const buf = Buffer.alloc(4);
  buf.writeInt32LE(n, 0);
  return buf;
}

export function writeUInt64LEBN(bigNumber: BN) {
  return getBufferFromBN(bigNumber, 'le', 8);
}

export function varintBufNum(n: number) {
  let buf: Buffer;
  if (n < 253) {
    buf = Buffer.alloc(1);
    buf.writeUInt8(n, 0);
  } else if (n < 0x1_00_00) {
    buf = Buffer.alloc(1 + 2);
    buf.writeUInt8(253, 0);
    buf.writeUInt16LE(n, 1);
  } else if (n < 0x1_00_00_00_00) {
    buf = Buffer.alloc(1 + 4);
    buf.writeUInt8(254, 0);
    buf.writeUInt32LE(n, 1);
  } else {
    buf = Buffer.alloc(1 + 8);
    buf.writeUInt8(255, 0);
    buf.writeInt32LE(n & -1, 1);
    buf.writeUInt32LE(Math.floor(n / 0x1_00_00_00_00), 5);
  }
  return buf;
}

export function scriptChunksToBuffer(chunks: INexaScriptChunk[]) {
  const buffersArray = [];
  let bufferLength = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const { opcodenum, buf } = chunk;
    const opcodenumBuffer = writeUInt8(opcodenum);
    buffersArray.push(opcodenumBuffer);
    bufferLength += opcodenumBuffer.length;
    if (buf) {
      let chunkBuffer;
      //   if (opcodenum < Opcode.OP_PUSHDATA1) {
      //      do nothing
      //   }
      if (opcodenum === ENexaOpcode.OP_PUSHDATA1) {
        chunkBuffer = writeUInt8(opcodenum);
      } else if (opcodenum === ENexaOpcode.OP_PUSHDATA2) {
        chunkBuffer = writeUInt16LE(chunk.len || 0);
      } else if (opcodenum === ENexaOpcode.OP_PUSHDATA4) {
        chunkBuffer = writeUInt32LE(chunk.len || 0);
      }
      if (chunkBuffer) {
        buffersArray.push(chunkBuffer);
        bufferLength += chunkBuffer.length;
      }
      buffersArray.push(buf);
      bufferLength += buf.length;
    }
  }
  return Buffer.concat(buffersArray, bufferLength);
}

function readUInt64LEBN(
  buffer: Buffer,
  position: number,
): {
  bn: BN;
  position: number;
} {
  const second = buffer.readUInt32LE(position);
  const first = buffer.readUInt32LE(position + 4);
  const combined = first * 0x1_00_00_00_00 + second;
  // Instantiating an instance of BN with a number is faster than with an
  // array or string. However, the maximum safe number for a double precision
  // floating point is 2 ^ 52 - 1 (0x1fffffffffffff), thus we can safely use
  // non-floating point numbers less than this amount (52 bits). And in the case
  // that the number is larger, we can instantiate an instance of BN by passing
  // an array from the buffer (slower) and specifying the endianness.
  let bn;
  if (combined <= 0x1f_ff_ff_ff_ff_ff_ff) {
    bn = new BN(combined);
  } else {
    const data = Array.prototype.slice.call(buffer, position, position + 8);
    bn = new BN(data, 10, 'le');
  }
  return {
    bn,
    position: position + 8,
  };
}

function readVarintNum(buffer: Buffer): { position: number; length: number } {
  let position = 0;
  let length = buffer.readUInt8(0);
  position += 1;
  switch (length) {
    case 0xfd:
      length = buffer.readUInt16LE(0);
      position += 2;
      break;
    case 0xfe:
      length = buffer.readUInt32LE(0);
      position += 4;
      break;
    case 0xff:
      {
        const { bn, position: newPosition } = readUInt64LEBN(buffer, position);
        const n = bn.toNumber();
        position = newPosition;
        if (n <= 2 ** 53) {
          length = n;
        } else {
          throw new Error(
            'number too large to retain precision - use readVarintBN',
          );
        }
      }
      break;
    default:
      break;
  }
  return {
    position,
    length,
  };
}

function readVarLengthBuffer(buffer: Buffer): Buffer {
  const { position, length } = readVarintNum(buffer);
  return buffer.slice(position, length + position);
}

export function getScriptBufferFromScriptTemplateOut(address: string) {
  const { hash } = decodeAddress(address);
  // buildScriptTemplateOut: scriptBuffer
  return readVarLengthBuffer(Buffer.from(hash));
}

export function decodeScriptBufferToScriptChunks(buffer: Buffer) {
  let i = 0;
  const chunks: INexaScriptChunk[] = [];
  // The readUInt8 function of the buffer always throws a not found error in the browser,
  // so I had to manually bind it.
  const readUint8: typeof buffer.readUInt8 =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    Buffer.prototype.readUInt8.bind(buffer);
  while (i < buffer.length) {
    const opcodenum = readUint8(i);
    i += 1;
    let len = 0;
    if (opcodenum > 0 && opcodenum < ENexaOpcode.OP_PUSHDATA1) {
      len = opcodenum;
      chunks.push({
        buf: buffer.slice(i, i + len),
        len,
        opcodenum,
      });
    } else if (opcodenum === ENexaOpcode.OP_PUSHDATA1) {
      len = buffer.readUint8(i);
      i += 1;
      chunks.push({
        buf: buffer.slice(i, i + len),
        len,
        opcodenum,
      });
    } else if (opcodenum === ENexaOpcode.OP_PUSHDATA2) {
      len = buffer.readUInt16LE(i);
      i += 2;
      chunks.push({
        buf: buffer.slice(i, i + len),
        len,
        opcodenum,
      });
    } else if (opcodenum === ENexaOpcode.OP_PUSHDATA4) {
      len = buffer.readUInt32LE(i);
      i += 4;
      chunks.push({
        buf: buffer.slice(i, i + len),
        len,
        opcodenum,
      });
    } else {
      chunks.push({
        opcodenum,
      });
    }
    i += len;
  }
  return chunks;
}

export function isPublicKeyTemplateIn(chunks: INexaScriptChunk[]) {
  if (chunks.length === 2) {
    const pubkeyPushBuf = chunks[0].buf;
    const signatureBuf = chunks[1].buf;
    if (
      signatureBuf &&
      signatureBuf.length === 64 &&
      pubkeyPushBuf &&
      pubkeyPushBuf.length === 34
    ) {
      const pubkeyBuf = decodeScriptBufferToScriptChunks(pubkeyPushBuf)[0].buf;
      if (
        pubkeyBuf &&
        pubkeyBuf.length === 33 &&
        (pubkeyBuf[0] === 0x03 || pubkeyBuf[0] === 0x02)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function isPublicKeyTemplateOut(chunks: INexaScriptChunk[]) {
  return !!(
    chunks.length === 3 &&
    chunks[0].opcodenum === ENexaOpcode.OP_FALSE &&
    chunks[1].opcodenum === ENexaOpcode.OP_1 &&
    chunks[2].buf &&
    chunks[2].buf.length === 20
  );
}
