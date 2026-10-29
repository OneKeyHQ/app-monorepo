// cspell:ignore tsx clsag clsags varint subaddr rsig
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { zPrivacyBaseUnits } from '@onekeyhq/shared/src/utils/privacyTransactionReview';

const hex32 = z.string().regex(/^[0-9a-fA-F]{64}$/);
const hexBytes = z.string().regex(/^(?:[0-9a-fA-F]{2})+$/);
const atomic = zPrivacyBaseUnits('18446744073709551615');
const uint = z.number().int().nonnegative().safe();

// Protobuf objects go to the device as parsed; `strict` refuses a field that
// would otherwise be dropped silently.
const destinationSchema = z
  .object({
    amount: atomic,
    addr: z
      .object({ spend_public_key: hex32, view_public_key: hex32 })
      .strict(),
    is_subaddress: z.boolean(),
    is_integrated: z.boolean(),
    original: z.string().min(1).optional(),
  })
  .strict();

const sourceSchema = z
  .object({
    outputs: z
      .array(
        z
          .object({
            idx: uint,
            key: z.object({ dest: hex32, commitment: hex32 }).strict(),
          })
          .strict(),
      )
      .min(1),
    real_output: uint,
    real_out_tx_key: hex32,
    real_out_additional_tx_keys: z.array(hex32),
    real_output_in_tx_index: uint,
    amount: atomic,
    rct: z.boolean(),
    mask: hex32,
    subaddr_minor: uint,
  })
  .strict();

const tsxDataSchema = z
  .object({
    version: uint,
    client_version: uint,
    hard_fork: uint,
    unlock_time: uint,
    num_inputs: uint,
    mixin: uint,
    fee: atomic,
    account: uint,
    minor_indices: z.array(uint),
    outputs: z.array(destinationSchema).min(1),
    change_dts: destinationSchema,
    rsig_data: z
      .object({
        rsig_type: uint,
        bp_version: uint,
        grouping: z.array(uint),
        offload_type: uint.optional(),
        mask: hexBytes.optional(),
        rsig: hexBytes.optional(),
        rsig_parts: z.array(hexBytes).optional(),
      })
      .strict(),
    payment_id: hexBytes.optional(),
    integrated_indices: z.array(uint),
    monero_version: z.string().optional(),
  })
  .strict();

const devicePlanSchema = z
  .object({
    version: z.literal(1),
    networkType: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    tsxData: tsxDataSchema,
    inputs: z.array(sourceSchema).min(1),
    expected: z.object({
      keyImages: z.array(hex32),
      fee: atomic,
      recipientAmount: atomic,
      changeAmount: atomic,
    }),
  })
  .refine(
    (plan) =>
      plan.inputs.length === plan.tsxData.num_inputs &&
      plan.expected.keyImages.length === plan.inputs.length,
  );

/** What the runtime plans for a hardware send; the device builds the outputs from it. */
export type IXmrDevicePlan = z.infer<typeof devicePlanSchema>;

// Never echo the plan: it holds the real ring members, masks and amounts.
export function parseXmrDevicePlan(json: string): IXmrDevicePlan {
  let plan: IXmrDevicePlan | undefined;
  try {
    const parsed = devicePlanSchema.safeParse(JSON.parse(json));
    if (parsed.success) plan = parsed.data;
  } catch {
    // JSON.parse quotes the input in its error.
  }
  if (!plan) {
    throw new OneKeyLocalError('xmr: malformed device signing plan');
  }
  return plan;
}

const assembledSchema = z.object({
  txid: z.string().regex(/^[0-9a-f]{64}$/),
  rawHex: z.string().regex(/^(?:[0-9a-f]{2})+$/),
});

export function parseXmrAssembledTransaction(
  json: string,
): z.infer<typeof assembledSchema> {
  const parsed = assembledSchema.safeParse(JSON.parse(json));
  if (!parsed.success) {
    throw new OneKeyLocalError('xmr: invalid assembled transaction response');
  }
  return parsed.data;
}

const SEALING_DOMAIN_BYTES = 12;
const SEALING_INDEX_BYTES = 4;

// wallet2 compute_sealing_key / firmware offloading_keys._build_key:
// keccak(keccak(key ‖ domain zero-padded to 12 ‖ varint(index) zero-padded to 4)).
function deriveSealingKey(
  openingKey: Uint8Array,
  domain: 'sig-key' | 'sig-iv',
  index: number,
): Uint8Array {
  const varint: number[] = [];
  let rest = index;
  do {
    const low = rest % 128;
    rest = Math.floor(rest / 128);
    varint.push(rest > 0 ? low + 128 : low);
  } while (rest > 0);
  if (varint.length > SEALING_INDEX_BYTES) {
    throw new OneKeyLocalError('xmr: too many signatures from the device');
  }
  const buffer = new Uint8Array(
    openingKey.length + SEALING_DOMAIN_BYTES + SEALING_INDEX_BYTES,
  );
  buffer.set(openingKey, 0);
  buffer.set(bufferUtils.utf8ToBytes(domain), openingKey.length);
  buffer.set(varint, openingKey.length + SEALING_DOMAIN_BYTES);
  return keccak256(keccak256(buffer));
}

// CLSAG as the device serializes it: varint(ring size) ‖ s[ring size] ‖ c1 ‖ D.
function isClsagLayout(plain: Uint8Array): boolean {
  let ringSize = 0;
  for (let offset = 0; offset < Math.min(plain.length, 4); offset += 1) {
    const byte = plain[offset];
    ringSize += (byte % 128) * 128 ** offset;
    if (byte < 128) {
      return ringSize > 0 && plain.length === offset + 1 + 32 * (ringSize + 2);
    }
  }
  return false;
}

/**
 * Opens the sealed CLSAGs the device returns in the key-image sorted order; the
 * device reveals `openingKey` only after the user confirmed. Opening proves
 * nothing about the content: the runtime verifies each one against its ring.
 */
export function openXmrDeviceSignatures({
  openingKey,
  signatures,
}: {
  openingKey: string;
  signatures: string[];
}): string[] {
  const master = bufferUtils.hexToBytes(openingKey);
  if (master.length !== 32) {
    throw new OneKeyLocalError('xmr: malformed signature opening key');
  }
  return signatures.map((sealed, index) => {
    const key = deriveSealingKey(master, 'sig-key', index);
    const nonce = deriveSealingKey(master, 'sig-iv', index).subarray(0, 12);
    let plain: Uint8Array;
    try {
      plain = chacha20poly1305(key, nonce).decrypt(
        bufferUtils.hexToBytes(sealed),
      );
    } catch {
      throw new OneKeyLocalError(
        'xmr: signature from the device does not open',
      );
    }
    if (!isClsagLayout(plain)) {
      throw new OneKeyLocalError('xmr: malformed signature from the device');
    }
    return bufferUtils.bytesToHex(plain);
  });
}
