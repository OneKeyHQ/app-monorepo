// Decide whether a release-desktop-all dispatch may sign Windows artifacts.
//
// The dispatch only carries an upstream run id. That id is a pointer, never an
// authorization: this script reads GitHub's own run and commit records and
// verifies that the daily-build workflow really ran for the repository, branch,
// and commit being packaged.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const DAILY_BUILD_WORKFLOW_PATH = '.github/workflows/daily-build.yml';
// `compare` statuses where the upstream commit is the packaged commit or one of
// its ancestors, i.e. the packaged branch contains what daily-build built.
const ACCEPTED_COMPARE_STATUSES = new Set(['ahead', 'identical']);

class SigningProvenanceError extends Error {}

function ghApi(args) {
  return execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function fetchRun({ repository, runId }) {
  return JSON.parse(ghApi([`repos/${repository}/actions/runs/${runId}`]));
}

function fetchCompareStatus({ repository, base, head }) {
  return ghApi([
    `repos/${repository}/compare/${base}...${head}`,
    '--jq',
    '.status',
  ]).trim();
}

function requireRunField(run, field, fallback) {
  const value = field.split('.').reduce((current, key) => current?.[key], run);
  if (typeof value !== 'string' || value === '') {
    throw new SigningProvenanceError(
      `Upstream run is missing ${field}${fallback ? ` (${fallback})` : ''}`,
    );
  }
  return value;
}

function verifyDailyBuildRun({
  runId,
  repository,
  refName,
  sha,
  fetchRun: fetchRunImpl = fetchRun,
  fetchCompareStatus: fetchCompareStatusImpl = fetchCompareStatus,
  log = console.log,
}) {
  if (repository === '') {
    throw new SigningProvenanceError('GITHUB_REPOSITORY is required');
  }
  if (refName === '') {
    throw new SigningProvenanceError('GITHUB_REF_NAME is required');
  }
  if (sha === '') {
    throw new SigningProvenanceError('GITHUB_SHA is required');
  }
  if (runId === '') {
    log(
      'No upstream_run_id input; Windows signing stays limited to release refs.',
    );
    return false;
  }
  if (!/^\d+$/u.test(runId)) {
    throw new SigningProvenanceError(
      `upstream_run_id must be numeric, got "${runId}"`,
    );
  }

  let runRecord;
  try {
    runRecord = fetchRunImpl({ repository, runId });
  } catch (error) {
    throw new SigningProvenanceError(
      `Failed to read run ${runId}: ${error.message}`,
    );
  }

  const workflowPath = requireRunField(runRecord, 'path');
  const headRepository = requireRunField(
    runRecord,
    'head_repository.full_name',
  );
  const headBranch = requireRunField(runRecord, 'head_branch');
  const headSha = requireRunField(runRecord, 'head_sha');

  if (workflowPath !== DAILY_BUILD_WORKFLOW_PATH) {
    throw new SigningProvenanceError(
      `Run ${runId} is not a daily-build run (${workflowPath})`,
    );
  }
  if (headRepository !== repository) {
    throw new SigningProvenanceError(
      `Run ${runId} belongs to ${headRepository}, not ${repository}`,
    );
  }
  if (headBranch !== refName) {
    throw new SigningProvenanceError(
      `Run ${runId} built ${headBranch}, but this dispatch packages ${refName}`,
    );
  }

  if (headSha !== sha) {
    let compareStatus;
    try {
      compareStatus = fetchCompareStatusImpl({
        repository,
        base: headSha,
        head: sha,
      });
    } catch (error) {
      throw new SigningProvenanceError(
        `Failed to compare ${headSha} with ${sha}: ${error.message}`,
      );
    }
    if (!ACCEPTED_COMPARE_STATUSES.has(compareStatus)) {
      throw new SigningProvenanceError(
        `Run ${runId} built ${headSha} (${compareStatus}), which is not an ancestor of ${sha}`,
      );
    }
  }

  log(`Verified daily-build run ${runId} for ${refName}@${sha}.`);
  return true;
}

function writeGithubOutput(path, name, value) {
  if (path === undefined || path === '') {
    throw new SigningProvenanceError('GITHUB_OUTPUT is required');
  }
  fs.appendFileSync(path, `${name}=${value}\n`);
}

function main() {
  try {
    const verified = verifyDailyBuildRun({
      runId: process.env.UPSTREAM_RUN_ID ?? '',
      repository: process.env.GITHUB_REPOSITORY ?? '',
      refName: process.env.GITHUB_REF_NAME ?? '',
      sha: process.env.GITHUB_SHA ?? '',
    });
    writeGithubOutput(process.env.GITHUB_OUTPUT, 'upstream_verified', verified);
  } catch (error) {
    if (error instanceof SigningProvenanceError) {
      console.error(`::error::${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ACCEPTED_COMPARE_STATUSES,
  DAILY_BUILD_WORKFLOW_PATH,
  SigningProvenanceError,
  verifyDailyBuildRun,
};
