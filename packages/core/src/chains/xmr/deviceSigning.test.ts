// cspell:ignore tsx clsag clsags varint subaddr rsig
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { keccak_256 as keccak256 } from '@noble/hashes/sha3';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  openXmrDeviceSignatures,
  parseXmrAssembledTransaction,
  parseXmrDevicePlan,
} from './deviceSigning';

// trezor-firmware core/tests/test_apps.monero.proto.py, test_sign_keys: the
// firmware's offloading_keys.key_signature(master, index, is_iv).
const UPSTREAM_MASTER =
  'ca3bbe08a178a4508c3992a47ba775799e7626a365ed136e803fe5f2df2ce01c';
const UPSTREAM = {
  0: {
    nonce: 'bb665d97ac7c77995578e352',
    key: '87bb70af81bb7325f73e8b962167579454d126ff8ee51472922d7c103fc60f5f',
  },
  3: {
    nonce: 'b2ef8e4e4eec72ce3096622a',
    key: 'e4331602a83a68c892a83693a1b961564048d9349111b85b8b4b52a1adcf36da',
  },
};

// Written from wallet2 compute_sealing_key, independently of the module:
// keccak(keccak(master ‖ domain zero-padded to 12 ‖ varint zero-padded to 4)).
function deriveForTest(
  master: Uint8Array,
  domain: 'sig-key' | 'sig-iv',
  varint: number[],
): Uint8Array {
  const domainBytes = Array.from(domain, (char) => char.charCodeAt(0));
  return keccak256(
    keccak256(
      Uint8Array.from([
        ...master,
        ...domainBytes,
        ...new Array<number>(12 - domainBytes.length).fill(0),
        ...varint,
        ...new Array<number>(4 - varint.length).fill(0),
      ]),
    ),
  );
}

function varintForTest(index: number): number[] {
  return index < 128
    ? [index]
    : [0x80 + (index % 128), Math.floor(index / 128)];
}

// varint(ring size) ‖ s[ring size] ‖ c1 ‖ D, filled with one byte.
function clsag(ringSize: number, fill: number): Uint8Array {
  return Uint8Array.from([
    ringSize,
    ...new Array<number>(32 * (ringSize + 2)).fill(fill),
  ]);
}

function seal(plain: Uint8Array, key: Uint8Array, nonce: Uint8Array): string {
  return bufferUtils.bytesToHex(chacha20poly1305(key, nonce).encrypt(plain));
}

function sealAt(master: Uint8Array, index: number, plain: Uint8Array): string {
  const varint = varintForTest(index);
  return seal(
    plain,
    deriveForTest(master, 'sig-key', varint),
    deriveForTest(master, 'sig-iv', varint).subarray(0, 12),
  );
}

describe('openXmrDeviceSignatures', () => {
  const master = bufferUtils.hexToBytes(UPSTREAM_MASTER);

  it('derives keys the way the upstream firmware vector does (test helper check)', () => {
    for (const index of [0, 3] as const) {
      expect(
        bufferUtils.bytesToHex(deriveForTest(master, 'sig-key', [index])),
      ).toBe(UPSTREAM[index].key);
      expect(
        bufferUtils.bytesToHex(
          deriveForTest(master, 'sig-iv', [index]).subarray(0, 12),
        ),
      ).toBe(UPSTREAM[index].nonce);
    }
  });

  it('opens each signature with the key of its sorted index, per the firmware vector', () => {
    const plains = [0x10, 0x11, 0x12, 0x13].map((fill) => clsag(16, fill));
    const signatures = [
      seal(
        plains[0],
        bufferUtils.hexToBytes(UPSTREAM[0].key),
        bufferUtils.hexToBytes(UPSTREAM[0].nonce),
      ),
      sealAt(master, 1, plains[1]),
      sealAt(master, 2, plains[2]),
      seal(
        plains[3],
        bufferUtils.hexToBytes(UPSTREAM[3].key),
        bufferUtils.hexToBytes(UPSTREAM[3].nonce),
      ),
    ];

    expect(
      openXmrDeviceSignatures({ openingKey: UPSTREAM_MASTER, signatures }),
    ).toEqual(plains.map((plain) => bufferUtils.bytesToHex(plain)));
  });

  it('returns the plaintext unchanged, ring-size varint included', () => {
    const [opened] = openXmrDeviceSignatures({
      openingKey: UPSTREAM_MASTER,
      signatures: [sealAt(master, 0, clsag(16, 0xab))],
    });
    expect(opened.slice(0, 2)).toBe('10');
    expect(opened).toHaveLength(2 * (1 + 32 * 18));
  });

  it('encodes an index past 127 as a two-byte varint', () => {
    const plains = Array.from({ length: 130 }, (_, index) =>
      clsag(2, index % 256),
    );
    const opened = openXmrDeviceSignatures({
      openingKey: UPSTREAM_MASTER,
      signatures: plains.map((plain, index) => sealAt(master, index, plain)),
    });
    expect(opened[128]).toBe(bufferUtils.bytesToHex(plains[128]));
    expect(opened[129]).toBe(bufferUtils.bytesToHex(plains[129]));
  });

  it('refuses a signature that fails authentication or sits at another index', () => {
    const first = sealAt(master, 0, clsag(16, 1));
    const second = sealAt(master, 1, clsag(16, 2));
    const tampered = `${first.slice(0, -2)}${first.endsWith('00') ? '01' : '00'}`;

    expect(() =>
      openXmrDeviceSignatures({
        openingKey: UPSTREAM_MASTER,
        signatures: [tampered],
      }),
    ).toThrow('does not open');
    expect(() =>
      openXmrDeviceSignatures({
        openingKey: UPSTREAM_MASTER,
        signatures: [second, first],
      }),
    ).toThrow('does not open');
  });

  it('refuses an opening key of the wrong size', () => {
    expect(() =>
      openXmrDeviceSignatures({ openingKey: '00', signatures: [] }),
    ).toThrow('malformed signature opening key');
  });

  it('refuses a plaintext that is not a CLSAG', () => {
    const short = clsag(16, 1).subarray(0, 100);
    const zeroRing = Uint8Array.from([0, ...new Array<number>(64).fill(1)]);
    for (const plain of [short, zeroRing]) {
      expect(() =>
        openXmrDeviceSignatures({
          openingKey: UPSTREAM_MASTER,
          signatures: [sealAt(master, 0, plain)],
        }),
      ).toThrow('malformed signature from the device');
    }
  });
});

const change = {
  amount: '500000000000',
  addr: { spend_public_key: 'cc'.repeat(32), view_public_key: 'cd'.repeat(32) },
  is_subaddress: false,
  is_integrated: false,
};

function devicePlan() {
  return {
    version: 1,
    networkType: 0,
    tsxData: {
      version: 1,
      client_version: 3,
      hard_fork: 16,
      unlock_time: 0,
      num_inputs: 1,
      mixin: 15,
      fee: '30000000',
      account: 0,
      minor_indices: [0],
      outputs: [
        {
          amount: '1000000000000',
          addr: {
            spend_public_key: 'aa'.repeat(32),
            view_public_key: 'ab'.repeat(32),
          },
          is_subaddress: true,
          is_integrated: false,
          original: '8recipient',
        },
        change,
      ],
      change_dts: change,
      rsig_data: { rsig_type: 3, bp_version: 4, grouping: [2] },
      integrated_indices: [],
    },
    inputs: [
      {
        outputs: Array.from({ length: 16 }, (_, index) => ({
          idx: 9_000_000 + index,
          key: { dest: 'dd'.repeat(32), commitment: 'de'.repeat(32) },
        })),
        real_output: 3,
        real_out_tx_key: '11'.repeat(32),
        real_out_additional_tx_keys: [],
        real_output_in_tx_index: 1,
        amount: '1500030000000',
        rct: true,
        mask: '22'.repeat(32),
        subaddr_minor: 0,
      },
    ],
    expected: {
      keyImages: ['33'.repeat(32)],
      fee: '30000000',
      recipientAmount: '1000000000000',
      changeAmount: '500000000000',
    },
  };
}

describe('parseXmrDevicePlan', () => {
  it('keeps every field the device needs exactly as the runtime planned it', () => {
    const plan = devicePlan();
    const parsed = parseXmrDevicePlan(JSON.stringify(plan));
    expect(parsed.tsxData).toEqual(plan.tsxData);
    expect(parsed.inputs).toEqual(plan.inputs);
  });

  it('refuses a field it would otherwise drop before the device sees it', () => {
    const plan = devicePlan();
    const withMultisig = {
      ...plan,
      inputs: [{ ...plan.inputs[0], multisig_kLRki: { K: '00' } }],
    };
    expect(() => parseXmrDevicePlan(JSON.stringify(withMultisig))).toThrow(
      'malformed device signing plan',
    );
  });

  it('refuses null for an absent optional field', () => {
    const plan = devicePlan();
    expect(() =>
      parseXmrDevicePlan(
        JSON.stringify({
          ...plan,
          tsxData: { ...plan.tsxData, payment_id: null },
        }),
      ),
    ).toThrow('malformed device signing plan');
  });

  it('refuses inputs that disagree with the transaction data or key images', () => {
    const plan = devicePlan();
    expect(() =>
      parseXmrDevicePlan(
        JSON.stringify({
          ...plan,
          tsxData: { ...plan.tsxData, num_inputs: 2 },
        }),
      ),
    ).toThrow('malformed device signing plan');
    expect(() =>
      parseXmrDevicePlan(
        JSON.stringify({
          ...plan,
          expected: { ...plan.expected, keyImages: [] },
        }),
      ),
    ).toThrow('malformed device signing plan');
  });

  it('never quotes the plan when it is not even JSON', () => {
    const secret = `{"mask":"${'77'.repeat(32)}"`;
    let message = '';
    try {
      parseXmrDevicePlan(secret);
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toBe('xmr: malformed device signing plan');
  });
});

describe('parseXmrAssembledTransaction', () => {
  it('reads the txid and raw transaction', () => {
    expect(
      parseXmrAssembledTransaction(
        JSON.stringify({ txid: 'ab'.repeat(32), rawHex: '0200' }),
      ),
    ).toEqual({ txid: 'ab'.repeat(32), rawHex: '0200' });
  });

  it('refuses anything else', () => {
    expect(() =>
      parseXmrAssembledTransaction(
        JSON.stringify({ txid: 'ab', rawHex: '0200' }),
      ),
    ).toThrow('invalid assembled transaction response');
  });
});
