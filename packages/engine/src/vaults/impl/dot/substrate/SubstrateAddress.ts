import base58 from 'bs58';

import {
  addHexPrefix,
  isHexString,
} from '@onekeyhq/engine/src/vaults/utils/hexUtils';

import { blake2bAsBytes } from '../utils/blake2b';

import type { SubstrateAccountId } from '../sdk/types';
import type { SubstrateCompatAddress } from './SubstrateCompatAddress';

const SS58_PREFIX = 'SS58PRE';

/*
 * An address doesn't have a fixed length. Interpretation:
 * [total bytes: version bytes, payload bytes, checksum bytes]
 * 3:  1, 1,  1
 * 4:  1, 2,  1
 * 6:  1, 4,  1
 * 35: 1, 32, 2
 */
export class SubstrateAddress implements SubstrateCompatAddress {
  private static placeholder: SubstrateAddress | undefined;

  public static createPlaceholder(): SubstrateAddress {
    if (!SubstrateAddress.placeholder) {
      const payload = new Uint8Array(32);
      payload.fill(0);

      SubstrateAddress.placeholder = new SubstrateAddress(
        Buffer.from([0]),
        Buffer.from(payload),
        Buffer.from([0, 0]),
      );
    }

    return SubstrateAddress.placeholder;
  }

  public static from(
    accountId: SubstrateAccountId<SubstrateAddress>,
    ss58Format = 42,
  ): SubstrateAddress {
    if (typeof accountId === 'string' && isHexString(addHexPrefix(accountId))) {
      return SubstrateAddress.fromPublicKey(accountId, ss58Format);
    }
    if (typeof accountId === 'string') {
      return SubstrateAddress.fromEncoded(accountId);
    }
    return accountId;
  }

  public static fromPublicKey(
    payload: Buffer | string,
    ss58Format = 42,
  ): SubstrateAddress {
    if (typeof payload === 'string') {
      return SubstrateAddress.fromPayload(
        Buffer.from(payload, 'hex'),
        ss58Format,
      );
    }
    return SubstrateAddress.fromPayload(payload, ss58Format);
  }

  public static fromEncoded(encoded: string): SubstrateAddress {
    return SubstrateAddress.fromBytes(base58.decode(encoded));
  }

  private static fromBytes(bytes: Buffer | Uint8Array): SubstrateAddress {
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const checksumBytes = buffer.length === 35 ? 2 : 1;

    const version = buffer.slice(0, 1);
    const payload = buffer.slice(1, -checksumBytes);
    const checksum = buffer.slice(-checksumBytes);

    return new SubstrateAddress(version, payload, checksum);
  }

  private static fromPayload(payload: Buffer, format: number) {
    const version = Buffer.from([format]);
    const checksum = this.generateChecksum(Buffer.concat([version, payload]));
    const checksumBytes = payload.length === 32 ? 2 : 1;

    return new SubstrateAddress(
      version,
      payload,
      checksum.slice(0, checksumBytes),
    );
  }

  private static generateChecksum(input: Buffer): Buffer {
    const prefixBuffer = Buffer.from(SS58_PREFIX);

    return Buffer.from(
      blake2bAsBytes(Buffer.concat([prefixBuffer, input]), 512),
    );
  }

  private encoded: string | undefined;

  constructor(
    readonly version: Buffer,
    readonly payload: Buffer,
    readonly checksum: Buffer,
  ) {
    this.version = version;
    this.payload = payload;
    this.checksum = checksum;
  }

  public compare(other: SubstrateAccountId<SubstrateAddress>): number {
    if (typeof other === 'string' && isHexString(other)) {
      return this.payload.compare(Buffer.from(other, 'hex'));
    }
    if (typeof other === 'string') {
      return this.getValue().localeCompare(other);
    }
    return this.payload.compare(other.payload);
  }

  public getValue(): string {
    if (!this.encoded) {
      this.encoded = base58.encode(
        Buffer.concat([this.version, this.payload, this.checksum]),
      );
    }

    return this.encoded;
  }

  public getBufferBytes(): Buffer {
    return this.payload;
  }

  public getHexBytes(): string {
    return this.payload.toString('hex');
  }
}
