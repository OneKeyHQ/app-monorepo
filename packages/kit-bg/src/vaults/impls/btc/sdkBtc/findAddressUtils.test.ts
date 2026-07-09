import { BTC_FIND_ADDRESS_HISTORY_MAX_PATHS } from '@onekeyhq/shared/src/consts/chainConsts';

import {
  appendClaimedAddressPaths,
  buildBtcSendUtxoPool,
  buildFindAddressPathsParam,
  mergeClaimedUtxos,
} from './findAddressUtils';

import type { IUtxoInfo } from '../../../types';

function buildUtxo(overrides: Partial<IUtxoInfo>): IUtxoInfo {
  return {
    txid: 'tx0',
    vout: 0,
    value: '1000',
    height: 100,
    confirmations: 10,
    address: 'bc1q-normal',
    path: "m/84'/0'/0'/0/0",
    globalIndex: 0,
    prevOutPubkey: '',
    txPubkey: '',
    ...overrides,
  };
}

const normalUtxo = buildUtxo({ txid: 'tx-normal', vout: 0 });
const claimedUtxo = buildUtxo({
  txid: 'tx-claimed',
  vout: 1,
  address: 'bc1q-claimed',
  path: "m/84'/0'/0'/0/100",
  isCustomClaimed: true,
});

describe('buildBtcSendUtxoPool', () => {
  test('send without coin-control selection NEVER includes claimed UTXOs', () => {
    const pool = buildBtcSendUtxoPool({
      poolUtxos: [normalUtxo],
      claimedUtxos: [claimedUtxo],
      selectedUtxoKeys: undefined,
    });
    expect(pool).toEqual([normalUtxo]);

    const poolEmptySelection = buildBtcSendUtxoPool({
      poolUtxos: [normalUtxo],
      claimedUtxos: [claimedUtxo],
      selectedUtxoKeys: [],
    });
    expect(poolEmptySelection).toEqual([normalUtxo]);
  });

  test('send without selection drops claimed UTXOs even if injected into the pool (defense in depth)', () => {
    const pool = buildBtcSendUtxoPool({
      poolUtxos: [normalUtxo, claimedUtxo],
      claimedUtxos: [],
      selectedUtxoKeys: undefined,
    });
    expect(pool).toEqual([normalUtxo]);
  });

  test('send with explicit selection merges claimed UTXOs into the pool', () => {
    const pool = buildBtcSendUtxoPool({
      poolUtxos: [normalUtxo],
      claimedUtxos: [claimedUtxo],
      selectedUtxoKeys: ['tx-claimed:1'],
    });
    expect(pool).toEqual([normalUtxo, claimedUtxo]);
  });
});

describe('appendClaimedAddressPaths', () => {
  test('adds claimed paths without overriding pool-resolved entries', () => {
    const addressPathMap: Record<string, string> = {
      'bc1q-pool': "m/84'/0'/0'/0/1",
    };
    appendClaimedAddressPaths({
      addressPathMap,
      accountPath: "m/84'/0'/0'",
      findAddresses: { '0/1': 'bc1q-pool', '0/100': 'bc1q-claimed' },
    });
    expect(addressPathMap).toEqual({
      'bc1q-pool': "m/84'/0'/0'/0/1",
      'bc1q-claimed': "m/84'/0'/0'/0/100",
    });
  });

  test('honors the address filter and tolerates missing findAddresses', () => {
    const addressPathMap: Record<string, string> = {};
    appendClaimedAddressPaths({
      addressPathMap,
      accountPath: "m/84'/0'/0'",
      findAddresses: { '0/100': 'bc1q-claimed', '0/101': 'bc1q-other' },
      filterAddresses: (address) => address === 'bc1q-claimed',
    });
    expect(addressPathMap).toEqual({ 'bc1q-claimed': "m/84'/0'/0'/0/100" });

    expect(
      appendClaimedAddressPaths({
        addressPathMap: {},
        accountPath: "m/84'/0'/0'",
        findAddresses: undefined,
      }),
    ).toEqual({});
  });
});

describe('buildFindAddressPathsParam', () => {
  test('returns undefined when no claimed addresses exist', () => {
    expect(
      buildFindAddressPathsParam({ findAddresses: undefined }),
    ).toBeUndefined();
    expect(buildFindAddressPathsParam({ findAddresses: {} })).toBeUndefined();
  });

  test('joins relPaths sorted by numeric index', () => {
    expect(
      buildFindAddressPathsParam({
        findAddresses: {
          '0/100': 'bc1q-a',
          '0/21': 'bc1q-b',
          '0/3000': 'bc1q-c',
        },
      }),
    ).toBe('0/21,0/100,0/3000');
  });

  test('drops malformed relPaths and returns undefined if none remain', () => {
    expect(
      buildFindAddressPathsParam({
        findAddresses: { '1/5': 'bc1q-x', 'abc': 'bc1q-y', '0/12x': 'bc1q-z' },
      }),
    ).toBeUndefined();
    expect(
      buildFindAddressPathsParam({
        findAddresses: { '1/5': 'bc1q-x', '0/100': 'bc1q-a' },
      }),
    ).toBe('0/100');
  });

  test('caps the list keeping the lowest indexes', () => {
    const findAddresses: Record<string, string> = {};
    for (let i = 0; i < BTC_FIND_ADDRESS_HISTORY_MAX_PATHS + 1; i += 1) {
      findAddresses[`0/${i + 21}`] = `bc1q-${i}`;
    }
    const result = buildFindAddressPathsParam({ findAddresses });
    const paths = result?.split(',') ?? [];
    expect(paths).toHaveLength(BTC_FIND_ADDRESS_HISTORY_MAX_PATHS);
    expect(paths[0]).toBe('0/21');
    expect(paths[paths.length - 1]).toBe(
      `0/${BTC_FIND_ADDRESS_HISTORY_MAX_PATHS + 20}`,
    );
  });
});

describe('mergeClaimedUtxos', () => {
  test('dedupes by txid:vout and prefers the gap-scanned entry', () => {
    // a claimed address later discovered by the gap scan appears in BOTH
    // lists, the merged pool must not contain the UTXO twice
    const discoveredTwin = buildUtxo({
      txid: 'tx-claimed',
      vout: 1,
      address: 'bc1q-claimed',
    });
    const merged = mergeClaimedUtxos({
      poolUtxos: [normalUtxo, discoveredTwin],
      claimedUtxos: [claimedUtxo],
    });
    expect(merged).toEqual([normalUtxo, discoveredTwin]);
  });

  test('returns the pool untouched when no claimed UTXOs exist', () => {
    const poolUtxos = [normalUtxo];
    expect(mergeClaimedUtxos({ poolUtxos, claimedUtxos: [] })).toBe(poolUtxos);
  });
});
