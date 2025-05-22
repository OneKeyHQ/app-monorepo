import type { IKaspaTransaction } from './clientRestApi';
import type { IEncodedTxKaspa } from '../../types';
import type { KaspaSignTransactionParams } from '@onekeyfe/hd-core';

export type IKaspaSdkApi = {
  createKRC20RevealTxJSON: (params: {
    accountAddress: string;
    encodedTx: IEncodedTxKaspa;
    isTestnet: boolean;
  }) => Promise<string>;

  buildCommitTxInfo: ({
    accountAddress,
    transferDataString,
    isTestnet,
  }: {
    accountAddress: string;
    transferDataString: string;
    isTestnet: boolean;
  }) => Promise<{
    commitScriptPubKey: string;
    commitAddress: string;
    commitScriptHex: string;
  }>;

  signRevealTransactionSoftware: (params: {
    accountAddress: string;
    encodedTx: IEncodedTxKaspa;
    isTestnet: boolean;
    tweakedPrivateKey: string;
  }) => Promise<string>;

  signRevealTransactionHardware: (params: {
    accountAddress: string;
    encodedTx: IEncodedTxKaspa;
    isTestnet: boolean;
    signatures: {
      signature: string;
      index: number;
    }[];
  }) => Promise<string>;

  buildUnsignedTxForHardware: (params: {
    encodedTx: IEncodedTxKaspa;
    isTestnet: boolean;
    accountAddress: string;
    path: string;
    chainId: string;
  }) => Promise<KaspaSignTransactionParams>;

  deserializeFromSafeJSON: (json: string) => Promise<IKaspaTransaction>;
};

export type IGetKaspaApi = () => Promise<IKaspaSdkApi>;

export type IEnsureSDKReady = () => Promise<boolean>;

export interface IKaspaSdk {
  getKaspaApi: IGetKaspaApi;
  ensureSDKReady: IEnsureSDKReady;
}

export enum EOpcodes {
  OpFalse = 0,
  OpData1 = 1,
  OpData2 = 2,
  OpData3 = 3,
  OpData4 = 4,
  OpData5 = 5,
  OpData6 = 6,
  OpData7 = 7,
  OpData8 = 8,
  OpData9 = 9,
  OpData10 = 10,
  OpData11 = 11,
  OpData12 = 12,
  OpData13 = 13,
  OpData14 = 14,
  OpData15 = 15,
  OpData16 = 16,
  OpData17 = 17,
  OpData18 = 18,
  OpData19 = 19,
  OpData20 = 20,
  OpData21 = 21,
  OpData22 = 22,
  OpData23 = 23,
  OpData24 = 24,
  OpData25 = 25,
  OpData26 = 26,
  OpData27 = 27,
  OpData28 = 28,
  OpData29 = 29,
  OpData30 = 30,
  OpData31 = 31,
  OpData32 = 32,
  OpData33 = 33,
  OpData34 = 34,
  OpData35 = 35,
  OpData36 = 36,
  OpData37 = 37,
  OpData38 = 38,
  OpData39 = 39,
  OpData40 = 40,
  OpData41 = 41,
  OpData42 = 42,
  OpData43 = 43,
  OpData44 = 44,
  OpData45 = 45,
  OpData46 = 46,
  OpData47 = 47,
  OpData48 = 48,
  OpData49 = 49,
  OpData50 = 50,
  OpData51 = 51,
  OpData52 = 52,
  OpData53 = 53,
  OpData54 = 54,
  OpData55 = 55,
  OpData56 = 56,
  OpData57 = 57,
  OpData58 = 58,
  OpData59 = 59,
  OpData60 = 60,
  OpData61 = 61,
  OpData62 = 62,
  OpData63 = 63,
  OpData64 = 64,
  OpData65 = 65,
  OpData66 = 66,
  OpData67 = 67,
  OpData68 = 68,
  OpData69 = 69,
  OpData70 = 70,
  OpData71 = 71,
  OpData72 = 72,
  OpData73 = 73,
  OpData74 = 74,
  OpData75 = 75,
  OpPushData1 = 76,
  OpPushData2 = 77,
  OpPushData4 = 78,
  Op1Negate = 79,
  OpReserved = 80,
  OpTrue = 81,
  Op2 = 82,
  Op3 = 83,
  Op4 = 84,
  Op5 = 85,
  Op6 = 86,
  Op7 = 87,
  Op8 = 88,
  Op9 = 89,
  Op10 = 90,
  Op11 = 91,
  Op12 = 92,
  Op13 = 93,
  Op14 = 94,
  Op15 = 95,
  Op16 = 96,
  OpNop = 97,
  OpVer = 98,
  OpIf = 99,
  OpNotIf = 100,
  OpVerIf = 101,
  OpVerNotIf = 102,
  OpElse = 103,
  OpEndIf = 104,
  OpVerify = 105,
  OpReturn = 106,
  OpToAltStack = 107,
  OpFromAltStack = 108,
  Op2Drop = 109,
  Op2Dup = 110,
  Op3Dup = 111,
  Op2Over = 112,
  Op2Rot = 113,
  Op2Swap = 114,
  OpIfDup = 115,
  OpDepth = 116,
  OpDrop = 117,
  OpDup = 118,
  OpNip = 119,
  OpOver = 120,
  OpPick = 121,
  OpRoll = 122,
  OpRot = 123,
  OpSwap = 124,
  OpTuck = 125,
  /**
   * Splice opcodes.
   */
  OpCat = 126,
  OpSubStr = 127,
  OpLeft = 128,
  OpRight = 129,
  OpSize = 130,
  /**
   * Bitwise logic opcodes.
   */
  OpInvert = 131,
  OpAnd = 132,
  OpOr = 133,
  OpXor = 134,
  OpEqual = 135,
  OpEqualVerify = 136,
  OpReserved1 = 137,
  OpReserved2 = 138,
  /**
   * Numeric related opcodes.
   */
  Op1Add = 139,
  Op1Sub = 140,
  Op2Mul = 141,
  Op2Div = 142,
  OpNegate = 143,
  OpAbs = 144,
  OpNot = 145,
  Op0NotEqual = 146,
  OpAdd = 147,
  OpSub = 148,
  OpMul = 149,
  OpDiv = 150,
  OpMod = 151,
  OpLShift = 152,
  OpRShift = 153,
  OpBoolAnd = 154,
  OpBoolOr = 155,
  OpNumEqual = 156,
  OpNumEqualVerify = 157,
  OpNumNotEqual = 158,
  OpLessThan = 159,
  OpGreaterThan = 160,
  OpLessThanOrEqual = 161,
  OpGreaterThanOrEqual = 162,
  OpMin = 163,
  OpMax = 164,
  OpWithin = 165,
  /**
   * Undefined opcodes.
   */
  OpUnknown166 = 166,
  OpUnknown167 = 167,
  /**
   * Crypto opcodes.
   */
  OpSHA256 = 168,
  OpCheckMultiSigECDSA = 169,
  OpBlake2b = 170,
  OpCheckSigECDSA = 171,
  OpCheckSig = 172,
  OpCheckSigVerify = 173,
  OpCheckMultiSig = 174,
  OpCheckMultiSigVerify = 175,
  OpCheckLockTimeVerify = 176,
  OpCheckSequenceVerify = 177,
  /**
   * Undefined opcodes.
   */
  OpUnknown178 = 178,
  OpUnknown179 = 179,
  OpUnknown180 = 180,
  OpUnknown181 = 181,
  OpUnknown182 = 182,
  OpUnknown183 = 183,
  OpUnknown184 = 184,
  OpUnknown185 = 185,
  OpUnknown186 = 186,
  OpUnknown187 = 187,
  OpUnknown188 = 188,
  OpUnknown189 = 189,
  OpUnknown190 = 190,
  OpUnknown191 = 191,
  OpUnknown192 = 192,
  OpUnknown193 = 193,
  OpUnknown194 = 194,
  OpUnknown195 = 195,
  OpUnknown196 = 196,
  OpUnknown197 = 197,
  OpUnknown198 = 198,
  OpUnknown199 = 199,
  OpUnknown200 = 200,
  OpUnknown201 = 201,
  OpUnknown202 = 202,
  OpUnknown203 = 203,
  OpUnknown204 = 204,
  OpUnknown205 = 205,
  OpUnknown206 = 206,
  OpUnknown207 = 207,
  OpUnknown208 = 208,
  OpUnknown209 = 209,
  OpUnknown210 = 210,
  OpUnknown211 = 211,
  OpUnknown212 = 212,
  OpUnknown213 = 213,
  OpUnknown214 = 214,
  OpUnknown215 = 215,
  OpUnknown216 = 216,
  OpUnknown217 = 217,
  OpUnknown218 = 218,
  OpUnknown219 = 219,
  OpUnknown220 = 220,
  OpUnknown221 = 221,
  OpUnknown222 = 222,
  OpUnknown223 = 223,
  OpUnknown224 = 224,
  OpUnknown225 = 225,
  OpUnknown226 = 226,
  OpUnknown227 = 227,
  OpUnknown228 = 228,
  OpUnknown229 = 229,
  OpUnknown230 = 230,
  OpUnknown231 = 231,
  OpUnknown232 = 232,
  OpUnknown233 = 233,
  OpUnknown234 = 234,
  OpUnknown235 = 235,
  OpUnknown236 = 236,
  OpUnknown237 = 237,
  OpUnknown238 = 238,
  OpUnknown239 = 239,
  OpUnknown240 = 240,
  OpUnknown241 = 241,
  OpUnknown242 = 242,
  OpUnknown243 = 243,
  OpUnknown244 = 244,
  OpUnknown245 = 245,
  OpUnknown246 = 246,
  OpUnknown247 = 247,
  OpUnknown248 = 248,
  OpUnknown249 = 249,
  OpSmallInteger = 250,
  OpPubKeys = 251,
  OpUnknown252 = 252,
  OpPubKeyHash = 253,
  OpPubKey = 254,
  OpInvalidOpCode = 255,
}
