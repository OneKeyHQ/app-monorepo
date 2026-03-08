// Snapshot matcher registration for react-native-harness.
// Collects {key, received} pairs on-device for host-side comparison
// since the device has no filesystem access to .snap files.

import { format as prettyFormat } from 'pretty-format';
import { expect } from 'react-native-harness';

import { resetDescribeStack } from './jest-compat';

const snapshotCounts = new Map<string, number>();
const collectedSnapshots: Array<{ key: string; received: unknown }> = [];

(globalThis as any).__harness_collected_snapshots__ = collectedSnapshots;
(globalThis as any).__harness_reset_snapshots__ = () => {
  resetDescribeStack();
  snapshotCounts.clear();
  collectedSnapshots.length = 0;
};

expect.extend({
  toMatchSnapshot(received: unknown, snapshotName?: string) {
    const currentTestName =
      (globalThis as any).__harness_current_test_name__ || 'unknown test';

    // Build key: "{testName}: {hint} {count}" or "{testName} {count}"
    const baseName = snapshotName
      ? `${currentTestName}: ${snapshotName}`
      : currentTestName;

    const count = (snapshotCounts.get(baseName) || 0) + 1;
    snapshotCounts.set(baseName, count);

    const key = `${baseName} ${count}`;
    collectedSnapshots.push({ key, received });

    // Always pass on device — host will do the real comparison
    return {
      pass: true,
      message: () => `Snapshot "${key}" collected for host-side comparison`,
    };
  },
  toMatchInlineSnapshot(received: unknown, inlineSnapshot?: string) {
    if (inlineSnapshot !== undefined) {
      const receivedStr = prettyFormat(received);
      const pass = receivedStr === inlineSnapshot.trim();
      if (pass) {
        // Count inline matches so host snapshot stats stay in sync with Jest
        collectedSnapshots.push({
          key: '__inline_matched__',
          received: '__inline_matched__',
        });
      }
      return {
        pass,
        message: () =>
          `Expected inline snapshot to match.\n` +
          `Received: ${receivedStr}\nExpected: ${inlineSnapshot.trim()}`,
      };
    }
    // No inline value provided — in real Jest this writes the value back
    // into the source file. The harness cannot do that, so fail loudly
    // instead of silently passing without any comparison.
    return {
      pass: false,
      message: () =>
        `toMatchInlineSnapshot() called without an inline snapshot value. ` +
        `The harness cannot write snapshots back to source files. ` +
        `Run this test in Jest first to generate the inline snapshot, ` +
        `then re-run in the harness.`,
    };
  },
});
