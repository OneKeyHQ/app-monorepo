const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
  fs.writeFileSync(path.join(packageRoot, 'index.js'), ORIGINAL_CONTENT);

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

function writePackageMetadata(packageRoot, name, version = '1.0.0') {
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({ name, version })}\n`,
  );
}

describe('packaged runtime patch audit', () => {
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
      fs.writeFileSync(
        path.join(fixture.packageRoot, 'index.js'),
        PATCHED_CONTENT,
      );

      const summary = runAudit(fixture);

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
});
