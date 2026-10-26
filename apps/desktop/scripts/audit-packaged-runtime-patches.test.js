const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  PATCH_ACTION,
  applyPackagedRuntimePatches,
} = require('./apply-runtime-patches');
const {
  PATCH_STATE,
  auditPackagedRuntimePatches,
} = require('./audit-packaged-runtime-patches');
const {
  findInstalledPackageInstances,
  groupPackageInstancesByName,
} = require('./packaged-runtime-patch-utils');

const ORIGINAL_CONTENT = 'module.exports = "original";\n';
const PATCHED_CONTENT = 'module.exports = "patched";\n';

function getPackagePathSegments(packageName) {
  return packageName.split('/');
}

function createFixture({
  contentLineEnding = '\n',
  nested = false,
  packageName = 'runtime-package',
  packageVersion = '1.0.0',
  patchVersion = packageVersion,
} = {}) {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'runtime-patch-audit-'),
  );
  childProcess.execFileSync('git', ['init', '-q'], { cwd: repositoryRoot });

  const patchesRoot = path.join(repositoryRoot, 'patches');
  const runtimeNodeModulesRoot = path.join(
    repositoryRoot,
    'apps/desktop/app/node_modules',
  );
  const packageRoot = path.join(
    runtimeNodeModulesRoot,
    ...(nested ? ['parent-package', 'node_modules'] : []),
    ...getPackagePathSegments(packageName),
  );
  fs.mkdirSync(packageRoot, { recursive: true });
  if (nested) {
    fs.writeFileSync(
      path.join(runtimeNodeModulesRoot, 'parent-package/package.json'),
      `${JSON.stringify({ name: 'parent-package', version: '1.0.0' })}\n`,
    );
  }
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({ name: packageName, version: packageVersion })}\n`,
  );
  fs.writeFileSync(
    path.join(packageRoot, 'index.js'),
    ORIGINAL_CONTENT.replaceAll('\n', contentLineEnding),
  );

  fs.mkdirSync(patchesRoot, { recursive: true });
  const patchPackagePath = `node_modules/${packageName}/index.js`;
  const patchFilePath = path.join(
    patchesRoot,
    `${packageName.replace('/', '+')}+${patchVersion}.patch`,
  );
  fs.writeFileSync(
    patchFilePath,
    `diff --git a/${patchPackagePath} b/${patchPackagePath}
--- a/${patchPackagePath}
+++ b/${patchPackagePath}
@@ -1 +1 @@
-${ORIGINAL_CONTENT.trimEnd()}
+${PATCHED_CONTENT.trimEnd()}
`,
  );

  return {
    cleanup() {
      fs.rmSync(repositoryRoot, { force: true, recursive: true });
    },
    packageRoot,
    patchesRoot,
    repositoryRoot,
    runtimeNodeModulesRoot,
  };
}

function runAudit(fixture) {
  return auditPackagedRuntimePatches({
    patchesRoot: fixture.patchesRoot,
    repositoryRoot: fixture.repositoryRoot,
    runtimeNodeModulesRoot: fixture.runtimeNodeModulesRoot,
  });
}

function runApply(fixture) {
  return applyPackagedRuntimePatches({
    patchesRoot: fixture.patchesRoot,
    repositoryRoot: fixture.repositoryRoot,
    runtimeNodeModulesRoot: fixture.runtimeNodeModulesRoot,
  });
}

function writePackageMetadata(packageRoot, name, version = '1.0.0') {
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({ name, version })}\n`,
  );
}

function readNormalizedText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n');
}

describe('packaged runtime patch audit', () => {
  test('dynamically applies a committed patch without a package allowlist', () => {
    const fixture = createFixture();
    try {
      const applySummary = runApply(fixture);
      const auditSummary = runAudit(fixture);

      expect(
        readNormalizedText(path.join(fixture.packageRoot, 'index.js')),
      ).toBe(PATCHED_CONTENT);
      expect(applySummary.results[0]).toMatchObject({
        action: PATCH_ACTION.applied,
        packageName: 'runtime-package',
      });
      expect(auditSummary.results[0].state).toBe(PATCH_STATE.patched);
    } finally {
      fixture.cleanup();
    }
  });

  test('does not reapply a complete runtime patch', () => {
    const fixture = createFixture();
    try {
      runApply(fixture);

      const summary = runApply(fixture);

      expect(summary.results[0].action).toBe(PATCH_ACTION.alreadyPatched);
      expect(
        readNormalizedText(path.join(fixture.packageRoot, 'index.js')),
      ).toBe(PATCHED_CONTENT);
    } finally {
      fixture.cleanup();
    }
  });

  test('applies and audits an LF patch against CRLF package content', () => {
    const fixture = createFixture({ contentLineEnding: '\r\n' });
    try {
      expect(
        fs.readFileSync(path.join(fixture.packageRoot, 'index.js'), 'utf8'),
      ).toBe(ORIGINAL_CONTENT.replaceAll('\n', '\r\n'));

      const applySummary = runApply(fixture);
      const auditSummary = runAudit(fixture);

      expect(applySummary.results[0].action).toBe(PATCH_ACTION.applied);
      expect(auditSummary.results[0].state).toBe(PATCH_STATE.patched);
      expect(
        readNormalizedText(path.join(fixture.packageRoot, 'index.js')),
      ).toBe(PATCHED_CONTENT);
    } finally {
      fixture.cleanup();
    }
  });

  test('rejects an unpatched packaged dependency', () => {
    const fixture = createFixture();
    try {
      expect(() => runAudit(fixture)).toThrow(
        /runtime-package@1\.0\.0.*is missing/s,
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('accepts a fully patched packaged dependency', () => {
    const fixture = createFixture();
    try {
      fs.writeFileSync(
        path.join(fixture.packageRoot, 'index.js'),
        PATCHED_CONTENT,
      );

      const summary = runAudit(fixture);

      expect(summary.packagedPatchCount).toBe(1);
      expect(summary.results[0]).toMatchObject({
        packageName: 'runtime-package',
        state: PATCH_STATE.patched,
        version: '1.0.0',
      });
    } finally {
      fixture.cleanup();
    }
  });

  test('rejects a partially patched or drifted dependency', () => {
    const fixture = createFixture();
    try {
      fs.writeFileSync(
        path.join(fixture.packageRoot, 'index.js'),
        'module.exports = "drifted";\n',
      );

      expect(() => runAudit(fixture)).toThrow(
        /partially patched or has drifted/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('rejects a packaged version that differs from the committed patch', () => {
    const fixture = createFixture({
      packageVersion: '2.0.0',
      patchVersion: '1.0.0',
    });
    try {
      expect(() => runAudit(fixture)).toThrow(
        /does not match committed patch version\(s\): 1\.0\.0/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('audits scoped packages nested under another dependency', () => {
    const fixture = createFixture({
      nested: true,
      packageName: '@scope/runtime-package',
    });
    try {
      const applySummary = runApply(fixture);

      const summary = runAudit(fixture);

      expect(applySummary.results[0].action).toBe(PATCH_ACTION.applied);
      expect(summary.results[0]).toMatchObject({
        packageName: '@scope/runtime-package',
        state: PATCH_STATE.patched,
      });
    } finally {
      fixture.cleanup();
    }
  });

  test('does not discover a workspace package above appDir node_modules', () => {
    const repositoryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'runtime-patch-scope-'),
    );
    try {
      const runtimeNodeModulesRoot = path.join(
        repositoryRoot,
        'apps/desktop/app/node_modules',
      );
      fs.mkdirSync(runtimeNodeModulesRoot, { recursive: true });
      writePackageMetadata(
        path.join(repositoryRoot, 'node_modules/runtime-package'),
        'runtime-package',
      );

      const instances = findInstalledPackageInstances(
        runtimeNodeModulesRoot,
        new Set(['runtime-package']),
      );

      expect(instances).toEqual([]);
    } finally {
      fs.rmSync(repositoryRoot, { force: true, recursive: true });
    }
  });

  test('rejects apply and audit when no packaged dependency matches a patch', () => {
    const fixture = createFixture();
    try {
      writePackageMetadata(fixture.packageRoot, 'unrelated-package');

      expect(() => runApply(fixture)).toThrow(
        /No packaged runtime dependencies.*match any committed patch/,
      );
      expect(() => runAudit(fixture)).toThrow(
        /No packaged runtime dependencies.*match any committed patch/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('rejects a packaged dependency symlink that resolves outside appDir', () => {
    const fixture = createFixture();
    try {
      const workspacePackageRoot = path.join(
        fixture.repositoryRoot,
        'node_modules/runtime-package',
      );
      writePackageMetadata(workspacePackageRoot, 'runtime-package');
      fs.writeFileSync(
        path.join(workspacePackageRoot, 'index.js'),
        ORIGINAL_CONTENT,
      );
      fs.rmSync(fixture.packageRoot, { force: true, recursive: true });
      fs.symlinkSync(
        workspacePackageRoot,
        fixture.packageRoot,
        process.platform === 'win32' ? 'junction' : 'dir',
      );

      expect(() => runApply(fixture)).toThrow(
        /Installed package resolves outside runtime node_modules/,
      );
      expect(() => runAudit(fixture)).toThrow(
        /Installed package resolves outside runtime node_modules/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('discovers and groups every top-level and nested runtime instance', () => {
    const repositoryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'runtime-patch-instances-'),
    );
    try {
      const runtimeNodeModulesRoot = path.join(
        repositoryRoot,
        'apps/desktop/app/node_modules',
      );
      writePackageMetadata(
        path.join(runtimeNodeModulesRoot, 'runtime-package'),
        'runtime-package',
      );
      writePackageMetadata(
        path.join(runtimeNodeModulesRoot, 'parent-package'),
        'parent-package',
      );
      writePackageMetadata(
        path.join(
          runtimeNodeModulesRoot,
          'parent-package/node_modules/runtime-package',
        ),
        'runtime-package',
      );

      const instances = findInstalledPackageInstances(
        runtimeNodeModulesRoot,
        new Set(['runtime-package']),
      );
      const instancesByName = groupPackageInstancesByName(instances);

      expect(instancesByName.get('runtime-package')).toHaveLength(2);
    } finally {
      fs.rmSync(repositoryRoot, { force: true, recursive: true });
    }
  });

  test('applies a committed patch to every top-level and nested instance', () => {
    const fixture = createFixture();
    try {
      const nestedPackageRoot = path.join(
        fixture.runtimeNodeModulesRoot,
        'parent-package/node_modules/runtime-package',
      );
      writePackageMetadata(
        path.join(fixture.runtimeNodeModulesRoot, 'parent-package'),
        'parent-package',
      );
      writePackageMetadata(nestedPackageRoot, 'runtime-package');
      fs.writeFileSync(
        path.join(nestedPackageRoot, 'index.js'),
        ORIGINAL_CONTENT,
      );

      const applySummary = runApply(fixture);
      const auditSummary = runAudit(fixture);

      expect(applySummary.results).toHaveLength(2);
      expect(
        applySummary.results.every(
          (result) => result.action === PATCH_ACTION.applied,
        ),
      ).toBe(true);
      expect(readNormalizedText(path.join(nestedPackageRoot, 'index.js'))).toBe(
        PATCHED_CONTENT,
      );
      expect(auditSummary.packagedPatchCount).toBe(2);
    } finally {
      fixture.cleanup();
    }
  });
});
