const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const {
  findInstalledPackageInstances,
  resolvePathInside,
} = require('./packaged-runtime-patch-utils');

const PATCH_STATE = {
  drifted: 'DRIFTED',
  patched: 'PATCHED',
  unpatched: 'UNPATCHED',
};

function getPackageNameFromPatchPath(patchPath) {
  const pathSegments = patchPath.split('/');
  const nodeModulesIndex = pathSegments.lastIndexOf('node_modules');
  const firstPackageSegment = pathSegments[nodeModulesIndex + 1];
  assert(
    nodeModulesIndex >= 0 && firstPackageSegment,
    `Patch path is not inside node_modules: ${patchPath}`,
  );
  if (!firstPackageSegment.startsWith('@')) {
    return firstPackageSegment;
  }
  const secondPackageSegment = pathSegments[nodeModulesIndex + 2];
  assert(
    secondPackageSegment,
    `Scoped package path is incomplete: ${patchPath}`,
  );
  return `${firstPackageSegment}/${secondPackageSegment}`;
}

function parsePatchDescriptor(patchFilePath) {
  const patchContent = fs.readFileSync(patchFilePath, 'utf8');
  const packageNames = new Set();
  const diffHeaderPattern = /^diff --git a\/(\S+) b\/\S+$/gm;
  for (const match of patchContent.matchAll(diffHeaderPattern)) {
    packageNames.add(getPackageNameFromPatchPath(match[1]));
  }
  assert(
    packageNames.size === 1,
    `Expected one patched package in ${patchFilePath}, found: ${
      packageNames.size ? [...packageNames].join(', ') : 'none'
    }.`,
  );

  const patchFileName = path.basename(patchFilePath, '.patch');
  const versionSeparatorIndex = patchFileName.lastIndexOf('+');
  assert(
    versionSeparatorIndex > 0,
    `Cannot parse patch version from ${patchFilePath}.`,
  );

  return {
    packageName: [...packageNames][0],
    patchFilePath,
    version: patchFileName.slice(versionSeparatorIndex + 1),
  };
}

function normalizeGitPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function runGitApply({
  check = false,
  packageName,
  packageRoot,
  patchFilePath,
  repositoryRoot,
  reverse = false,
  runtimeNodeModulesRoot,
}) {
  const safePackageRoot = resolvePathInside(
    runtimeNodeModulesRoot,
    packageRoot,
    'Packaged dependency',
  );
  const realRepositoryRoot = fs.realpathSync(repositoryRoot);
  const relativePackageRoot = path.relative(
    realRepositoryRoot,
    safePackageRoot,
  );
  assert(
    relativePackageRoot &&
      relativePackageRoot !== '..' &&
      !relativePackageRoot.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePackageRoot),
    `Packaged dependency is outside the repository: ${safePackageRoot}.`,
  );

  const stripCount = packageName.startsWith('@') ? 4 : 3;
  const args = [
    'apply',
    ...(reverse ? ['--reverse'] : []),
    ...(check ? ['--check'] : []),
    '--ignore-space-change',
    `-p${stripCount}`,
    `--directory=${normalizeGitPath(relativePackageRoot)}`,
    patchFilePath,
  ];
  const result = childProcess.spawnSync('git', args, {
    cwd: realRepositoryRoot,
    encoding: 'utf8',
  });
  return {
    error: result.error,
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

function runGitApplyCheck(options) {
  return runGitApply({ ...options, check: true });
}

function classifyPatchState(options) {
  const reverseResult = runGitApplyCheck({ ...options, reverse: true });
  if (reverseResult.error) {
    throw reverseResult.error;
  }
  if (reverseResult.ok) {
    return { state: PATCH_STATE.patched };
  }

  const forwardResult = runGitApplyCheck({ ...options, reverse: false });
  if (forwardResult.error) {
    throw forwardResult.error;
  }
  if (forwardResult.ok) {
    return { state: PATCH_STATE.unpatched };
  }
  return {
    details: [reverseResult.output, forwardResult.output]
      .filter(Boolean)
      .join('\n'),
    state: PATCH_STATE.drifted,
  };
}

function discoverPackagedRuntimePatchTargets({
  patchesRoot,
  runtimeNodeModulesRoot,
}) {
  const patchDescriptors = fs
    .readdirSync(patchesRoot)
    .filter((fileName) => fileName.endsWith('.patch'))
    .toSorted()
    .map((fileName) => parsePatchDescriptor(path.join(patchesRoot, fileName)));
  const patchesByPackageName = new Map();
  for (const patchDescriptor of patchDescriptors) {
    const packagePatches =
      patchesByPackageName.get(patchDescriptor.packageName) || [];
    assert(
      !packagePatches.some(
        (candidate) => candidate.version === patchDescriptor.version,
      ),
      `Multiple committed patches target ${patchDescriptor.packageName}@${patchDescriptor.version}.`,
    );
    packagePatches.push(patchDescriptor);
    patchesByPackageName.set(patchDescriptor.packageName, packagePatches);
  }

  const packageInstances = findInstalledPackageInstances(
    runtimeNodeModulesRoot,
    new Set(patchesByPackageName.keys()),
  );
  assert(
    packageInstances.length > 0,
    `No packaged runtime dependencies under ${runtimeNodeModulesRoot} match any committed patch.`,
  );

  return {
    packageInstances,
    patchDescriptors,
    patchesByPackageName,
  };
}

function findMatchingPatchDescriptor(packageInstance, patchesByPackageName) {
  const packagePatches =
    patchesByPackageName.get(packageInstance.packageName) || [];
  return {
    packagePatches,
    patchDescriptor: packagePatches.find(
      (candidate) => candidate.version === packageInstance.version,
    ),
  };
}

function auditPackagedRuntimePatches({
  patchesRoot,
  repositoryRoot,
  runtimeNodeModulesRoot,
}) {
  assert(
    fs.existsSync(runtimeNodeModulesRoot),
    `Runtime node_modules is missing: ${runtimeNodeModulesRoot}. Run electron-builder install-app-deps first.`,
  );

  const { packageInstances, patchDescriptors, patchesByPackageName } =
    discoverPackagedRuntimePatchTargets({
      patchesRoot,
      runtimeNodeModulesRoot,
    });
  const failures = [];
  const results = [];

  for (const packageInstance of packageInstances) {
    const { packagePatches, patchDescriptor } = findMatchingPatchDescriptor(
      packageInstance,
      patchesByPackageName,
    );
    const relativePackageRoot = normalizeGitPath(
      path.relative(repositoryRoot, packageInstance.packageRoot),
    );
    if (!patchDescriptor) {
      failures.push(
        `${packageInstance.packageName}@${packageInstance.version} at ${relativePackageRoot} does not match committed patch version(s): ${packagePatches
          .map((candidate) => candidate.version)
          .join(', ')}.`,
      );
    } else {
      const patchState = classifyPatchState({
        packageName: packageInstance.packageName,
        packageRoot: packageInstance.packageRoot,
        patchFilePath: patchDescriptor.patchFilePath,
        repositoryRoot,
        runtimeNodeModulesRoot,
      });
      results.push({
        ...packageInstance,
        ...patchState,
        patchFilePath: patchDescriptor.patchFilePath,
      });
      if (patchState.state === PATCH_STATE.unpatched) {
        failures.push(
          `${packageInstance.packageName}@${packageInstance.version} at ${relativePackageRoot} is missing ${path.relative(
            repositoryRoot,
            patchDescriptor.patchFilePath,
          )}.`,
        );
      } else if (patchState.state === PATCH_STATE.drifted) {
        failures.push(
          `${packageInstance.packageName}@${packageInstance.version} at ${relativePackageRoot} is partially patched or has drifted from ${path.relative(
            repositoryRoot,
            patchDescriptor.patchFilePath,
          )}.`,
        );
      }
    }
  }

  assert(
    failures.length === 0,
    `Packaged runtime patch audit failed:\n${failures
      .map((failure) => `- ${failure}`)
      .join('\n')}`,
  );

  return {
    packagedPatchCount: results.length,
    rootPatchCount: patchDescriptors.length,
    results,
  };
}

function main() {
  const repositoryRoot = path.resolve(__dirname, '../../..');
  try {
    const summary = auditPackagedRuntimePatches({
      patchesRoot: path.join(repositoryRoot, 'patches'),
      repositoryRoot,
      runtimeNodeModulesRoot: path.join(
        repositoryRoot,
        'apps/desktop/app/node_modules',
      ),
    });
    for (const result of summary.results) {
      process.stdout.write(
        `${result.state} ${result.packageName}@${result.version} (${normalizeGitPath(
          path.relative(repositoryRoot, result.packageRoot),
        )})\n`,
      );
    }
    process.stdout.write(
      `Audited ${summary.packagedPatchCount} packaged runtime patch instance(s) against ${summary.rootPatchCount} committed patch(es).\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  PATCH_STATE,
  auditPackagedRuntimePatches,
  classifyPatchState,
  discoverPackagedRuntimePatchTargets,
  findInstalledPackageInstances,
  findMatchingPatchDescriptor,
  getPackageNameFromPatchPath,
  normalizeGitPath,
  parsePatchDescriptor,
  runGitApply,
  runGitApplyCheck,
};
