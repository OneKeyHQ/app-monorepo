const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');
const checkGeneratedFileScopeScript = path.join(
  repoRoot,
  'development/lavamoat/check-generated-file-scope.cjs',
);
const checkPolicyDiffScript = path.join(
  repoRoot,
  'development/lavamoat/check-policy-diff.cjs',
);
const validatePolicyArtifactsScript = path.join(
  repoRoot,
  'development/lavamoat/validate-policy-artifacts.cjs',
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed with status ${result.status}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return result;
}

function runScript(script, cwd, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function expectStatus(result, expectedStatus, label) {
  if (result.status !== expectedStatus) {
    throw new Error(
      [
        `${label} expected status ${expectedStatus}, got ${result.status}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function initRepo(dir) {
  run('git', ['init', '-q'], { cwd: dir });
  run('git', ['config', 'user.email', 'lavamoat-test@example.com'], {
    cwd: dir,
  });
  run('git', ['config', 'user.name', 'LavaMoat Test'], { cwd: dir });
  run('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
}

function commitAll(dir, message) {
  run('git', ['add', '.'], { cwd: dir });
  run('git', ['commit', '-q', '-m', message], { cwd: dir });
}

function createTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-tooling-'));
}

function testGeneratedFileScope(tempRoot) {
  const repo = path.join(tempRoot, 'scope');
  fs.mkdirSync(repo);
  initRepo(repo);

  writeFile(path.join(repo, 'src/app.ts'), 'base\n');
  commitAll(repo, 'init');

  writeFile(path.join(repo, 'src/feature.ts'), 'committed business change\n');
  commitAll(repo, 'committed non-lavamoat change');

  writeFile(path.join(repo, 'lavamoat/webpack/web/policy.json'), '{}\n');
  expectStatus(
    runScript(checkGeneratedFileScopeScript, repo),
    0,
    'check-generated-file-scope allows lavamoat-only changes after committed business changes',
  );

  writeFile(path.join(repo, 'src/app.ts'), 'dirty\n');
  expectStatus(
    runScript(checkGeneratedFileScopeScript, repo),
    1,
    'check-generated-file-scope rejects non-lavamoat changes',
  );

  const renameRepo = path.join(tempRoot, 'scope-rename');
  fs.mkdirSync(renameRepo);
  initRepo(renameRepo);
  writeFile(path.join(renameRepo, 'src/app.ts'), 'base\n');
  commitAll(renameRepo, 'init');
  fs.mkdirSync(path.join(renameRepo, 'lavamoat/webpack/web'), {
    recursive: true,
  });
  run('git', ['mv', 'src/app.ts', 'lavamoat/webpack/web/app.ts'], {
    cwd: renameRepo,
  });
  expectStatus(
    runScript(checkGeneratedFileScopeScript, renameRepo),
    1,
    'check-generated-file-scope rejects renames from non-lavamoat files',
  );
}

function createPolicyDiffBaseRepo(repo) {
  fs.mkdirSync(repo);
  initRepo(repo);
  writeFile(path.join(repo, 'lavamoat/webpack/web/policy.json'), '{"old":true}\n');
  commitAll(repo, 'init');
}

function testPolicyDiff(tempRoot) {
  const repo = path.join(tempRoot, 'diff');
  createPolicyDiffBaseRepo(repo);

  const output = path.join(repo, 'policy.patch');
  writeFile(output, 'stale\n');
  expectStatus(
    runScript(checkPolicyDiffScript, repo, ['--output', output]),
    0,
    'check-policy-diff succeeds when lavamoat is clean',
  );
  if (fs.existsSync(output)) {
    throw new Error('check-policy-diff should remove stale output when clean');
  }

  writeFile(path.join(repo, 'lavamoat/webpack/web/policy.json'), '{"new":true}\n');
  writeFile(
    path.join(repo, 'lavamoat/webpack/web/policy-override.json'),
    '{"resources":{}}\n',
  );
  expectStatus(
    runScript(checkPolicyDiffScript, repo, ['--output', output]),
    1,
    'check-policy-diff reports lavamoat changes',
  );
  if (!fs.existsSync(output)) {
    throw new Error('check-policy-diff should write patch output on diff');
  }

  const applyRepo = path.join(tempRoot, 'apply');
  createPolicyDiffBaseRepo(applyRepo);
  run('git', ['apply', '--check', '--whitespace=error', output], {
    cwd: applyRepo,
  });
  run('git', ['apply', '--whitespace=error', output], { cwd: applyRepo });
  expectStatus(
    runScript(checkGeneratedFileScopeScript, applyRepo),
    0,
    'policy diff patch only changes lavamoat files',
  );
  commitAll(applyRepo, 'apply policy diff');
  expectStatus(
    runScript(checkPolicyDiffScript, applyRepo),
    0,
    'check-policy-diff succeeds after committing generated policy changes',
  );

  const deleteRepo = path.join(tempRoot, 'delete-diff');
  createPolicyDiffBaseRepo(deleteRepo);
  const deleteOutput = path.join(deleteRepo, 'delete-policy.patch');
  fs.rmSync(path.join(deleteRepo, 'lavamoat/webpack/web/policy.json'));
  expectStatus(
    runScript(checkPolicyDiffScript, deleteRepo, ['--output', deleteOutput]),
    1,
    'check-policy-diff reports deleted lavamoat files',
  );

  const deleteApplyRepo = path.join(tempRoot, 'delete-apply');
  createPolicyDiffBaseRepo(deleteApplyRepo);
  run('git', ['apply', '--check', '--whitespace=error', deleteOutput], {
    cwd: deleteApplyRepo,
  });
  run('git', ['apply', '--whitespace=error', deleteOutput], {
    cwd: deleteApplyRepo,
  });
  if (fs.existsSync(path.join(deleteApplyRepo, 'lavamoat/webpack/web/policy.json'))) {
    throw new Error('delete policy diff should remove tracked lavamoat files');
  }
  expectStatus(
    runScript(checkGeneratedFileScopeScript, deleteApplyRepo),
    0,
    'deleted policy diff patch only changes lavamoat files',
  );
}

function copyFileFromRepo(targetRepo, sourceRelativePath) {
  const source = path.join(repoRoot, sourceRelativePath);
  const target = path.join(targetRepo, sourceRelativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyLavamoatValidationFixture(targetRepo) {
  for (const dir of [
    'lavamoat/build-system',
    'lavamoat/esbuild/desktop-main',
    'lavamoat/metro/mobile-bg',
    'lavamoat/metro/mobile-main',
    'lavamoat/node/cli',
    'lavamoat/webpack/ext/mv2',
    'lavamoat/webpack/ext/mv3',
    'lavamoat/webpack/web-embed',
  ]) {
    writeFile(path.join(targetRepo, dir, '.gitkeep'), 'placeholder\n');
  }

  for (const file of [
    '.github/workflows/update-lavamoat-policies.yml',
    '.github/workflows/validate-lavamoat-policies.yml',
    'apps/cli/package.json',
    'apps/desktop/package.json',
    'apps/ext/package.json',
    'apps/mobile/package.json',
    'apps/web/package.json',
    'apps/web-embed/package.json',
    'development/lavamoat/check-generated-file-scope.cjs',
    'development/lavamoat/check-policy-diff.cjs',
    'development/lavamoat/normalize-policy-artifacts.cjs',
    'development/lavamoat/split-policy-for-review.cjs',
    'development/lavamoat/targets.cjs',
    'development/lavamoat/test-tooling.cjs',
    'development/lavamoat/validate-policy-artifacts.cjs',
    'development/lavamoat/validate-webpack-integration.cjs',
    'development/webpack/lavamoat.js',
    'package.json',
    'lavamoat/README.md',
    'lavamoat/review/README.md',
    'lavamoat/review/summary.json',
    'lavamoat/webpack/web/policy.json',
    'lavamoat/webpack/web/policy-override.json',
    'lavamoat/webpack/desktop-renderer/policy.json',
    'lavamoat/webpack/desktop-renderer/policy-override.json',
  ]) {
    copyFileFromRepo(targetRepo, file);
  }

  for (const target of ['web', 'desktop-renderer']) {
    for (const file of [
      'all-high-risk-entries.json',
      'code-execution.json',
      'crypto-random.json',
      'denied-overrides.json',
      'dom-injection-navigation.json',
      'effective-policy-summary.json',
      'extension-desktop-bridge.json',
      'hardware-device.json',
      'native-modules.json',
      'network.json',
      'node-builtins.json',
      'node-system.json',
      'package-edges-to-risky-resources.json',
      'storage-privacy.json',
      'summary.json',
    ]) {
      copyFileFromRepo(targetRepo, `lavamoat/review/webpack/${target}/${file}`);
    }
  }
}

function testPolicyArtifactValidation(tempRoot) {
  const repo = path.join(tempRoot, 'artifacts');
  fs.mkdirSync(repo);
  copyLavamoatValidationFixture(repo);

  expectStatus(
    runScript(validatePolicyArtifactsScript, repo),
    0,
    'validate-policy-artifacts accepts fixture',
  );

  const unnormalizedPolicyRepo = path.join(
    tempRoot,
    'artifacts-unnormalized-policy',
  );
  fs.mkdirSync(unnormalizedPolicyRepo);
  copyLavamoatValidationFixture(unnormalizedPolicyRepo);
  writeFile(
    path.join(
      unnormalizedPolicyRepo,
      'lavamoat/webpack/web/policy-override.json',
    ),
    '{"resources":{"a":{"meta":{"webpack-optimization":["z","a"]}},"z":{}}}\n',
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, unnormalizedPolicyRepo),
    1,
    'validate-policy-artifacts rejects unnormalized policy artifact',
  );

  writeFile(path.join(repo, 'lavamoat/webpack/web/policy-debug.json'), '{}\n');
  expectStatus(
    runScript(validatePolicyArtifactsScript, repo),
    1,
    'validate-policy-artifacts rejects policy-debug.json',
  );

  const missingReadmeTargetRepo = path.join(tempRoot, 'artifacts-missing-readme-target');
  fs.mkdirSync(missingReadmeTargetRepo);
  copyLavamoatValidationFixture(missingReadmeTargetRepo);
  writeFile(
    path.join(missingReadmeTargetRepo, 'lavamoat/README.md'),
    '# OneKey LavaMoat 接入说明\n\n缺少目标列表。\n',
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingReadmeTargetRepo),
    1,
    'validate-policy-artifacts rejects README target drift',
  );

  const missingScriptRepo = path.join(tempRoot, 'artifacts-missing-root-script');
  fs.mkdirSync(missingScriptRepo);
  copyLavamoatValidationFixture(missingScriptRepo);
  const packageJsonFile = path.join(missingScriptRepo, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
  delete packageJson.scripts['lavamoat:build:web'];
  writeFile(packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingScriptRepo),
    1,
    'validate-policy-artifacts rejects missing enabled target script',
  );

  const disabledRootScriptRepo = path.join(
    tempRoot,
    'artifacts-disabled-root-script',
  );
  fs.mkdirSync(disabledRootScriptRepo);
  copyLavamoatValidationFixture(disabledRootScriptRepo);
  const disabledRootPackageJsonFile = path.join(
    disabledRootScriptRepo,
    'package.json',
  );
  const disabledRootPackageJson = JSON.parse(
    fs.readFileSync(disabledRootPackageJsonFile, 'utf8'),
  );
  disabledRootPackageJson.scripts['lavamoat:policy:ext'] =
    'yarn workspace @onekeyhq/ext lavamoat:policy';
  writeFile(
    disabledRootPackageJsonFile,
    `${JSON.stringify(disabledRootPackageJson, null, 2)}\n`,
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, disabledRootScriptRepo),
    1,
    'validate-policy-artifacts rejects root LavaMoat scripts for disabled targets',
  );

  const incompleteCiScriptRepo = path.join(
    tempRoot,
    'artifacts-incomplete-ci-script',
  );
  fs.mkdirSync(incompleteCiScriptRepo);
  copyLavamoatValidationFixture(incompleteCiScriptRepo);
  const incompleteCiPackageJsonFile = path.join(incompleteCiScriptRepo, 'package.json');
  const incompleteCiPackageJson = JSON.parse(
    fs.readFileSync(incompleteCiPackageJsonFile, 'utf8'),
  );
  incompleteCiPackageJson.scripts['lavamoat:ci:validate'] =
    'yarn lavamoat:test-tooling && yarn lavamoat:policy:all';
  writeFile(
    incompleteCiPackageJsonFile,
    `${JSON.stringify(incompleteCiPackageJson, null, 2)}\n`,
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, incompleteCiScriptRepo),
    1,
    'validate-policy-artifacts rejects incomplete aggregate CI script',
  );

  const missingWorkspaceScriptRepo = path.join(
    tempRoot,
    'artifacts-missing-workspace-script',
  );
  fs.mkdirSync(missingWorkspaceScriptRepo);
  copyLavamoatValidationFixture(missingWorkspaceScriptRepo);
  const webPackageJsonFile = path.join(
    missingWorkspaceScriptRepo,
    'apps/web/package.json',
  );
  const webPackageJson = JSON.parse(fs.readFileSync(webPackageJsonFile, 'utf8'));
  delete webPackageJson.scripts['build:lavamoat'];
  writeFile(webPackageJsonFile, `${JSON.stringify(webPackageJson, null, 2)}\n`);
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingWorkspaceScriptRepo),
    1,
    'validate-policy-artifacts rejects missing workspace target script',
  );

  const missingWorkspaceDependencyRepo = path.join(
    tempRoot,
    'artifacts-missing-workspace-dependency',
  );
  fs.mkdirSync(missingWorkspaceDependencyRepo);
  copyLavamoatValidationFixture(missingWorkspaceDependencyRepo);
  const webDependencyPackageJsonFile = path.join(
    missingWorkspaceDependencyRepo,
    'apps/web/package.json',
  );
  const webDependencyPackageJson = JSON.parse(
    fs.readFileSync(webDependencyPackageJsonFile, 'utf8'),
  );
  delete webDependencyPackageJson.dependencies['@onekeyhq/core'];
  writeFile(
    webDependencyPackageJsonFile,
    `${JSON.stringify(webDependencyPackageJson, null, 2)}\n`,
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingWorkspaceDependencyRepo),
    1,
    'validate-policy-artifacts rejects missing workspace dependencies',
  );

  const disabledWorkspaceScriptRepo = path.join(
    tempRoot,
    'artifacts-disabled-workspace-script',
  );
  fs.mkdirSync(disabledWorkspaceScriptRepo);
  copyLavamoatValidationFixture(disabledWorkspaceScriptRepo);
  const extPackageJsonFile = path.join(
    disabledWorkspaceScriptRepo,
    'apps/ext/package.json',
  );
  const extPackageJson = JSON.parse(fs.readFileSync(extPackageJsonFile, 'utf8'));
  extPackageJson.scripts ||= {};
  extPackageJson.scripts['lavamoat:policy'] = 'ONEKEY_LAVAMOAT=1 webpack build';
  writeFile(
    extPackageJsonFile,
    `${JSON.stringify(extPackageJson, null, 2)}\n`,
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, disabledWorkspaceScriptRepo),
    1,
    'validate-policy-artifacts rejects disabled workspace LavaMoat scripts',
  );

  const disabledTargetPolicyRepo = path.join(
    tempRoot,
    'artifacts-disabled-target-policy',
  );
  fs.mkdirSync(disabledTargetPolicyRepo);
  copyLavamoatValidationFixture(disabledTargetPolicyRepo);
  writeFile(
    path.join(disabledTargetPolicyRepo, 'lavamoat/webpack/ext/mv3/policy.json'),
    '{"resources":{}}\n',
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, disabledTargetPolicyRepo),
    1,
    'validate-policy-artifacts rejects disabled target policy files',
  );

  const missingWorkflowCommandRepo = path.join(
    tempRoot,
    'artifacts-missing-workflow-command',
  );
  fs.mkdirSync(missingWorkflowCommandRepo);
  copyLavamoatValidationFixture(missingWorkflowCommandRepo);
  const validateWorkflowFile = path.join(
    missingWorkflowCommandRepo,
    '.github/workflows/validate-lavamoat-policies.yml',
  );
  const validateWorkflow = fs
    .readFileSync(validateWorkflowFile, 'utf8')
    .replace('yarn lavamoat:build:web', 'echo missing-web-lavamoat-build');
  writeFile(validateWorkflowFile, validateWorkflow);
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingWorkflowCommandRepo),
    1,
    'validate-policy-artifacts rejects missing workflow target command',
  );

  const missingValidateArtifactUploadRepo = path.join(
    tempRoot,
    'artifacts-missing-validate-artifact-upload',
  );
  fs.mkdirSync(missingValidateArtifactUploadRepo);
  copyLavamoatValidationFixture(missingValidateArtifactUploadRepo);
  const missingUploadValidateWorkflowFile = path.join(
    missingValidateArtifactUploadRepo,
    '.github/workflows/validate-lavamoat-policies.yml',
  );
  writeFile(
    missingUploadValidateWorkflowFile,
    fs
      .readFileSync(missingUploadValidateWorkflowFile, 'utf8')
      .replace('actions/upload-artifact@v4', 'actions/cache@v4'),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingValidateArtifactUploadRepo),
    1,
    'validate-policy-artifacts rejects missing validation artifact upload',
  );

  const validateWorkflowWritePermissionRepo = path.join(
    tempRoot,
    'artifacts-validate-workflow-write-permission',
  );
  fs.mkdirSync(validateWorkflowWritePermissionRepo);
  copyLavamoatValidationFixture(validateWorkflowWritePermissionRepo);
  const writePermissionValidateWorkflowFile = path.join(
    validateWorkflowWritePermissionRepo,
    '.github/workflows/validate-lavamoat-policies.yml',
  );
  writeFile(
    writePermissionValidateWorkflowFile,
    fs
      .readFileSync(writePermissionValidateWorkflowFile, 'utf8')
      .replace('contents: read\n  packages: read', 'contents: write\n  packages: read'),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, validateWorkflowWritePermissionRepo),
    1,
    'validate-policy-artifacts rejects write permission in validation workflow',
  );

  const missingUpdateTriggerRepo = path.join(
    tempRoot,
    'artifacts-missing-update-trigger',
  );
  fs.mkdirSync(missingUpdateTriggerRepo);
  copyLavamoatValidationFixture(missingUpdateTriggerRepo);
  const missingUpdateTriggerWorkflowFile = path.join(
    missingUpdateTriggerRepo,
    '.github/workflows/update-lavamoat-policies.yml',
  );
  writeFile(
    missingUpdateTriggerWorkflowFile,
    fs
      .readFileSync(missingUpdateTriggerWorkflowFile, 'utf8')
      .replace(
        "startsWith(github.event.comment.body, '@onekeybot update-policies')",
        "startsWith(github.event.comment.body, '@onekeybot update')",
      ),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingUpdateTriggerRepo),
    1,
    'validate-policy-artifacts rejects missing update workflow trigger command',
  );

  const missingCrossRepoGuardRepo = path.join(
    tempRoot,
    'artifacts-missing-cross-repo-guard',
  );
  fs.mkdirSync(missingCrossRepoGuardRepo);
  copyLavamoatValidationFixture(missingCrossRepoGuardRepo);
  const missingCrossRepoWorkflowFile = path.join(
    missingCrossRepoGuardRepo,
    '.github/workflows/update-lavamoat-policies.yml',
  );
  writeFile(
    missingCrossRepoWorkflowFile,
    fs
      .readFileSync(missingCrossRepoWorkflowFile, 'utf8')
      .replaceAll('isCrossRepository', 'isNotCrossRepository')
      .replaceAll('IS_CROSS_REPO_PR', 'IS_NOT_CROSS_REPO_PR'),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingCrossRepoGuardRepo),
    1,
    'validate-policy-artifacts rejects missing cross-repository PR guard',
  );

  const missingUpdateArtifactDownloadRepo = path.join(
    tempRoot,
    'artifacts-missing-update-artifact-download',
  );
  fs.mkdirSync(missingUpdateArtifactDownloadRepo);
  copyLavamoatValidationFixture(missingUpdateArtifactDownloadRepo);
  const missingDownloadUpdateWorkflowFile = path.join(
    missingUpdateArtifactDownloadRepo,
    '.github/workflows/update-lavamoat-policies.yml',
  );
  writeFile(
    missingDownloadUpdateWorkflowFile,
    fs
      .readFileSync(missingDownloadUpdateWorkflowFile, 'utf8')
      .replace('pattern: lavamoat-policy-diff-*', 'pattern: other-artifact-*'),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingUpdateArtifactDownloadRepo),
    1,
    'validate-policy-artifacts rejects missing update artifact download pattern',
  );

  const missingUpdateWritePermissionRepo = path.join(
    tempRoot,
    'artifacts-missing-update-write-permission',
  );
  fs.mkdirSync(missingUpdateWritePermissionRepo);
  copyLavamoatValidationFixture(missingUpdateWritePermissionRepo);
  const missingWritePermissionUpdateWorkflowFile = path.join(
    missingUpdateWritePermissionRepo,
    '.github/workflows/update-lavamoat-policies.yml',
  );
  writeFile(
    missingWritePermissionUpdateWorkflowFile,
    fs
      .readFileSync(missingWritePermissionUpdateWorkflowFile, 'utf8')
      .replace('      contents: write', '      contents: read'),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingUpdateWritePermissionRepo),
    1,
    'validate-policy-artifacts rejects missing update workflow write permission',
  );

  const unsafePrCheckoutRepo = path.join(
    tempRoot,
    'artifacts-unsafe-pr-checkout',
  );
  fs.mkdirSync(unsafePrCheckoutRepo);
  copyLavamoatValidationFixture(unsafePrCheckoutRepo);
  const unsafePrCheckoutWorkflowFile = path.join(
    unsafePrCheckoutRepo,
    '.github/workflows/update-lavamoat-policies.yml',
  );
  writeFile(
    unsafePrCheckoutWorkflowFile,
    fs
      .readFileSync(unsafePrCheckoutWorkflowFile, 'utf8')
      .replace(
        'git read-tree "${HEAD_SHA}"',
        'gh pr checkout "${PR_NUMBER}" --repo "${REPO}"\n          git read-tree "${HEAD_SHA}"',
      ),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, unsafePrCheckoutRepo),
    1,
    'validate-policy-artifacts rejects PR checkout in privileged update workflow',
  );

  const workflowIfSecretsRepo = path.join(
    tempRoot,
    'artifacts-workflow-if-secrets',
  );
  fs.mkdirSync(workflowIfSecretsRepo);
  copyLavamoatValidationFixture(workflowIfSecretsRepo);
  const updateWorkflowFile = path.join(
    workflowIfSecretsRepo,
    '.github/workflows/update-lavamoat-policies.yml',
  );
  const updateWorkflow = fs
    .readFileSync(updateWorkflowFile, 'utf8')
    .replace(
      'if: ${{ steps.check-diffs.outputs.HAS_DIFFS == \'true\' }}',
      'if: ${{ secrets.ONEKEYBOT_GITHUB_TOKEN != \'\' }}',
    );
  writeFile(updateWorkflowFile, updateWorkflow);
  expectStatus(
    runScript(validatePolicyArtifactsScript, workflowIfSecretsRepo),
    1,
    'validate-policy-artifacts rejects secrets in workflow if conditions',
  );

  const missingReviewCategoryRepo = path.join(
    tempRoot,
    'artifacts-missing-review-category',
  );
  fs.mkdirSync(missingReviewCategoryRepo);
  copyLavamoatValidationFixture(missingReviewCategoryRepo);
  fs.rmSync(
    path.join(
      missingReviewCategoryRepo,
      'lavamoat/review/webpack/web/hardware-device.json',
    ),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingReviewCategoryRepo),
    1,
    'validate-policy-artifacts rejects missing review category file',
  );

  const missingReviewSummaryCategoryRepo = path.join(
    tempRoot,
    'artifacts-missing-review-summary-category',
  );
  fs.mkdirSync(missingReviewSummaryCategoryRepo);
  copyLavamoatValidationFixture(missingReviewSummaryCategoryRepo);
  const reviewSummaryFile = path.join(
    missingReviewSummaryCategoryRepo,
    'lavamoat/review/webpack/web/summary.json',
  );
  const reviewSummary = JSON.parse(fs.readFileSync(reviewSummaryFile, 'utf8'));
  delete reviewSummary.categoryCounts['hardware-device'];
  writeFile(reviewSummaryFile, `${JSON.stringify(reviewSummary, null, 2)}\n`);
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingReviewSummaryCategoryRepo),
    1,
    'validate-policy-artifacts rejects missing review summary category',
  );

  const missingToolFileRepo = path.join(tempRoot, 'artifacts-missing-tool-file');
  fs.mkdirSync(missingToolFileRepo);
  copyLavamoatValidationFixture(missingToolFileRepo);
  fs.rmSync(
    path.join(
      missingToolFileRepo,
      'development/lavamoat/validate-webpack-integration.cjs',
    ),
  );
  expectStatus(
    runScript(validatePolicyArtifactsScript, missingToolFileRepo),
    1,
    'validate-policy-artifacts rejects missing LavaMoat tool file',
  );
}

function main() {
  const tempRoot = createTempRoot();
  try {
    testGeneratedFileScope(tempRoot);
    testPolicyDiff(tempRoot);
    testPolicyArtifactValidation(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('LavaMoat tooling self-test passed.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
