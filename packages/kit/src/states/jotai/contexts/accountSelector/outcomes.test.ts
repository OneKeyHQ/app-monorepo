import fs from 'fs';
import path from 'path';

import * as outcomes from './outcomes';

// The web e2e suite is plain JS and cannot import this module, so it asserts the
// outcome strings verbatim. Nothing else connects the two ends: renaming an enum
// value leaves the e2e filter matching nothing, and a filter that matches
// nothing passes. These tests are that missing link.
function collectEnumValues() {
  const values = new Set<string>();
  Object.values(outcomes).forEach((exported) => {
    if (typeof exported !== 'object' || exported === null) {
      return;
    }
    Object.values(exported as Record<string, unknown>).forEach((value) => {
      if (typeof value === 'string') {
        values.add(value);
      }
    });
  });
  return values;
}

function readAccountSelectorE2ESource() {
  const e2ePath = path.resolve(
    __dirname,
    '../../../../../../../apps/web/e2e/account-selector.e2e.js',
  );
  return fs.readFileSync(e2ePath, 'utf8');
}

describe('account selector outcome vocabularies', () => {
  it('keeps every value kebab-case so log filters stay predictable', () => {
    collectEnumValues().forEach((value) => {
      expect(value).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    });
  });

  it('covers every outcome the web e2e suite asserts on', () => {
    const source = readAccountSelectorE2ESource();
    const asserted = new Set<string>();
    const comparisons = source.matchAll(
      /outcome\s*(?:===|!==)\s*'([a-z][a-z0-9-]*)'/g,
    );
    for (const match of comparisons) {
      asserted.add(match[1]);
    }
    const membership = source.matchAll(
      /\[([^\]]*)\]\s*\.includes\(\s*(?:event|[a-zA-Z]+)\.outcome/g,
    );
    for (const match of membership) {
      for (const literal of match[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) {
        asserted.add(literal[1]);
      }
    }
    // typeof comparisons, and a status the harness tracks for itself rather than
    // reading it back from an app trace.
    asserted.delete('string');
    asserted.delete('pending');

    expect(asserted.size).toBeGreaterThan(0);
    const known = collectEnumValues();
    expect([...asserted].filter((value) => !known.has(value))).toEqual([]);
  });
});
