import fs from 'node:fs';
import path from 'node:path';

import { loadBip39Fixtures } from '../__test-utils__/bip39-fixtures';

const SRC_ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(SRC_ROOT, '__test-utils__/fixtures');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(filePath);
    }
    return [filePath];
  });
}

function isTestSource(filePath: string): boolean {
  if (!/\.(ts|tsx)$/u.test(filePath)) {
    return false;
  }
  if (filePath.startsWith(FIXTURE_DIR)) {
    return false;
  }
  return (
    filePath.includes(`${path.sep}__tests__${path.sep}`) ||
    filePath.includes(`${path.sep}__test-utils__${path.sep}`)
  );
}

function normalizeSource(source: string): string {
  return source.replace(/\s+/gu, ' ');
}

function getDisallowedMnemonicPhrases(): string[] {
  const commonTwelveWordTestMnemonic = [
    ...Array.from({ length: 11 }, () => 'test'),
    'junk',
  ].join(' ');
  return [
    ...loadBip39Fixtures().map((fixture) => fixture.mnemonic),
    commonTwelveWordTestMnemonic,
  ];
}

describe('BIP-39 test fixture isolation', () => {
  it('keeps real mnemonic phrases out of TypeScript test source', () => {
    const phrases = getDisallowedMnemonicPhrases();
    const hits = walk(SRC_ROOT)
      .filter(isTestSource)
      .flatMap((filePath) => {
        const normalizedSource = normalizeSource(
          fs.readFileSync(filePath, 'utf8'),
        );
        return phrases
          .filter((phrase) => normalizedSource.includes(phrase))
          .map((phrase) => ({
            filePath: path.relative(SRC_ROOT, filePath),
            phrase,
          }));
      });

    expect(hits).toEqual([]);
  });
});
