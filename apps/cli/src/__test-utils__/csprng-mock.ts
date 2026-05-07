import crypto from 'node:crypto';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export type ICsprng = (size: number) => Buffer;

export function createDeterministicCsprng(seed: string | number): ICsprng {
  const seedText = String(seed);
  let counter = 0;

  return (size: number) => {
    if (size < 0) {
      throw new RangeError('CSPRNG size must be non-negative');
    }

    const output = Buffer.alloc(size);
    let offset = 0;
    while (offset < size) {
      const digest = crypto
        .createHash('sha256')
        .update(seedText)
        .update(':')
        .update(String(counter))
        .digest();
      counter += 1;
      offset += digest.copy(output, offset);
    }
    return output;
  };
}

export function createSequenceCsprng(chunks: readonly Buffer[]): ICsprng {
  const queue = chunks.map((chunk) => Buffer.from(chunk));

  return (size: number) => {
    const next = queue.shift();
    if (!next) {
      throw new OneKeyLocalError('CSPRNG sequence exhausted');
    }
    if (next.length !== size) {
      throw new OneKeyLocalError(
        `CSPRNG chunk length ${next.length} !== ${size}`,
      );
    }
    return Buffer.from(next);
  };
}
