#!/usr/bin/env node
/* eslint-disable onekey/no-raw-error */
const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');

const HERMES_MAGIC = Buffer.from('c61fbc03c103191f', 'hex');
const TAG = '[MobileLockdownE2E] ';

function inspectReleaseArtifacts(directory, runId) {
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      assert.ok(
        !entry.isSymbolicLink(),
        'Release artifacts must not contain symlinks',
      );
      const filename = path.join(current, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile() && /\.(?:hbc|bundle)$/.test(filename))
        files.push(filename);
    }
  };
  visit(directory);
  for (const required of [
    'common.bundle',
    'main.jsbundle.hbc',
    'background.bundle',
  ]) {
    assert.ok(
      files.includes(path.join(directory, required)),
      `Missing native Release artifact: ${required}`,
    );
  }
  const records = files.map((filename) => {
    const data = fs.readFileSync(filename);
    assert.ok(
      data.subarray(0, 8).equals(HERMES_MAGIC),
      `Expected real Hermes bytecode: ${filename}`,
    );
    const hasProbe =
      data.includes(Buffer.from('MobileLockdownE2E')) ||
      data.includes(Buffer.from('onekey-mobile-lockdown-release-segment-v1'));
    if (!runId)
      assert.ok(!hasProbe, 'Default Release artifact contains E2E probe code');
    return {
      file: path.relative(directory, filename),
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
      containsRunId: Boolean(runId && data.includes(Buffer.from(runId))),
    };
  });
  if (runId)
    assert.ok(
      records.some((record) => record.containsRunId),
      'Release artifacts do not contain the expected E2E run ID',
    );
  return records;
}

function parseRuntimeRecords(log, runId, tag = TAG) {
  return log
    .split('\n')
    .filter((line) => line.includes(tag))
    .map((line) => JSON.parse(line.slice(line.indexOf(tag) + tag.length)))
    .filter((record) => record.runId === runId);
}

function validateReleaseRecords(log, { runId, platform, artifacts }) {
  assert.match(runId, /^[a-f0-9]{32}$/);
  assert.ok(['ios', 'android'].includes(platform));
  const records = parseRuntimeRecords(log, runId);
  assert.deepEqual(
    records.map((record) => record.runtime).toSorted(),
    ['background', 'main'],
    'Require exactly one result from each independent native heap',
  );
  for (const record of records) {
    assert.equal(
      record.status,
      'passed',
      `${record.runtime}: Release probe failed`,
    );
    assert.equal(record.platform, platform);
    assert.equal(record.sourceKind, 'builtin');
    assert.ok(
      typeof record.nativeVersion === 'string' &&
        record.nativeVersion.length > 0,
    );
    const integrity = record.integrity;
    assert.equal(integrity.runtime, record.runtime);
    assert.equal(integrity.evalTaming, 'unsafe-eval');
    for (const key of [
      'enabled',
      'lockdownApplied',
      'stateFrozen',
      'bindingImmutable',
      'objectFrozen',
      'arrayFrozen',
      'functionFrozen',
      'promiseFrozen',
      'hardenPresent',
      'tamperBlocked',
    ]) {
      assert.equal(integrity[key], true, `${record.runtime}: ${key} failed`);
    }
    assert.deepEqual(record.asyncDelivery, {
      promise: true,
      timer: true,
      nextTick: true,
    });
    assert.equal(record.segment.loaded, true);
    assert.match(record.segment.sha256Prefix, /^[a-f0-9]{16}$/);
    assert.ok(
      artifacts.some(
        (artifact) =>
          artifact.file.includes('mobileLockdownReleaseMarker') &&
          artifact.sha256.startsWith(record.segment.sha256Prefix),
      ),
      'Device marker must correspond to a host-verified artifact',
    );
  }
  assert.equal(records[0].nativeVersion, records[1].nativeVersion);
  for (const key of ['version', 'bundleVersion', 'buildNumber']) {
    assert.equal(
      typeof records[0][key],
      'string',
      `Missing build identity: ${key}`,
    );
    assert.equal(
      records[0][key],
      records[1][key],
      `Mismatched per-heap build identity: ${key}`,
    );
  }
  const mounts = parseRuntimeRecords(
    log,
    runId,
    '[MobileLockdownWebEmbedMountE2E] ',
  );
  assert.deepEqual(
    mounts,
    [{ runId, runtime: 'main', status: 'requested', providerReady: true }],
    'Native WebEmbed provider readiness request is missing',
  );
  const webEmbed = parseRuntimeRecords(
    log,
    runId,
    '[MobileLockdownWebEmbedE2E] ',
  );
  assert.deepEqual(
    webEmbed,
    [
      {
        runId,
        runtime: 'background',
        status: 'passed',
        fileBridge: false,
        bridgeSource:
          platform === 'android' ? 'bundled-https' : 'bundled-scheme',
        intrinsics: true,
        kaspaUnsigned: true,
        kaspaRuns: 2,
      },
    ],
    'Protected native packaged WebEmbed acceptance is missing',
  );
  assert.doesNotMatch(
    log,
    /\[JSError\]|FATAL EXCEPTION|Fatal signal|Unhandled (?:JS Exception|promise rejection)|JavascriptException/iu,
    'Native application errors remain in this run',
  );
  return { runtimes: records, webEmbedMount: mounts[0], webEmbed: webEmbed[0] };
}

function main() {
  const { values } = parseArgs({
    options: {
      artifacts: { type: 'string' },
      platform: { type: 'string' },
      'run-id': { type: 'string' },
      'native-log': { type: 'string' },
      output: { type: 'string' },
    },
  });
  assert.ok(
    values.artifacts,
    'Usage: check-mobile-lockdown-release.js --artifacts <native-dist> [--run-id <id> --platform ios|android --native-log <isolated-run-log> --output <report.json>]',
  );
  const runId = values['run-id'];
  if (runId) assert.match(runId, /^[a-f0-9]{32}$/);
  const artifacts = inspectReleaseArtifacts(
    fs.realpathSync(values.artifacts),
    runId,
  );
  let runtime;
  if (runId) {
    assert.ok(
      values['native-log'] && values.platform,
      'E2E acceptance requires the isolated native run log and platform',
    );
    runtime = validateReleaseRecords(
      fs.readFileSync(values['native-log'], 'utf8'),
      { runId, platform: values.platform, artifacts },
    );
  } else
    assert.ok(
      !values['native-log'],
      'A native E2E log requires an explicit run ID',
    );
  const report = {
    status: 'passed',
    observedAt: new Date().toISOString(),
    runId,
    artifacts,
    runtime,
  };
  if (values.output)
    fs.writeFileSync(values.output, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
  console.log(
    `[mobile-lockdown] Release ${runId ? 'runtime and artifacts' : 'default probe exclusion'} passed.`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
module.exports = { inspectReleaseArtifacts, validateReleaseRecords };
