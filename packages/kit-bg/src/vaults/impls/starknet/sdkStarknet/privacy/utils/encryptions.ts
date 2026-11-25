/**
 * Encryption/decryption utilities for privacy operations.
 * Names and formulas match the Cairo implementation in packages/privacy/src/utils.cairo
 *
 * Cairo uses field arithmetic (mod FIELD_PRIME), not curve order arithmetic.
 */

import { BigNumberish, ec } from "starknet";
import { toHex, toBytes } from "./convert";
import {
  compute_enc_channel_key_hash,
  compute_enc_sender_addr_hash,
  compute_enc_token_hash,
  compute_enc_amount_hash,
  compute_enc_recipient_addr_hash,
  compute_enc_private_key_hash,
  compute_enc_user_addr_hash,
} from "./hashes";
import { toBigInt } from "./convert";
import type {
  EncChannelInfo,
  EncSubchannelInfo,
  EncOutgoingChannelInfo,
} from "../internal/pool-contract-interface";

// Re-export generated types for backwards compatibility
export type { EncChannelInfo, EncSubchannelInfo, EncOutgoingChannelInfo };

const starkCurve = ec.starkCurve;

// Field prime P for felt252 (Stark curve base field) - matches Cairo's field arithmetic
const FIELD_PRIME = starkCurve.CURVE.Fp.ORDER;

const TWO_POW_128 = 2n ** 128n;

// ============ Helper Functions ============

/**
 * Get the x-coordinate from a public key bytes (compressed or uncompressed).
 */
function getXCoordinateFromBytes(publicKeyBytes: Uint8Array): bigint {
  const start = publicKeyBytes.length === 33 ? 1 : publicKeyBytes.length === 65 ? 1 : 0;
  const end = start + 32;
  return BigInt(toHex(publicKeyBytes.slice(start, end)));
}

/**
 * Recover a curve point from just the x-coordinate.
 * Computes y from the curve equation: y² = x³ + ax + b (mod p)
 */
function recoverPointFromX(x: bigint): Uint8Array {
  const Fp = starkCurve.CURVE.Fp;
  const a = starkCurve.CURVE.a;
  const b = starkCurve.CURVE.b;

  const x3 = Fp.mul(Fp.mul(x, x), x);
  const ax = Fp.mul(a, x);
  const y2 = Fp.add(Fp.add(x3, ax), b);

  const y = Fp.sqrt(y2);
  if (y === undefined) {
    throw new Error(`x-coordinate ${x} is not on the curve`);
  }

  const point = starkCurve.ProjectivePoint.fromAffine({ x, y });
  return point.toRawBytes(true);
}

// ============ Types ============
// Note: EncChannelInfo, EncSubchannelInfo, EncOutgoingChannelInfo are imported from pool-contract-interface.ts

/** Decrypted channel information */
export type ChannelInfo = {
  key: bigint;
  sender: bigint;
};

/** Decrypted subchannel information */
export type SubchannelInfo = {
  token: bigint;
  salt: bigint;
};

/** Decrypted outgoing channel information */
export type OutgoingChannelInfo = {
  recipientAddr: bigint;
  salt: bigint;
};

/** Encrypted private key (matches Cairo EncPrivateKey struct) */
export type EncPrivateKey = {
  ephemeralPubkey: bigint;
  encPrivateKey: bigint;
};

/** Encrypted user address (matches Cairo EncUserAddr struct) */
export type EncUserAddr = {
  ephemeralPubkey: bigint;
  encUserAddr: bigint;
};

// ============ Encryptions Module ============

export const encryptions = {
  // ============ Channel Info (ECDH) ============

  /**
   * Encrypt channel info using ECDH.
   * Matches Cairo's encrypt_channel_info in utils.cairo.
   *
   * @param ephemeralSecret - Random scalar for ECDH
   * @param recipientPublicKey - Recipient's public key (x-coordinate)
   * @param channelKey - The channel key to encrypt
   * @param senderAddr - The sender's address to encrypt
   */
  encryptChannelInfo: (
    ephemeralSecret: bigint,
    recipientPublicKey: bigint,
    channelKey: bigint,
    senderAddr: bigint
  ): EncChannelInfo => {
    const ephemeralSecretBytes = toBytes(ephemeralSecret);

    // Compute ephemeral public key
    const ephemeralPubPoint = starkCurve.getPublicKey(ephemeralSecretBytes);
    const ephemeralPubkey = getXCoordinateFromBytes(ephemeralPubPoint);

    // Recover recipient public key point from x-coordinate
    const recipientPubBytes = recoverPointFromX(recipientPublicKey);

    // Compute shared secret via ECDH
    const sharedPoint = starkCurve.getSharedSecret(ephemeralSecretBytes, recipientPubBytes);
    const sharedX = getXCoordinateFromBytes(sharedPoint);

    // Encrypt using field addition (matching Cairo)
    const encChannelKey = (compute_enc_channel_key_hash(sharedX) + channelKey) % FIELD_PRIME;
    const encSenderAddr = (compute_enc_sender_addr_hash(sharedX) + senderAddr) % FIELD_PRIME;

    return {
      ephemeral_pubkey: ephemeralPubkey,
      enc_channel_key: encChannelKey,
      enc_sender_addr: encSenderAddr,
    };
  },

  /**
   * Decrypt channel info using ECDH.
   * Matches Cairo's decryption of EncChannelInfo.
   *
   * @param encrypted - The encrypted channel info
   * @param recipientPrivateKey - The recipient's private key
   */
  decryptChannelInfo: (
    encrypted: EncChannelInfo,
    recipientPrivateKey: BigNumberish
  ): ChannelInfo => {
    const privateKeyBytes = toBytes(recipientPrivateKey);

    // Recover ephemeral public key point from x-coordinate
    const ephemeralPubBytes = recoverPointFromX(toBigInt(encrypted.ephemeral_pubkey));

    // Compute shared secret via ECDH
    const sharedPoint = starkCurve.getSharedSecret(privateKeyBytes, ephemeralPubBytes);
    const sharedX = getXCoordinateFromBytes(sharedPoint);

    // Decrypt using field subtraction (matching Cairo)
    const key =
      (((toBigInt(encrypted.enc_channel_key) - compute_enc_channel_key_hash(sharedX)) %
        FIELD_PRIME) +
        FIELD_PRIME) %
      FIELD_PRIME;
    const sender =
      (((toBigInt(encrypted.enc_sender_addr) - compute_enc_sender_addr_hash(sharedX)) %
        FIELD_PRIME) +
        FIELD_PRIME) %
      FIELD_PRIME;

    return { key, sender };
  },

  // ============ Subchannel Info ============

  /**
   * Encrypt subchannel info.
   * Matches Cairo's encrypt_subchannel_info in utils.cairo.
   *
   * enc_token = h(ENC_TOKEN_TAG, channel_key, index, 0, salt) + token
   *
   * @param channelKey - The channel key
   * @param index - The subchannel index
   * @param token - The token address to encrypt
   * @param salt - Random salt for encryption
   */
  encryptSubchannelInfo: (
    channelKey: bigint,
    index: number,
    token: bigint,
    salt: bigint
  ): EncSubchannelInfo => {
    const encTokenHash = compute_enc_token_hash(channelKey, index, salt);
    const enc_token = (encTokenHash + token) % FIELD_PRIME;
    return { salt, enc_token };
  },

  /**
   * Decrypt subchannel info.
   * Inverse of encrypt_subchannel_info.
   *
   * token = enc_token - h(ENC_TOKEN_TAG, channel_key, index, 0, salt)
   *
   * @param encrypted - The encrypted subchannel info (with salt and enc_token fields)
   * @param channelKey - The channel key
   * @param index - The subchannel index
   * @returns Decrypted token and salt
   */
  decryptSubchannelInfo: (
    encrypted: EncSubchannelInfo,
    channelKey: bigint,
    index: number
  ): SubchannelInfo => {
    const salt = toBigInt(encrypted.salt);
    const enc_token = toBigInt(encrypted.enc_token);
    const encTokenHash = compute_enc_token_hash(channelKey, index, salt);
    const token = (((enc_token - encTokenHash) % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
    return { token, salt };
  },

  // ============ Note Amount ============

  /**
   * Encrypt note amount.
   * Matches Cairo's enc_note_packed_value in utils.cairo.
   *
   * Result is packed: (salt << 128) | enc_amount
   * enc_amount = (hash + amount) % 2^128
   *
   * @param channelKey - The channel key
   * @param token - The token address
   * @param index - The note index
   * @param salt - Random salt (must be 120 bits)
   * @param amount - The amount to encrypt
   */
  encryptNoteAmount: (
    channelKey: bigint,
    token: bigint,
    index: number,
    salt: bigint,
    amount: bigint
  ): bigint => {
    const encAmountHash = compute_enc_amount_hash(channelKey, token, index, salt);
    const encAmount = (encAmountHash + amount) % TWO_POW_128;
    // Pack: salt in upper bits, encAmount in lower 128 bits
    return salt * TWO_POW_128 + encAmount;
  },

  /**
   * Decrypt note amount.
   * Matches Cairo's decrypt_note_amount in utils.cairo.
   *
   * @param encNoteValue - The packed encrypted value (salt || enc_amount)
   * @param channelKey - The channel key
   * @param token - The token address
   * @param index - The note index
   * @returns Object with decrypted amount and extracted salt
   */
  decryptNoteAmount: (
    encNoteValue: bigint,
    channelKey: bigint,
    token: bigint,
    index: number
  ): { amount: bigint; salt: bigint } => {
    // Unpack
    const salt = encNoteValue / TWO_POW_128;
    const encAmount = encNoteValue % TWO_POW_128;
    // Decrypt
    const pad = compute_enc_amount_hash(channelKey, token, index, salt) % TWO_POW_128;
    const amount = (encAmount + TWO_POW_128 - pad) % TWO_POW_128;
    return { amount, salt };
  },

  // ============ Public Key ============

  /**
   * Derive public key from private key (returns x-coordinate).
   * Matches Cairo's derive_public_key in utils.cairo.
   */
  derivePublicKey: (privateKey: bigint): bigint => {
    const privateKeyBytes = toBytes(privateKey);
    const publicKeyBytes = starkCurve.getPublicKey(privateKeyBytes);
    return getXCoordinateFromBytes(publicKeyBytes);
  },

  // ============ Outgoing Channel Info ============

  /**
   * Encrypt outgoing channel info.
   * Matches Cairo's encrypt_outgoing_channel_info in utils.cairo.
   *
   * enc_recipient_addr = h(ENC_RECIPIENT_ADDR_TAG, sender_addr, sender_private_key, index, salt) + recipient_addr
   *
   * @param senderAddr - The sender's address
   * @param senderPrivateKey - The sender's private key
   * @param index - The channel index
   * @param recipientAddr - The recipient's address to encrypt
   * @param salt - Random salt for encryption
   */
  encryptOutgoingChannelInfo: (
    senderAddr: bigint,
    senderPrivateKey: bigint,
    index: number,
    recipientAddr: bigint,
    salt: bigint
  ): EncOutgoingChannelInfo => {
    const encRecipientAddrHash = compute_enc_recipient_addr_hash(
      senderAddr,
      senderPrivateKey,
      index,
      salt
    );
    const enc_recipient_addr = (encRecipientAddrHash + recipientAddr) % FIELD_PRIME;
    return { salt, enc_recipient_addr };
  },

  /**
   * Decrypt outgoing channel info.
   * Inverse of encrypt_outgoing_channel_info.
   *
   * @param encrypted - The encrypted outgoing channel info
   * @param senderAddr - The sender's address
   * @param senderPrivateKey - The sender's private key
   * @param index - The channel index
   */
  decryptOutgoingChannelInfo: (
    encrypted: EncOutgoingChannelInfo,
    senderAddr: BigNumberish,
    senderPrivateKey: BigNumberish,
    index: number
  ): OutgoingChannelInfo => {
    const salt = toBigInt(encrypted.salt);
    const enc_recipient_addr = toBigInt(encrypted.enc_recipient_addr);
    const encRecipientAddrHash = compute_enc_recipient_addr_hash(
      toBigInt(senderAddr),
      toBigInt(senderPrivateKey),
      index,
      salt
    );
    const recipientAddr =
      (((enc_recipient_addr - encRecipientAddrHash) % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME;
    return { recipientAddr, salt };
  },

  // ============ Private Key (ECDH) ============

  /**
   * Encrypt private key using ECDH.
   * Matches Cairo's encrypt_private_key in utils.cairo.
   *
   * @param ephemeralSecret - Random scalar for ECDH
   * @param auditorPublicKey - Auditor's public key (x-coordinate)
   * @param privateKey - The private key to encrypt
   */
  encryptPrivateKey: (
    ephemeralSecret: bigint,
    auditorPublicKey: bigint,
    privateKey: bigint
  ): EncPrivateKey => {
    const ephemeralSecretBytes = toBytes(ephemeralSecret);

    // Compute ephemeral public key
    const ephemeralPubPoint = starkCurve.getPublicKey(ephemeralSecretBytes);
    const ephemeralPubkey = getXCoordinateFromBytes(ephemeralPubPoint);

    // Recover auditor public key point from x-coordinate
    const auditorPubBytes = recoverPointFromX(auditorPublicKey);

    // Compute shared secret via ECDH
    const sharedPoint = starkCurve.getSharedSecret(ephemeralSecretBytes, auditorPubBytes);
    const sharedX = getXCoordinateFromBytes(sharedPoint);

    // Encrypt using field addition (matching Cairo)
    const encPrivateKey = (compute_enc_private_key_hash(sharedX) + privateKey) % FIELD_PRIME;

    return { ephemeralPubkey, encPrivateKey };
  },

  /**
   * Decrypt private key using ECDH.
   * Inverse of encrypt_private_key.
   *
   * @param encrypted - The encrypted private key
   * @param auditorPrivateKey - The auditor's private key
   */
  decryptPrivateKey: (encrypted: EncPrivateKey, auditorPrivateKey: bigint): bigint => {
    const privateKeyBytes = toBytes(auditorPrivateKey);

    // Recover ephemeral public key point from x-coordinate
    const ephemeralPubBytes = recoverPointFromX(encrypted.ephemeralPubkey);

    // Compute shared secret via ECDH
    const sharedPoint = starkCurve.getSharedSecret(privateKeyBytes, ephemeralPubBytes);
    const sharedX = getXCoordinateFromBytes(sharedPoint);

    // Decrypt using field subtraction (matching Cairo)
    const privateKey =
      (((encrypted.encPrivateKey - compute_enc_private_key_hash(sharedX)) % FIELD_PRIME) +
        FIELD_PRIME) %
      FIELD_PRIME;

    return privateKey;
  },

  // ============ User Address (ECDH) ============

  /**
   * Encrypt user address using ECDH.
   * Matches Cairo's encrypt_user_addr in utils.cairo.
   *
   * @param ephemeralSecret - Random scalar for ECDH
   * @param auditorPublicKey - Auditor's public key (x-coordinate)
   * @param userAddr - The user address to encrypt
   */
  encryptUserAddr: (
    ephemeralSecret: bigint,
    auditorPublicKey: bigint,
    userAddr: bigint
  ): EncUserAddr => {
    const ephemeralSecretBytes = toBytes(ephemeralSecret);

    // Compute ephemeral public key
    const ephemeralPubPoint = starkCurve.getPublicKey(ephemeralSecretBytes);
    const ephemeralPubkey = getXCoordinateFromBytes(ephemeralPubPoint);

    // Recover auditor public key point from x-coordinate
    const auditorPubBytes = recoverPointFromX(auditorPublicKey);

    // Compute shared secret via ECDH
    const sharedPoint = starkCurve.getSharedSecret(ephemeralSecretBytes, auditorPubBytes);
    const sharedX = getXCoordinateFromBytes(sharedPoint);

    // Encrypt using field addition (matching Cairo)
    const encUserAddr = (compute_enc_user_addr_hash(sharedX) + userAddr) % FIELD_PRIME;

    return { ephemeralPubkey, encUserAddr };
  },

  /**
   * Decrypt user address using ECDH.
   * Inverse of encrypt_user_addr.
   *
   * @param encrypted - The encrypted user address
   * @param auditorPrivateKey - The auditor's private key
   */
  decryptUserAddr: (encrypted: EncUserAddr, auditorPrivateKey: bigint): bigint => {
    const privateKeyBytes = toBytes(auditorPrivateKey);

    // Recover ephemeral public key point from x-coordinate
    const ephemeralPubBytes = recoverPointFromX(encrypted.ephemeralPubkey);

    // Compute shared secret via ECDH
    const sharedPoint = starkCurve.getSharedSecret(privateKeyBytes, ephemeralPubBytes);
    const sharedX = getXCoordinateFromBytes(sharedPoint);

    // Decrypt using field subtraction (matching Cairo)
    const userAddr =
      (((encrypted.encUserAddr - compute_enc_user_addr_hash(sharedX)) % FIELD_PRIME) +
        FIELD_PRIME) %
      FIELD_PRIME;

    return userAddr;
  },
};
