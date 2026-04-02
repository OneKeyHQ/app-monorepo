import { parseFullLockfile, parseLockfileDiff } from '../parseLockfileDiff';

// --- parseLockfileDiff ---

describe('parseLockfileDiff', () => {
  test('extracts a simple added package', () => {
    const diff = `
+++ b/yarn.lock
+"lodash@npm:4.17.21":
+  version: 4.17.21
+  resolution: "lodash@npm:4.17.21"
`;
    const result = parseLockfileDiff(diff);
    expect(result).toEqual([{ name: 'lodash', version: '4.17.21' }]);
  });

  test('extracts scoped packages', () => {
    const diff = `
+++ b/yarn.lock
+"@babel/core@npm:7.24.0":
+  version: 7.24.0
`;
    const result = parseLockfileDiff(diff);
    expect(result).toEqual([{ name: '@babel/core', version: '7.24.0' }]);
  });

  test('ignores removed lines (starting with -)', () => {
    const diff = `
--- a/yarn.lock
-"lodash@npm:4.17.20":
-  version: 4.17.20
+"lodash@npm:4.17.21":
+  version: 4.17.21
`;
    const result = parseLockfileDiff(diff);
    expect(result).toEqual([{ name: 'lodash', version: '4.17.21' }]);
  });

  test('deduplicates packages appearing multiple times', () => {
    const diff = `
+"lodash@npm:4.17.21":
+  version: 4.17.21
+"lodash@npm:4.17.21":
+  version: 4.17.21
`;
    const result = parseLockfileDiff(diff);
    expect(result).toEqual([{ name: 'lodash', version: '4.17.21' }]);
  });

  test('extracts multiple different packages', () => {
    const diff = `
+"lodash@npm:4.17.21":
+  version: 4.17.21
+"react@npm:18.2.0":
+  version: 18.2.0
+"@babel/core@npm:7.24.0":
+  version: 7.24.0
`;
    const result = parseLockfileDiff(diff);
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ name: 'lodash', version: '4.17.21' });
    expect(result).toContainEqual({ name: 'react', version: '18.2.0' });
    expect(result).toContainEqual({ name: '@babel/core', version: '7.24.0' });
  });

  test('handles version with pre-release suffix', () => {
    const diff = `
+"typescript@npm:5.4.0-beta.1":
+  version: 5.4.0-beta.1
`;
    const result = parseLockfileDiff(diff);
    expect(result).toEqual([{ name: 'typescript', version: '5.4.0-beta.1' }]);
  });

  test('returns empty array for empty diff', () => {
    expect(parseLockfileDiff('')).toEqual([]);
  });

  test('returns empty array for diff with no added packages', () => {
    const diff = `
--- a/yarn.lock
+++ b/yarn.lock
@@ -1,3 +1,3 @@
 __metadata:
   version: 8
-  cacheKey: 9
+  cacheKey: 10
`;
    expect(parseLockfileDiff(diff)).toEqual([]);
  });

  test('handles multi-descriptor entries (comma-separated)', () => {
    // Yarn Berry may list multiple version ranges in a single entry
    const diff = `
+"@babel/core@npm:7.24.0, @babel/core@npm:^7.0.0":
+  version: 7.24.0
`;
    const result = parseLockfileDiff(diff);
    // Should extract from the first match in the line
    expect(result).toEqual([{ name: '@babel/core', version: '7.24.0' }]);
  });

  test('handles realistic yarn.lock diff snippet', () => {
    const diff = `
diff --git a/yarn.lock b/yarn.lock
index abc1234..def5678 100644
--- a/yarn.lock
+++ b/yarn.lock
@@ -100,6 +100,15 @@
 "existing-pkg@npm:1.0.0":
   version: 1.0.0

+"new-scoped@npm:2.0.0":
+  version: 2.0.0
+  resolution: "new-scoped@npm:2.0.0"
+  checksum: 10/abc123
+  languageName: node
+  linkType: hard
+
+"@scope/new-pkg@npm:0.5.3":
+  version: 0.5.3
+  resolution: "@scope/new-pkg@npm:0.5.3"
+  checksum: 10-def456
+  languageName: node
+  linkType: hard
`;
    const result = parseLockfileDiff(diff);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ name: 'new-scoped', version: '2.0.0' });
    expect(result).toContainEqual({ name: '@scope/new-pkg', version: '0.5.3' });
  });
});

// --- parseFullLockfile ---

describe('parseFullLockfile', () => {
  test('extracts packages from full lockfile content', () => {
    const content = `
__metadata:
  version: 8
  cacheKey: 10

"lodash@npm:^4.17.0":
  version: 4.17.21
  resolution: "lodash@npm:4.17.21"
  checksum: 10-abc123
  languageName: node
  linkType: hard

"@babel/core@npm:^7.0.0, @babel/core@npm:^7.20.0":
  version: 7.24.0
  resolution: "@babel/core@npm:7.24.0"
  checksum: 10-def456
  languageName: node
  linkType: hard
`;
    const result = parseFullLockfile(content);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ name: 'lodash', version: '4.17.21' });
    expect(result).toContainEqual({ name: '@babel/core', version: '7.24.0' });
  });

  test('deduplicates packages with same resolved version', () => {
    const content = `
"lodash@npm:^4.17.0":
  version: 4.17.21

"lodash@npm:^4.0.0":
  version: 4.17.21
`;
    const result = parseFullLockfile(content);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'lodash', version: '4.17.21' });
  });

  test('returns empty array for empty content', () => {
    expect(parseFullLockfile('')).toEqual([]);
  });

  test('handles lockfile with metadata only', () => {
    const content = `
__metadata:
  version: 8
  cacheKey: 10
`;
    expect(parseFullLockfile(content)).toEqual([]);
  });
});
