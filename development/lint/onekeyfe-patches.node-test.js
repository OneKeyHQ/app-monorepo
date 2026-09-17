/* cspell:words podspec */
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findOneKeyNativePatchViolations,
  indexLockfilePackages,
} = require('./onekeyfe-patches');

const LOCKFILE_SOURCE = `
__metadata:
  version: 8
  cacheKey: 10

"@onekeyfe/react-native-tab-view@npm:3.0.140":
  version: 3.0.140
  resolution: "@onekeyfe/react-native-tab-view@npm:3.0.140"
  languageName: node
  linkType: hard

"bitcoinjs-lib@npm:@onekeyfe/bitcoinjs-lib@7.0.1":
  version: 7.0.1
  resolution: "@onekeyfe/bitcoinjs-lib@npm:7.0.1"
  languageName: node
  linkType: hard

"bitcoinjs-lib@npm:^6.1.0, bitcoinjs-lib@npm:^6.1.7":
  version: 6.1.7
  resolution: "bitcoinjs-lib@npm:6.1.7"
  languageName: node
  linkType: hard

"react-native-pager-view@npm:@onekeyfe/react-native-pager-view@3.0.140":
  version: 3.0.140
  resolution: "@onekeyfe/react-native-pager-view@npm:3.0.140"
  languageName: node
  linkType: hard

"react-native-screens@npm:4.26.0":
  version: 4.26.0
  resolution: "react-native-screens@npm:4.26.0"
  languageName: node
  linkType: hard
`;

function createPatch(...filePaths) {
  return filePaths
    .map(
      (filePath) => `diff --git a/${filePath} b/${filePath}
index 565d4ab..9503f4b 100644
--- a/${filePath}
+++ b/${filePath}
@@ -1,1 +1,1 @@
-const before = true;
+const after = true;
`,
    )
    .join('');
}

function findViolations(patches) {
  return findOneKeyNativePatchViolations({
    lockfileSource: LOCKFILE_SOURCE,
    patches: Object.entries(patches).map(([fileName, source]) => ({
      fileName,
      source,
    })),
  });
}

test('indexes npm aliases and multi-descriptor lockfile entries', () => {
  const index = indexLockfilePackages(LOCKFILE_SOURCE);

  assert.deepEqual(index.get('react-native-pager-view'), [
    { resolvedName: '@onekeyfe/react-native-pager-view', version: '3.0.140' },
  ]);
  assert.deepEqual(index.get('bitcoinjs-lib'), [
    { resolvedName: '@onekeyfe/bitcoinjs-lib', version: '7.0.1' },
    { resolvedName: 'bitcoinjs-lib', version: '6.1.7' },
  ]);
  assert.equal(index.has('__metadata'), false);
});

test('allows JS and TS changes in @onekeyfe packages', () => {
  const root = 'node_modules/@onekeyfe/react-native-tab-view';

  assert.deepEqual(
    findViolations({
      '@onekeyfe+react-native-tab-view+3.0.140.patch': createPatch(
        `${root}/lib/commonjs/index.js`,
        `${root}/lib/module/index.mjs`,
        `${root}/lib/module/legacy.cjs`,
        `${root}/lib/typescript/src/index.d.ts`,
        `${root}/src/TabView.tsx`,
        `${root}/src/TabViewItem.jsx`,
        `${root}/src/utils.ts`,
      ),
    }),
    [],
  );
});

test('rejects native code and native build files in @onekeyfe packages', () => {
  const root = 'node_modules/@onekeyfe/react-native-tab-view';
  const nativeFiles = [
    `${root}/android/build.gradle`,
    `${root}/android/src/main/cpp/cpp-adapter.cpp`,
    `${root}/android/src/main/java/com/tabview/TabView.java`,
    `${root}/android/src/main/java/com/tabview/TabView.kt`,
    `${root}/ios/TabView.h`,
    `${root}/ios/TabView.m`,
    `${root}/ios/TabView.mm`,
    `${root}/ios/TabView.swift`,
    `${root}/nitrogen/generated/shared/c++/HybridTabViewSpec.hpp`,
    `${root}/react-native-tab-view.podspec`,
  ];

  assert.deepEqual(
    findViolations({
      '@onekeyfe+react-native-tab-view+3.0.140.patch': createPatch(
        `${root}/src/TabView.tsx`,
        ...nativeFiles,
      ),
    }),
    [
      {
        filePaths: nativeFiles,
        installedName: '@onekeyfe/react-native-tab-view',
        packageName: '@onekeyfe/react-native-tab-view',
        patchFileName: '@onekeyfe+react-native-tab-view+3.0.140.patch',
      },
    ],
  );
});

test('resolves npm aliases that install @onekeyfe packages under another name', () => {
  const nativeFile =
    'node_modules/react-native-pager-view/android/src/main/java/com/reactnativepagerview/PagerView.kt';

  assert.deepEqual(
    findViolations({
      'react-native-pager-view+3.0.140.patch': createPatch(
        'node_modules/react-native-pager-view/src/PagerView.tsx',
        nativeFile,
      ),
    }),
    [
      {
        filePaths: [nativeFile],
        installedName: 'react-native-pager-view',
        packageName: '@onekeyfe/react-native-pager-view',
        patchFileName: 'react-native-pager-view+3.0.140.patch',
      },
    ],
  );
});

test('uses the patched version to tell aliases from third-party packages', () => {
  const patchSource = createPatch(
    'node_modules/bitcoinjs-lib/src/native/binding.cpp',
  );

  assert.deepEqual(
    findViolations({ 'bitcoinjs-lib+6.1.7.patch': patchSource }),
    [],
  );
  assert.deepEqual(
    findViolations({ 'bitcoinjs-lib+7.0.1.patch': patchSource }).map(
      ({ packageName }) => packageName,
    ),
    ['@onekeyfe/bitcoinjs-lib'],
  );
});

test('ignores native changes in third-party packages', () => {
  assert.deepEqual(
    findViolations({
      'react-native-screens+4.26.0.patch': createPatch(
        'node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/Screen.kt',
        'node_modules/react-native-screens/ios/RNSScreen.mm',
      ),
    }),
    [],
  );
});

test('handles nested, sequenced, and dev-only patch file names', () => {
  const nestedFile =
    'node_modules/some-parent/node_modules/react-native-pager-view/ios/PagerView.mm';
  const sequencedFile =
    'node_modules/@onekeyfe/react-native-tab-view/ios/TabView.swift';

  assert.deepEqual(
    findViolations({
      '@onekeyfe+react-native-tab-view+3.0.140+001+initial.dev.patch':
        createPatch(sequencedFile),
      'some-parent+1.0.0++react-native-pager-view+3.0.140.patch':
        createPatch(nestedFile),
    }).map(({ filePaths, patchFileName }) => [patchFileName, filePaths]),
    [
      [
        '@onekeyfe+react-native-tab-view+3.0.140+001+initial.dev.patch',
        [sequencedFile],
      ],
      [
        'some-parent+1.0.0++react-native-pager-view+3.0.140.patch',
        [nestedFile],
      ],
    ],
  );
});

test('checks both sides of renamed files', () => {
  const root = 'node_modules/@onekeyfe/react-native-tab-view';

  assert.deepEqual(
    findViolations({
      '@onekeyfe+react-native-tab-view+3.0.140.patch': `diff --git a/${root}/ios/TabView.swift b/${root}/src/TabView.ts
similarity index 100%
rename from ${root}/ios/TabView.swift
rename to ${root}/src/TabView.ts
`,
    }).map(({ filePaths }) => filePaths),
    [[`${root}/ios/TabView.swift`]],
  );
});
