const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  PATCH_STATE,
  classifyPatchState,
  discoverPackagedRuntimePatchTargets,
  findMatchingPatchDescriptor,
  normalizeGitPath,
  runGitApply,
} = require('./audit-packaged-runtime-patches');

const PATCH_ACTION = {
  alreadyPatched: 'ALREADY_PATCHED',
  applied: 'APPLIED',
};

function processPackageInstance({
  packageInstance,
  patchesByPackageName,
  repositoryRoot,
  runtimeNodeModulesRoot,
}) {
  const { packagePatches, patchDescriptor } = findMatchingPatchDescriptor(
    packageInstance,
    patchesByPackageName,
  );
  const relativePackageRoot = normalizeGitPath(
    path.relative(repositoryRoot, packageInstance.packageRoot),
  );
  if (!patchDescriptor) {
    return {
      failure: `${packageInstance.packageName}@${packageInstance.version} at ${relativePackageRoot} does not match committed patch version(s): ${packagePatches
        .map((candidate) => candidate.version)
        .join(', ')}.`,
    };
  }

  const patchOptions = {
    packageName: packageInstance.packageName,
    packageRoot: packageInstance.packageRoot,
    patchFilePath: patchDescriptor.patchFilePath,
    repositoryRoot,
    runtimeNodeModulesRoot,
  };
  const initialState = classifyPatchState(patchOptions);
  if (initialState.state === PATCH_STATE.patched) {
    return {
      result: {
        ...packageInstance,
        action: PATCH_ACTION.alreadyPatched,
        patchFilePath: patchDescriptor.patchFilePath,
      },
    };
  }
  if (initialState.state === PATCH_STATE.drifted) {
    return {
      failure: `${packageInstance.packageName}@${packageInstance.version} at ${relativePackageRoot} is partially patched or has drifted from ${path.relative(
        repositoryRoot,
        patchDescriptor.patchFilePath,
      )}.`,
    };
  }

  const applyResult = runGitApply(patchOptions);
  if (applyResult.error) {
    throw applyResult.error;
  }
  if (!applyResult.ok) {
    return {
      failure: `Failed to apply ${path.relative(
        repositoryRoot,
        patchDescriptor.patchFilePath,
      )} to ${relativePackageRoot}: ${applyResult.output || 'git apply failed'}.`,
    };
  }

  const appliedState = classifyPatchState(patchOptions);
  if (appliedState.state !== PATCH_STATE.patched) {
    return {
      failure: `${packageInstance.packageName}@${packageInstance.version} at ${relativePackageRoot} did not pass full patch verification after apply.`,
    };
  }
  return {
    result: {
      ...packageInstance,
      action: PATCH_ACTION.applied,
      patchFilePath: patchDescriptor.patchFilePath,
    },
  };
}

function applyPackagedRuntimePatches({
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
    const { failure, result } = processPackageInstance({
      packageInstance,
      patchesByPackageName,
      repositoryRoot,
      runtimeNodeModulesRoot,
    });
    if (failure) {
      failures.push(failure);
    } else if (result) {
      results.push(result);
    }
  }

  assert(
    failures.length === 0,
    `Packaged runtime patch application failed:\n${failures
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
    const summary = applyPackagedRuntimePatches({
      patchesRoot: path.join(repositoryRoot, 'patches'),
      repositoryRoot,
      runtimeNodeModulesRoot: path.join(
        repositoryRoot,
        'apps/desktop/app/node_modules',
      ),
    });
    for (const result of summary.results) {
      process.stdout.write(
        `${result.action} ${result.packageName}@${result.version} (${normalizeGitPath(
          path.relative(repositoryRoot, result.packageRoot),
        )})\n`,
      );
    }
    process.stdout.write(
      `Processed ${summary.packagedPatchCount} packaged runtime patch instance(s) from ${summary.rootPatchCount} committed patch(es).\n`,
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
  PATCH_ACTION,
  applyPackagedRuntimePatches,
};
