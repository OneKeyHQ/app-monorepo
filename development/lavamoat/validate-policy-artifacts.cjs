const fs = require('fs');
const path = require('path');

const {
  disabledRootScriptFragments,
  disabledTargetDirs,
  disabledWorkspacePackageJsons,
  enabledTargets,
} = require('./targets.cjs');

const repoRoot = process.cwd();
const lavamoatRoot = path.join(repoRoot, 'lavamoat');

const expectedPolicyFiles = enabledTargets.map((target) => target.policy);
const expectedOverrideFiles = enabledTargets.map((target) => target.override);
const expectedReviewFiles = [
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
];
const expectedReviewCategories = expectedReviewFiles
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .filter(
    (category) =>
      ![
        'all-high-risk-entries',
        'denied-overrides',
        'effective-policy-summary',
        'native-modules',
        'node-builtins',
        'package-edges-to-risky-resources',
        'summary',
      ].includes(category),
  )
  .sort();

const requiredToolFiles = [
  'development/lavamoat/check-generated-file-scope.cjs',
  'development/lavamoat/check-policy-diff.cjs',
  'development/lavamoat/normalize-policy-artifacts.cjs',
  'development/lavamoat/split-policy-for-review.cjs',
  'development/lavamoat/targets.cjs',
  'development/lavamoat/test-tooling.cjs',
  'development/lavamoat/validate-policy-artifacts.cjs',
  'development/lavamoat/validate-webpack-integration.cjs',
  'development/webpack/lavamoat.js',
];

const forbiddenLocalPathPatterns = [
  {
    label: 'current workspace absolute path',
    pattern: new RegExp(escapeRegExp(repoRoot)),
  },
  {
    label: 'macOS user home absolute path',
    pattern: /\/Users\/[^/\s"]+/,
  },
  {
    label: 'Linux user home absolute path',
    pattern: /\/home\/[^/\s"]+/,
  },
  {
    label: 'temporary absolute path',
    pattern: /\/(?:private\/)?(?:tmp|var\/folders)\//,
  },
  {
    label: 'Windows drive absolute path',
    pattern: /[A-Za-z]:\\Users\\[^\\\s"]+/,
  },
];

const forbiddenSidecarFilePatterns = [
  /(?:^|[/\\])policy-debug\.json$/,
  /\.map$/,
  /\.log$/,
  /\.patch$/,
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function relative(file) {
  return path.relative(repoRoot, file);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function collectStrings(value, currentPath = '$', results = []) {
  if (typeof value === 'string') {
    results.push({ path: currentPath, value });
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStrings(item, `${currentPath}[${index}]`, results);
    });
    return results;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      collectStrings(key, `${currentPath}.${JSON.stringify(key)}<key>`, results);
      collectStrings(item, `${currentPath}.${JSON.stringify(key)}`, results);
    });
  }

  return results;
}

function sortObject(value) {
  if (Array.isArray(value)) {
    const items = value.map(sortObject);
    if (items.every((item) => typeof item === 'string')) {
      return items.sort((left, right) => left.localeCompare(right));
    }
    return items;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObject(item)]),
  );
}

function validateExpectedPolicies() {
  for (const policyFile of expectedPolicyFiles) {
    const fullPath = path.join(lavamoatRoot, policyFile);
    assert(fs.existsSync(fullPath), `Missing expected policy: ${policyFile}`);
    const policy = readJson(fullPath);
    assert(
      policy && typeof policy.resources === 'object' && !Array.isArray(policy.resources),
      `Invalid LavaMoat policy shape: ${policyFile}`,
    );
  }

  for (const overrideFile of expectedOverrideFiles) {
    const fullPath = path.join(lavamoatRoot, overrideFile);
    assert(
      fs.existsSync(fullPath),
      `Missing expected policy override: ${overrideFile}`,
    );
    const override = readJson(fullPath);
    assert(
      override &&
        typeof override.resources === 'object' &&
        !Array.isArray(override.resources),
      `Invalid LavaMoat policy override shape: ${overrideFile}`,
    );
  }

  const actualPolicyFiles = walk(lavamoatRoot)
    .filter((file) => path.basename(file) === 'policy.json')
    .map((file) => path.relative(lavamoatRoot, file))
    .sort();
  const expectedSortedPolicyFiles = [...expectedPolicyFiles].sort();

  assert(
    JSON.stringify(actualPolicyFiles) ===
      JSON.stringify(expectedSortedPolicyFiles),
    `Unexpected LavaMoat policy set:\nexpected: ${expectedPolicyFiles.join(
      ', ',
    )}\nactual: ${actualPolicyFiles.join(', ')}`,
  );

  const actualOverrideFiles = walk(lavamoatRoot)
    .filter((file) => path.basename(file) === 'policy-override.json')
    .map((file) => path.relative(lavamoatRoot, file))
    .sort();
  const expectedSortedOverrideFiles = [...expectedOverrideFiles].sort();

  assert(
    JSON.stringify(actualOverrideFiles) ===
      JSON.stringify(expectedSortedOverrideFiles),
    `Unexpected LavaMoat policy override set:\nexpected: ${expectedOverrideFiles.join(
      ', ',
    )}\nactual: ${actualOverrideFiles.join(', ')}`,
  );
}

function validateDisabledTargetDirs() {
  for (const disabledDir of disabledTargetDirs) {
    const fullDir = path.join(lavamoatRoot, disabledDir);
    assert(fs.existsSync(fullDir), `Missing disabled target placeholder: ${disabledDir}`);

    const files = walk(fullDir).map((file) => path.relative(fullDir, file));
    assert(
      files.length === 1 && files[0] === '.gitkeep',
      `Disabled target ${disabledDir} should only contain .gitkeep, found: ${files.join(
        ', ',
      )}`,
    );

    const gitkeepContent = fs.readFileSync(path.join(fullDir, '.gitkeep'), 'utf8');
    assert(
      gitkeepContent === 'placeholder\n',
      `Disabled target ${disabledDir}/.gitkeep must contain exactly "placeholder\\n"`,
    );
  }
}

function validateReviewSummary() {
  const summaryFile = path.join(lavamoatRoot, 'review/summary.json');
  const reviewIndexFile = path.join(lavamoatRoot, 'review/README.md');
  assert(fs.existsSync(summaryFile), 'Missing review summary: review/summary.json');
  assert(fs.existsSync(reviewIndexFile), 'Missing review index: review/README.md');

  const summary = readJson(summaryFile);
  const sourcePolicies = (summary.policies || [])
    .map((item) => item.sourcePolicy)
    .sort();
  const expectedSources = expectedPolicyFiles
    .map((file) => path.join('lavamoat', file).replaceAll(path.sep, '/'))
    .sort();

  assert(
    summary.totalPolicies === expectedPolicyFiles.length,
    `Review summary totalPolicies should be ${expectedPolicyFiles.length}, got ${summary.totalPolicies}`,
  );
  assert(
    JSON.stringify(sourcePolicies) === JSON.stringify(expectedSources),
    `Review summary source policies do not match enabled targets:\nexpected: ${expectedSources.join(
      ', ',
    )}\nactual: ${sourcePolicies.join(', ')}`,
  );
}

function validateReviewFiles() {
  for (const target of enabledTargets) {
    const reviewDir = path.join(
      lavamoatRoot,
      'review',
      path.dirname(target.policy),
    );
    assert(
      fs.existsSync(reviewDir),
      `Missing review directory for enabled target: ${target.id}`,
    );

    const actualReviewFiles = walk(reviewDir)
      .map((file) => path.relative(reviewDir, file))
      .sort();
    const expectedSortedReviewFiles = [...expectedReviewFiles].sort();

    assert(
      JSON.stringify(actualReviewFiles) ===
        JSON.stringify(expectedSortedReviewFiles),
      `Unexpected review files for ${target.id}:\nexpected: ${expectedSortedReviewFiles.join(
        ', ',
      )}\nactual: ${actualReviewFiles.join(', ')}`,
    );

    const targetSummary = readJson(path.join(reviewDir, 'summary.json'));
    const summaryCategories = Object.keys(targetSummary.categoryCounts || {}).sort();
    assert(
      JSON.stringify(summaryCategories) ===
        JSON.stringify(expectedReviewCategories),
      `Unexpected review summary categories for ${target.id}:\nexpected: ${expectedReviewCategories.join(
        ', ',
      )}\nactual: ${summaryCategories.join(', ')}`,
    );
  }
}

function validateReadmeTargetCoverage() {
  const readmeFile = path.join(lavamoatRoot, 'README.md');
  assert(fs.existsSync(readmeFile), 'Missing LavaMoat README: lavamoat/README.md');

  const readme = fs.readFileSync(readmeFile, 'utf8');
  const missingTargets = [
    ...enabledTargets.map((target) => target.id),
    ...disabledTargetDirs,
    ...disabledWorkspacePackageJsons,
  ].filter((target) => !readme.includes(target));

  assert(
    missingTargets.length === 0,
    `lavamoat/README.md is missing target documentation for:\n${missingTargets.join(
      '\n',
    )}`,
  );
}

function validateRootScripts() {
  const packageJsonFile = path.join(repoRoot, 'package.json');
  assert(fs.existsSync(packageJsonFile), 'Missing root package.json');

  const scripts = readJson(packageJsonFile).scripts || {};
  const requiredScripts = [
    'lavamoat:policy:all',
    'lavamoat:build:all',
    'lavamoat:review',
    'lavamoat:normalize-policies',
    'lavamoat:validate-artifacts',
    'lavamoat:validate-generated-scope',
    'lavamoat:validate-webpack-integration',
    'lavamoat:test-tooling',
    'lavamoat:diff',
    'lavamoat:ci:validate',
    'lavamoat:ci:build',
    'lavamoat:ci:all',
  ];

  for (const target of enabledTargets) {
    const suffix = target.scriptSuffix;
    assert(suffix, `Missing scriptSuffix for enabled target: ${target.id}`);
    requiredScripts.push(
      `lavamoat:policy:${suffix}:raw`,
      `lavamoat:policy:${suffix}`,
      `lavamoat:build:${suffix}:raw`,
      `lavamoat:build:${suffix}`,
    );
  }

  const missingScripts = requiredScripts.filter((script) => !scripts[script]);
  assert(
    missingScripts.length === 0,
    `Root package.json is missing LavaMoat scripts:\n${missingScripts.join(
      '\n',
    )}`,
  );

  const policyAll = scripts['lavamoat:policy:all'];
  const buildAll = scripts['lavamoat:build:all'];
  const missingPolicyAllTargets = enabledTargets
    .map((target) => target.scriptSuffix)
    .filter((suffix) => !policyAll.includes(`lavamoat:policy:${suffix}:raw`));
  const missingBuildAllTargets = enabledTargets
    .map((target) => target.scriptSuffix)
    .filter((suffix) => !buildAll.includes(`lavamoat:build:${suffix}:raw`));

  assert(
    missingPolicyAllTargets.length === 0,
    `lavamoat:policy:all does not include enabled targets:\n${missingPolicyAllTargets.join(
      '\n',
    )}`,
  );
  assert(
    missingBuildAllTargets.length === 0,
    `lavamoat:build:all does not include enabled targets:\n${missingBuildAllTargets.join(
      '\n',
    )}`,
  );

  const missingPolicyNormalizeScripts = [
    'lavamoat:policy:all',
    ...enabledTargets.map(
      (target) => `lavamoat:policy:${target.scriptSuffix}`,
    ),
  ].filter((scriptName) => {
    return !scripts[scriptName].includes('lavamoat:normalize-policies');
  });
  assert(
    missingPolicyNormalizeScripts.length === 0,
    `Root policy generation scripts must normalize policy artifacts:\n${missingPolicyNormalizeScripts.join(
      '\n',
    )}`,
  );

  const rootScriptRequirements = {
    'lavamoat:review': ['development/lavamoat/split-policy-for-review.cjs'],
    'lavamoat:normalize-policies': [
      'development/lavamoat/normalize-policy-artifacts.cjs',
    ],
    'lavamoat:validate-artifacts': [
      'development/lavamoat/validate-policy-artifacts.cjs',
    ],
    'lavamoat:validate-generated-scope': [
      'development/lavamoat/check-generated-file-scope.cjs',
    ],
    'lavamoat:validate-webpack-integration': [
      'development/lavamoat/validate-webpack-integration.cjs',
    ],
    'lavamoat:test-tooling': [
      'development/lavamoat/test-tooling.cjs',
      'lavamoat:validate-webpack-integration',
    ],
    'lavamoat:diff': ['development/lavamoat/check-policy-diff.cjs'],
    'lavamoat:ci:validate': [
      'lavamoat:test-tooling',
      'lavamoat:policy:all',
      'lavamoat:validate-artifacts',
      'lavamoat:validate-generated-scope',
      'lavamoat:diff',
    ],
    'lavamoat:ci:build': ['lavamoat:build:all'],
    'lavamoat:ci:all': ['lavamoat:ci:validate', 'lavamoat:ci:build'],
  };

  const missingScriptSnippets = [];
  for (const [scriptName, snippets] of Object.entries(rootScriptRequirements)) {
    for (const snippet of snippets) {
      if (!scripts[scriptName].includes(snippet)) {
        missingScriptSnippets.push(`${scriptName}: ${snippet}`);
      }
    }
  }

  assert(
    missingScriptSnippets.length === 0,
    `Root LavaMoat scripts are missing required command snippets:\n${missingScriptSnippets.join(
      '\n',
    )}`,
  );

  const forbiddenRootScripts = Object.entries(scripts)
    .filter(([scriptName]) => scriptName.startsWith('lavamoat:'))
    .flatMap(([scriptName, scriptValue]) => {
      const scriptText = `${scriptName} ${scriptValue}`.toLowerCase();
      return disabledRootScriptFragments
        .filter((fragment) => scriptText.includes(fragment))
        .map((fragment) => `${scriptName}: ${fragment}`);
    });

  assert(
    forbiddenRootScripts.length === 0,
    `Root package.json should not define LavaMoat scripts for disabled targets:\n${forbiddenRootScripts.join(
      '\n',
    )}`,
  );

  for (const target of enabledTargets) {
    const workspacePackageFile = path.join(repoRoot, target.workspacePackageJson || '');
    assert(
      target.workspacePackageJson && fs.existsSync(workspacePackageFile),
      `Missing workspace package.json for enabled target ${target.id}: ${target.workspacePackageJson}`,
    );

    const workspaceScripts = readJson(workspacePackageFile).scripts || {};
    const missingWorkspaceScripts = [
      target.workspacePolicyScript,
      target.workspaceBuildScript,
    ].filter((script) => !workspaceScripts[script]);

    assert(
      missingWorkspaceScripts.length === 0,
      `Workspace package ${target.workspacePackageJson} is missing LavaMoat scripts for ${target.id}:\n${missingWorkspaceScripts.join(
        '\n',
      )}`,
    );

    const workspacePackage = readJson(workspacePackageFile);
    const workspaceDependencies = workspacePackage.dependencies || {};
    const missingWorkspaceDependencies = (target.workspaceDependencies || []).filter(
      (dependency) => workspaceDependencies[dependency] !== '*',
    );

    assert(
      missingWorkspaceDependencies.length === 0,
      `Workspace package ${target.workspacePackageJson} is missing LavaMoat-readable workspace dependencies for ${target.id}:\n${missingWorkspaceDependencies.join(
        '\n',
      )}`,
    );
  }

  for (const packageJson of disabledWorkspacePackageJsons) {
    const workspacePackageFile = path.join(repoRoot, packageJson);
    assert(
      fs.existsSync(workspacePackageFile),
      `Missing disabled workspace package.json: ${packageJson}`,
    );

    const workspaceScripts = readJson(workspacePackageFile).scripts || {};
    const forbiddenScripts = Object.entries(workspaceScripts)
      .filter(([scriptName, scriptValue]) =>
        /lavamoat|ONEKEY_LAVAMOAT/i.test(`${scriptName} ${scriptValue}`),
      )
      .map(([scriptName]) => scriptName);

    assert(
      forbiddenScripts.length === 0,
      `Disabled workspace package ${packageJson} should not define LavaMoat scripts:\n${forbiddenScripts.join(
        '\n',
      )}`,
    );
  }
}

function validateWorkflowCoverage() {
  const validateWorkflowFile = path.join(
    repoRoot,
    '.github/workflows/validate-lavamoat-policies.yml',
  );
  const updateWorkflowFile = path.join(
    repoRoot,
    '.github/workflows/update-lavamoat-policies.yml',
  );
  assert(
    fs.existsSync(validateWorkflowFile),
    'Missing LavaMoat validation workflow',
  );
  assert(fs.existsSync(updateWorkflowFile), 'Missing LavaMoat update workflow');

  const validateWorkflow = fs.readFileSync(validateWorkflowFile, 'utf8');
  const updateWorkflow = fs.readFileSync(updateWorkflowFile, 'utf8');
  const validateContentsWritePermissions =
    validateWorkflow.match(/^\s*contents:\s*write\s*$/gm) || [];
  assert(
    validateContentsWritePermissions.length === 0,
    'validate-lavamoat-policies.yml must remain read-only and must not request contents: write',
  );

  const updateContentsWritePermissions =
    updateWorkflow.match(/^\s*contents:\s*write\s*$/gm) || [];
  assert(
    updateContentsWritePermissions.length === 1,
    `update-lavamoat-policies.yml should grant contents: write exactly once, got ${updateContentsWritePermissions.length}`,
  );

  const workflowIfSecrets = [validateWorkflowFile, updateWorkflowFile].flatMap(
    (file) => {
      return fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line, index) => ({ file: relative(file), line, lineNumber: index + 1 }))
        .filter(({ line }) => /^\s*if:\s.*secrets\./.test(line));
    },
  );
  assert(
    workflowIfSecrets.length === 0,
    `Workflow if conditions should not reference secrets directly:\n${workflowIfSecrets
      .map(({ file, lineNumber, line }) => `${file}:${lineNumber}: ${line.trim()}`)
      .join('\n')}`,
  );

  const requiredValidateWorkflowSnippets = [
    '# Keep validation read-only.',
    'permissions:\n  contents: read\n  packages: read',
    'yarn lavamoat:test-tooling',
    'yarn lavamoat:policy:all',
    'yarn lavamoat:validate-artifacts',
    'yarn lavamoat:validate-generated-scope',
    'development/lavamoat/check-policy-diff.cjs',
    'lavamoat-policy-diff-all.patch',
    'actions/upload-artifact@v4',
    'name: lavamoat-policy-diff-all',
    'path: lavamoat-policy-diff-all.patch',
    "failure() && steps.check-working-tree.outcome == 'failure'",
    ...enabledTargets.map(
      (target) => `yarn lavamoat:build:${target.scriptSuffix}`,
    ),
  ];
  const missingValidateWorkflowSnippets = requiredValidateWorkflowSnippets.filter(
    (snippet) => !validateWorkflow.includes(snippet),
  );
  assert(
    missingValidateWorkflowSnippets.length === 0,
    `validate-lavamoat-policies.yml is missing required commands:\n${missingValidateWorkflowSnippets.join(
      '\n',
    )}`,
  );

  const requiredUpdateWorkflowSnippets = [
    '# Keep the default token read-only.',
    'permissions:\n  contents: read',
    'permissions:\n      actions: read\n      contents: read\n      issues: write\n      pull-requests: read',
    'This is the only job that can push policy updates back to a PR branch.',
    'permissions:\n      actions: read\n      contents: write\n      issues: write\n      pull-requests: read',
    "startsWith(github.event.comment.body, '@onekeybot update-policies')",
    'github.event.issue.pull_request',
    'author_association',
    'OWNER|MEMBER|COLLABORATOR',
    'isCrossRepository',
    'LavaMoat policy auto-update is disabled for cross-repository pull requests',
    'validate-lavamoat-policies.yml',
    'ONEKEYBOT_GITHUB_TOKEN',
    'secrets.ONEKEYBOT_GITHUB_TOKEN || secrets.GITHUB_TOKEN',
    'Falling back to GITHUB_TOKEN',
    'manually re-run or approve CI',
    'gh run view',
    'actions/download-artifact@v4',
    'path: lavamoat-policy-diffs',
    'pattern: lavamoat-policy-diff-*',
    'merge-multiple: true',
    'run-id: ${{ env.RUN_ID }}',
    'lavamoat-policy-diffs/*.patch',
    'git apply --whitespace=error',
    'node development/lavamoat/check-generated-file-scope.cjs',
    'node development/lavamoat/validate-policy-artifacts.cjs',
    'git add lavamoat',
    'git push origin "HEAD:${HEAD_REF_NAME}"',
  ];
  const missingUpdateWorkflowSnippets = requiredUpdateWorkflowSnippets.filter(
    (snippet) => !updateWorkflow.includes(snippet),
  );
  assert(
    missingUpdateWorkflowSnippets.length === 0,
    `update-lavamoat-policies.yml is missing required commands:\n${missingUpdateWorkflowSnippets.join(
      '\n',
    )}`,
  );
}

function validateToolFiles() {
  const missingToolFiles = requiredToolFiles.filter(
    (file) => !fs.existsSync(path.join(repoRoot, file)),
  );

  assert(
    missingToolFiles.length === 0,
    `Missing LavaMoat tool files:\n${missingToolFiles.join('\n')}`,
  );
}

function validateNoForbiddenLocalPaths() {
  const textFiles = walk(lavamoatRoot).filter(
    (file) => file.endsWith('.json') || file.endsWith('.md'),
  );
  for (const file of textFiles) {
    if (file.endsWith('.json')) {
      const json = readJson(file);
      const stringEntries = collectStrings(json);
      for (const { path: jsonPath, value } of stringEntries) {
        for (const { label, pattern } of forbiddenLocalPathPatterns) {
          if (pattern.test(value)) {
            throw new Error(
              `Forbidden ${label} in ${relative(file)} at ${jsonPath}: ${value}`,
            );
          }
        }
      }
      continue;
    }

    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const { label, pattern } of forbiddenLocalPathPatterns) {
        if (pattern.test(line)) {
          throw new Error(
            `Forbidden ${label} in ${relative(file)}:${index + 1}: ${line}`,
          );
        }
      }
    }
  }
}

function validateNoForbiddenSidecarFiles() {
  const forbiddenFiles = walk(lavamoatRoot)
    .map((file) => relative(file))
    .filter((file) => {
      return forbiddenSidecarFilePatterns.some((pattern) => pattern.test(file));
    });

  assert(
    forbiddenFiles.length === 0,
    `Forbidden LavaMoat debug or sidecar files found:\n${forbiddenFiles.join(
      '\n',
    )}`,
  );
}

function validateCanonicalPolicyJson() {
  for (const relativeFile of [...expectedPolicyFiles, ...expectedOverrideFiles]) {
    const file = path.join(lavamoatRoot, relativeFile);
    const original = fs.readFileSync(file, 'utf8');
    const canonical = `${JSON.stringify(
      sortObject(JSON.parse(original)),
      null,
      2,
    )}\n`;

    assert(
      original === canonical,
      `${relativeFile} is not normalized. Run yarn lavamoat:normalize-policies.`,
    );
  }
}

validateExpectedPolicies();
validateDisabledTargetDirs();
validateReviewSummary();
validateReviewFiles();
validateReadmeTargetCoverage();
validateRootScripts();
validateWorkflowCoverage();
validateToolFiles();
validateCanonicalPolicyJson();
validateNoForbiddenSidecarFiles();
validateNoForbiddenLocalPaths();

console.log('LavaMoat policy artifacts validated.');
