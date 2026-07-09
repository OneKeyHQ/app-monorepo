const DEFAULT_CONSTRAINTS = [
  'Do not relax CI rules, budgets, thresholds, or test assertions unless the issue proves they are wrong.',
  'Prefer a focused code fix over broad ignores, retries, sleeps, or workflow-only masking.',
  'Keep generated diagnostics and raw reports intact so future runs remain comparable.',
  'Validate with the listed focused command, then run yarn agent:check --profile commit for changed TypeScript files.',
];

const RUNTIME_NOTES = {
  ciOnly:
    'Scope: CI-only diagnostics. This helper does not change app runtime behavior, native resources, or per-runtime JS heap state.',
  native:
    'Runtime scope: label impact as main UI JS runtime, background JS runtime, or both. Production main/background JS runtimes are isolated JS heaps in the same native process; native resources may be shared, but JS objects are per-runtime copies.',
};

const ciFailureConfigs = {
  lint: {
    label: 'lint-failure',
    titlePrefix: 'Lint check failed',
    summary: 'The lint workflow found errors.',
    artifactName: 'ci-ai-lint-diagnostics',
    promptIntro:
      'Fix the OneKey PR lint failure by identifying which lint subcheck failed and addressing the root cause.',
    diagnostics: [
      'Download the ci-ai-lint-diagnostics artifact and inspect lint-output.log before forming a hypothesis.',
      'Identify the failing subcheck: TypeScript, ESLint/oxlint, Electron rules, i18n/lang, package versions, or font checks.',
      'For TypeScript/import errors, verify package hierarchy: shared cannot import OneKey packages, components only imports shared, kit-bg only imports shared/core, and kit may import shared/components/kit-bg.',
      'For i18n failures, do not edit generated translation files; fix source keys or follow the i18n workflow.',
    ],
    commands: [
      'yarn install --immutable',
      'yarn lint',
      'yarn agent:check --profile commit',
    ],
    constraints: [
      'Do not weaken lint scripts, folder rules, i18n checks, package-version checks, or font checks.',
      'Do not bypass TypeScript with any, @ts-ignore, or generated-file edits unless there is a documented repo-approved reason.',
    ],
    runtimeNotes: [RUNTIME_NOTES.ciOnly],
  },
  eslint: {
    label: 'eslint-failure',
    titlePrefix: 'Nightly ESLint check failed',
    summary: 'The nightly ESLint check found errors or warnings.',
    artifactName: 'ci-ai-eslint-diagnostics',
    promptIntro:
      'Fix the OneKey nightly ESLint failure by addressing the reported lint findings directly.',
    diagnostics: [
      'Download the ci-ai-eslint-diagnostics artifact and inspect eslint-output.log first.',
      'If the log is truncated in the GitHub UI, use the artifact copy before forming a hypothesis.',
      'Group findings by file and rule; fix the root cause before considering any scoped disable.',
      'Check whether the failing rule indicates a real runtime, typing, import-hierarchy, or security problem.',
    ],
    commands: [
      'yarn install --immutable',
      'NODE_OPTIONS=--max_old_space_size=8192 npx eslint . --ext .ts,.tsx --max-warnings 0',
      'yarn agent:check --profile commit',
    ],
    constraints: [
      'Do not add global ESLint ignores or blanket eslint-disable comments.',
      'Use targeted disables only when there is a documented false positive and no clearer code shape.',
    ],
    runtimeNotes: [RUNTIME_NOTES.ciOnly],
  },
  unittest: {
    label: 'unit-test-failure',
    titlePrefix: 'Unit tests failed',
    summary: 'The unit test workflow found failing tests.',
    artifactName: 'ci-ai-unittest-diagnostics-shard-*',
    promptIntro:
      'Fix the OneKey Jest unit test failure by starting from the failing shard log and preserving test coverage intent.',
    diagnostics: [
      'Download the matching ci-ai-unittest-diagnostics-shard-* artifact and inspect jest-shard-*.log first.',
      'Use test-report.html for the same shard when the raw log does not show the full assertion context.',
      'Identify whether the failure is assertion behavior, async timing, module mocking, snapshot drift, TypeScript transform, or environment setup.',
      'For storage, startup, native, or background-service tests, explicitly label whether the behavior concerns main runtime, background runtime, both, or test-only setup.',
    ],
    commands: [
      'yarn install --immutable',
      'FAILED_SHARD=1',
      `yarn test --coverage --shard="\${FAILED_SHARD}/3" --coverageDirectory="coverage/shard-\${FAILED_SHARD}" --coverageReporters=text --coverageReporters=lcov --coverageReporters=json-summary --coverageReporters=json --coverageThreshold={}`,
      'yarn agent:check --profile commit',
    ],
    constraints: [
      'Do not delete or weaken assertions to make the shard pass.',
      'Keep mocks scoped to the failing behavior; avoid broad global mock changes unless the failure is shared setup.',
    ],
    runtimeNotes: [RUNTIME_NOTES.native],
  },
  'security-checks': {
    label: 'security-check-failure',
    titlePrefix: 'Security checks failed',
    summary:
      'The security checks workflow found a supply-chain policy failure.',
    artifactName: 'ci-ai-security-checks-diagnostics',
    promptIntro:
      'Fix the OneKey supply-chain security check without bypassing the minimum release age policy.',
    diagnostics: [
      'Download the ci-ai-security-checks-diagnostics artifact and inspect minimum-release-age.log first.',
      'Check whether the failure is a newly introduced package, a registry metadata lookup problem, a lockfile diff parse issue, or an allowed OneKey package.',
      'Inspect package provenance, version age, maintainer/package history, and whether the dependency is actually required.',
      'If the change is a package upgrade, review source compatibility and transitive dependency risk before proposing an allowlist change.',
    ],
    commands: [
      'yarn install --immutable',
      `BASE_REF="\${GITHUB_BASE_REF:-x}"`,
      `npx tsx development/scripts/minimum-release-age/run.ts diff "origin/\${BASE_REF}"`,
      'yarn agent:check --profile commit',
    ],
    constraints: [
      'Do not disable blockOnFailure or lower minimumReleaseAge.days.',
      'Do not add an allowlist entry unless the package is trusted and the security rationale is explicit.',
      'Never commit secrets, tokens, private keys, mnemonics, or credentials while investigating package changes.',
    ],
    runtimeNotes: [RUNTIME_NOTES.ciOnly],
  },
  'bundle-architecture': {
    label: 'bundle-architecture',
    titlePrefix: 'Bundle architecture check failed',
    summary: 'The nightly bundle architecture check failed.',
    artifactName: 'allocation-reports',
    promptIntro:
      'Fix the OneKey native bundle architecture failure without weakening bundle split rules.',
    diagnostics: [
      'Download the allocation-reports artifact and inspect bundle-architecture-check.log plus allocation-report-*.json.',
      'Start from ERROR lines, then trace which sync import or segment assignment pulled forbidden code into common, main, or background.',
      'For main/common regressions, inspect startup.modules, violations, and segment-manifest*.json before changing code.',
      'If a native/storage/startup path is involved, explicitly label whether the impact is main, background, or both.',
    ],
    commands: [
      'yarn install --immutable',
      'cd apps/mobile',
      'ENABLE_NATIVE_BACKGROUND_THREAD=true UNION_BUILD=true NODE_OPTIONS=--max_old_space_size=8192 node scripts/unionBuild.js --platform ios --common-bundle-output dist-ci/common.jsbundle --common-sourcemap-output dist-ci/common.jsbundle.map --main-bundle-output dist-ci/main.jsbundle --main-sourcemap-output dist-ci/main.jsbundle.map --background-bundle-output dist-ci/background.bundle.js --background-sourcemap-output dist-ci/background.bundle.map --assets-dest dist-ci/assets',
      'node scripts/check-bundle-architecture.js',
    ],
    constraints: [
      'Do not relax BUDGETS, FORBIDDEN_IN_MAIN, FORBIDDEN_NPM_IN_MAIN, or FORBIDDEN_NPM_IN_COMMON to make CI green.',
      'Move non-startup or background-only work behind the correct lazy/runtime boundary while preserving behavior.',
    ],
    runtimeNotes: [RUNTIME_NOTES.native],
  },
  'react-native-unittest': {
    label: 'rn-unittest-failure',
    titlePrefix: 'Nightly RN unit tests failed',
    summary: 'The nightly React Native harness test run failed.',
    artifactName: 'ci-ai-rn-unittest-diagnostics',
    promptIntro:
      'Fix the OneKey React Native harness failure by diagnosing the emulator, app, and test logs together.',
    diagnostics: [
      'Download the ci-ai-rn-unittest-diagnostics artifact and inspect react-native-harness-android.log before reading logcat-tail.txt.',
      'Use app-logcat.txt for OneKey, ReactNative, AndroidRuntime, fatal, crash, and WebSocket lines.',
      'Classify the failure as test assertion, app crash, emulator/device setup, Gradle/APK build, or infrastructure before editing code.',
      'If the failure involves startup, storage, native modules, or background services, explicitly label main/background/both runtime impact.',
    ],
    commands: [
      'yarn install --immutable',
      'cd apps/mobile',
      'yarn harness:test:android',
      'yarn agent:check --profile commit',
    ],
    constraints: [
      'Do not skip harness tests, reduce assertions, or hide crashes with retries before identifying the failure boundary.',
      'Keep hardware wallet and background-service isolation intact when changing native or background code.',
    ],
    runtimeNotes: [RUNTIME_NOTES.native],
  },
};

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function compactSha(sha) {
  return sha ? sha.slice(0, 10) : 'unknown';
}

function getRunUrl(context) {
  return `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
}

function getEnvRunUrl(env) {
  const serverUrl = env.GITHUB_SERVER_URL || 'https://github.com';
  const repository = env.GITHUB_REPOSITORY || '';
  const runId = env.GITHUB_RUN_ID || '';
  return repository && runId
    ? `${serverUrl}/${repository}/actions/runs/${runId}`
    : '';
}

function metadataFromContext(context) {
  return {
    artifactName: null,
    eventName: context.eventName,
    ref: context.ref,
    runId: context.runId,
    runNumber: context.runNumber,
    runUrl: getRunUrl(context),
    sha: context.sha,
    workflow: context.workflow,
  };
}

function metadataFromEnv(env = process.env) {
  return {
    artifactName: null,
    eventName: env.GITHUB_EVENT_NAME || '',
    ref: env.GITHUB_REF_NAME || env.GITHUB_REF || '',
    runId: env.GITHUB_RUN_ID || '',
    runNumber: env.GITHUB_RUN_NUMBER || '',
    runUrl: getEnvRunUrl(env),
    sha: env.GITHUB_SHA || '',
    workflow: env.GITHUB_WORKFLOW || '',
  };
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function commandBlock(commands) {
  return ['```bash', ...commands, '```'].join('\n');
}

function renderRunMetadata(config, metadata) {
  const lines = [];
  if (metadata.workflow) lines.push(`- Workflow: \`${metadata.workflow}\``);
  if (metadata.runNumber || metadata.runUrl) {
    const runLabel = metadata.runNumber ? `#${metadata.runNumber}` : 'run';
    const runText = metadata.runUrl
      ? `[${runLabel}](${metadata.runUrl})`
      : runLabel;
    lines.push(`- Run: ${runText}`);
  }
  if (metadata.ref) lines.push(`- Ref: \`${metadata.ref}\``);
  if (metadata.sha) lines.push(`- SHA: \`${compactSha(metadata.sha)}\``);
  if (metadata.eventName) lines.push(`- Event: \`${metadata.eventName}\``);
  if (config.artifactName || metadata.artifactName) {
    lines.push(
      `- Diagnostic artifact: \`${metadata.artifactName || config.artifactName}\``,
    );
  }
  return lines.length ? lines.join('\n') : '- Run metadata unavailable.';
}

function renderAiTriagePrompt(config, metadata = {}) {
  const combinedConstraints = [
    ...DEFAULT_CONSTRAINTS,
    ...(config.constraints || []),
  ];

  return [
    '## AI Triage Prompt',
    '',
    config.promptIntro,
    '',
    '### Run Context',
    renderRunMetadata(config, metadata),
    '',
    '### Runtime Scope',
    bulletList(config.runtimeNotes || [RUNTIME_NOTES.ciOnly]),
    '',
    '### Start Here',
    bulletList(config.diagnostics || []),
    '',
    '### Reproduce / Validate',
    commandBlock(config.commands || []),
    '',
    '### Guardrails',
    bulletList(combinedConstraints),
  ].join('\n');
}

function renderIssueBody(config, metadata) {
  return [
    config.summary,
    '',
    `[View workflow run](${metadata.runUrl})`,
    '',
    renderAiTriagePrompt(config, metadata),
  ].join('\n');
}

function renderStillFailingComment(config, metadata) {
  return [
    `Still failing: [Run #${metadata.runNumber}](${metadata.runUrl}) on \`${compactSha(metadata.sha)}\`.`,
    '',
    `Diagnostic artifact: \`${config.artifactName}\``,
    'Use the issue body for the full AI triage prompt and guardrails.',
  ].join('\n');
}

async function upsertCiFailureIssue({ github, context, config }) {
  const metadata = metadataFromContext(context);
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    labels: config.label,
    state: 'open',
    per_page: 100,
  });

  if (issues.length > 0) {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issues[0].number,
      body: renderStillFailingComment(config, metadata),
    });
    return { action: 'commented', issueNumber: issues[0].number };
  }

  const { data: issue } = await github.rest.issues.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: `${config.titlePrefix} on ${todayIsoDate()}`,
    body: renderIssueBody(config, metadata),
    labels: [config.label],
  });
  return { action: 'created', issueNumber: issue.number };
}

function printPrompt(configName) {
  const config = ciFailureConfigs[configName];
  if (!config) {
    const names = Object.keys(ciFailureConfigs).join(', ');
    console.error(
      `Unknown CI failure config "${configName}". Expected one of: ${names}`,
    );
    return false;
  }
  process.stdout.write(`${renderAiTriagePrompt(config, metadataFromEnv())}\n`);
  return true;
}

if (require.main === module) {
  const [command, configName] = process.argv.slice(2);
  if (command !== 'prompt' || !configName) {
    console.error(
      `Usage: node .github/scripts/ciFailureIssue.js prompt <${Object.keys(
        ciFailureConfigs,
      ).join('|')}>`,
    );
    process.exit(1);
  }

  if (!printPrompt(configName)) {
    process.exit(1);
  }
}

module.exports = {
  ciFailureConfigs,
  renderAiTriagePrompt,
  renderIssueBody,
  renderStillFailingComment,
  upsertCiFailureIssue,
};
