import { serializeSnapshot } from '@onekeyfe/react-native-native-list';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertToSectionGroups } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { selectVisibleHistoryRows } from '../pages/hooks/historyTopFreezeUtils';

import {
  historySectionKey,
  prepareHomeNativeListSnapshot,
} from './homeNativeListSnapshot';

import type {
  ActivityRow,
  MediaTileRow,
  NativeListSnapshot,
} from '@onekeyfe/react-native-native-list';

jest.mock('@onekeyfe/react-native-native-list', () => {
  const { execFileSync } =
    jest.requireActual<typeof import('node:child_process')>(
      'node:child_process',
    );
  const { createRequire } =
    jest.requireActual<typeof import('node:module')>('node:module');
  const path = jest.requireActual<typeof import('node:path')>('node:path');
  const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));
  const packageDir = path.dirname(
    nodeRequire.resolve('@onekeyfe/react-native-native-list/package.json'),
  );
  const validatorPath = path.join(packageDir, 'lib/module/validation.js');
  const script = `
    const { pathToFileURL } = await import('node:url');
    const validator = await import(pathToFileURL(process.argv[1]).href);
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    try {
      const value = validator[process.argv[2]](JSON.parse(input));
      process.stdout.write(JSON.stringify({ ok: true, value }));
    } catch (error) {
      process.stdout.write(JSON.stringify({ ok: false, error: String(error) }));
    }
  `;
  // Jest cannot parse the package's ESM entry; Node executes its installed
  // validator so these tests still exercise the real snapshot contract.
  const runValidator = (method: string, snapshot: NativeListSnapshot) => {
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', script, validatorPath, method],
      { input: JSON.stringify(snapshot), encoding: 'utf8' },
    );
    const result = JSON.parse(output) as {
      ok: boolean;
      value?: unknown;
      error?: string;
    };
    if (!result.ok)
      throw new OneKeyLocalError(
        result.error ?? 'NativeList validation failed',
      );
    return result.value;
  };
  return {
    validateSnapshot: (snapshot: NativeListSnapshot) =>
      runValidator('validateSnapshot', snapshot),
    serializeSnapshot: (snapshot: NativeListSnapshot) =>
      runValidator('serializeSnapshot', snapshot),
  };
});

function history(id: string, day: number): IAccountHistoryTx {
  return {
    id,
    decodedTx: {
      status: EDecodedTxStatus.Confirmed,
      updatedAt: Date.UTC(2026, 8, day),
    },
  } as IAccountHistoryTx;
}

function activity(key: string, title: string): ActivityRow {
  return {
    key,
    type: 'activity',
    leading: { kind: 'icon', name: 'Document2Outline' },
    title,
  };
}

describe('Home NativeList snapshot boundaries', () => {
  it('serializes non-adjacent date groups after frozen rows receive newer dates', () => {
    const displayed = [
      history('a', 4),
      history('b', 3),
      history('c', 2),
      history('d', 1),
    ];
    const visible = selectVisibleHistoryRows({
      combined: [
        history('a', 4),
        history('b', 3),
        history('d', 3),
        history('c', 2),
      ],
      displayed,
      isAwayFromTop: true,
      enabled: true,
    });
    expect(visible.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
    const sections = convertToSectionGroups({
      items: visible,
      formatDate: (date) => new Date(date).toISOString().slice(0, 10),
    });
    expect(sections[1].title).toBe(sections[3].title);
    const rows = sections.flatMap((section) => {
      const sectionKey = historySectionKey(section.data[0].id);
      return [
        {
          type: 'sectionHeader' as const,
          key: sectionKey,
          sectionKey,
          title: section.title ?? '',
        },
        ...section.data.map((item) => ({
          ...activity(item.id, item.id),
          sectionKey,
        })),
      ];
    });
    const snapshot: NativeListSnapshot = {
      schemaVersion: 1,
      generation: 1,
      layout: { kind: 'sectioned' },
      rows,
    };
    expect(() =>
      serializeSnapshot(prepareHomeNativeListSnapshot(snapshot)),
    ).not.toThrow();
    expect(rows.map((row) => row.key)).toEqual([
      'section:a',
      'a',
      'section:b',
      'b',
      'section:c',
      'c',
      'section:d',
      'd',
    ]);
  });

  it('bounds external history text and keeps normal activity rows serializable', () => {
    const snapshot: NativeListSnapshot = {
      schemaVersion: 1,
      generation: 1,
      layout: { kind: 'sectioned' },
      rows: [
        {
          ...activity('long', `${'x'.repeat(4095)}🚀`),
          description: 'y'.repeat(4097),
          amounts: [{ key: 'amount', text: 'z'.repeat(4097) }],
        },
        activity('normal', 'Normal'),
      ],
    };
    const prepared = prepareHomeNativeListSnapshot(snapshot);
    expect(() => serializeSnapshot(prepared)).not.toThrow();
    expect(prepared.rows).toHaveLength(2);
    expect(
      prepared.rows[0].type === 'activity' && prepared.rows[0].title,
    ).toHaveLength(4095);
    expect(prepared.rows[1]).toMatchObject({ key: 'normal', title: 'Normal' });
  });

  it('drops a malformed activity while preserving its valid peer', () => {
    const snapshot: NativeListSnapshot = {
      schemaVersion: 1,
      generation: 1,
      layout: { kind: 'sectioned' },
      rows: [
        {
          ...activity('bad', 'Bad'),
          leading: {
            kind: 'token',
            image: { uri: '', width: 40, height: 40 },
          },
        },
        activity('normal', 'Normal'),
      ],
    };
    const prepared = prepareHomeNativeListSnapshot(snapshot);
    expect(prepared.rows.map((row) => row.key)).toEqual(['normal']);
    expect(() => serializeSnapshot(prepared)).not.toThrow();
  });

  it('bounds NFT names and collection names before serializing mixed tiles', () => {
    const longTile: MediaTileRow = {
      key: 'nft-long',
      type: 'mediaTile',
      variant: 'gallery',
      imageState: 'error',
      title: 'n'.repeat(4097),
      subtitle: 'c'.repeat(4097),
    };
    const snapshot: NativeListSnapshot = {
      schemaVersion: 1,
      generation: 1,
      layout: { kind: 'grid', gridColumns: 2 },
      rows: [longTile, { ...longTile, key: 'nft-normal', title: 'Normal' }],
    };
    const prepared = prepareHomeNativeListSnapshot(snapshot);
    expect(() => serializeSnapshot(prepared)).not.toThrow();
    expect(prepared.rows).toHaveLength(2);
    expect(
      prepared.rows[0].type === 'mediaTile' && prepared.rows[0].title,
    ).toHaveLength(4096);
    expect(
      prepared.rows[0].type === 'mediaTile' && prepared.rows[0].subtitle,
    ).toHaveLength(4096);
  });
});
