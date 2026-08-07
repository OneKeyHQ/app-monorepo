import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const abortController = new AbortController();
const abort = () => abortController.abort();
process.once('SIGINT', abort);
process.once('SIGTERM', abort);

const workspace = await fs.realpath(
  process.argv[process.argv.indexOf('--workspace') + 1],
);

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function relative(file) {
  return path.relative(workspace, file).split(path.sep).join('/');
}

async function workspaceFile(file, label) {
  if (typeof file !== 'string' || !file || path.isAbsolute(file)) {
    throw new Error(`${label} must be a relative workspace file`);
  }
  const candidate = path.resolve(workspace, file);
  const candidateRelative = path.relative(workspace, candidate);
  if (
    !candidateRelative ||
    candidateRelative === '..' ||
    candidateRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(candidateRelative)
  ) {
    throw new Error(`${label} escapes the selected workspace`);
  }
  const resolved = await fs.realpath(candidate);
  const resolvedRelative = path.relative(workspace, resolved);
  if (
    !resolvedRelative ||
    resolvedRelative === '..' ||
    resolvedRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(resolvedRelative)
  ) {
    throw new Error(`${label} escapes the selected workspace`);
  }
  return resolved;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '127.0.0.1';
  } catch {
    return false;
  }
}

function parseProtocols(registryText, source, registrySha256) {
  const value = JSON.parse(registryText);
  const seenHostnames = new Set();
  return (Array.isArray(value.protocols) ? value.protocols : []).flatMap(
    (protocol) => {
      const id = String(protocol?.id || '').trim();
      const override = String(protocol?.target?.urlOverride || '');
      const resolved = String(protocol?.target?.resolvedDappUrl || '');
      const registryUrl = String(protocol?.sourceUrl || '');
      const url = override || resolved || registryUrl;
      if (!id || !safeUrl(url)) return [];
      const hostname = new URL(url).hostname.replace(/^www\./u, '');
      if (seenHostnames.has(hostname)) return [];
      seenHostnames.add(hostname);
      const state = ['processed', 'unsupported'].includes(
        protocol?.manualReview?.state,
      )
        ? protocol.manualReview.state
        : 'pending';
      const totalTvl = Number(protocol?.totalTvl);
      const bestRank = protocol?.priority?.bestRank;
      return [
        {
          key: `${source}:${id}`,
          source,
          id,
          name: String(protocol?.name || protocol?.slug || id),
          slug: String(protocol?.slug || protocol?.name || id),
          url,
          urlSource: override ? 'override' : resolved ? 'resolved' : 'registry',
          registryUrl: safeUrl(registryUrl) ? registryUrl : null,
          registrySha256,
          totalTvl: Number.isFinite(totalTvl) && totalTvl > 0 ? totalTvl : 0,
          bestRank:
            bestRank !== null &&
            bestRank !== undefined &&
            Number.isFinite(Number(bestRank))
              ? Number(bestRank)
              : null,
          manualReview: {
            state,
            reviewedAt: protocol?.manualReview?.reviewedAt || null,
            reviewedUrl: protocol?.manualReview?.reviewedUrl || null,
            injectedBundleSha256:
              protocol?.manualReview?.injectedBundleSha256 || null,
          },
        },
      ];
    },
  );
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function findProtocol(snapshot, identifier) {
  const keyed = snapshot.protocols.find(
    (protocol) => protocol.key === identifier,
  );
  if (keyed) return keyed;
  const matches = snapshot.protocols.filter(
    (protocol) => protocol.id === identifier,
  );
  if (matches.length !== 1)
    throw new Error('Custom injection protocol not found');
  return matches[0];
}

function safeSlug(value) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 100) || 'protocol'
  );
}

async function childDirectory(parent, segment, create) {
  const directory = path.join(parent, segment);
  let stat;
  try {
    stat = await fs.lstat(directory);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    if (!create) return null;
    await fs.mkdir(directory);
    stat = await fs.lstat(directory);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error('Custom injection DApp path must be a regular directory');
  }
  const [resolved, resolvedParent] = await Promise.all([
    fs.realpath(directory),
    fs.realpath(parent),
  ]);
  if (path.relative(resolvedParent, resolved) !== segment) {
    throw new Error('Custom injection DApp path escapes dappsDirectory');
  }
  return resolved;
}

async function dappDirectory(snapshot, protocol, create) {
  const root = await workspaceFile(snapshot.dappsDirectory, 'dappsDirectory');
  const source = await childDirectory(root, protocol.source, create);
  return source
    ? childDirectory(source, safeSlug(protocol.slug || protocol.id), create)
    : null;
}

async function readIfExists(file, maxBytes, label) {
  let stat;
  try {
    stat = await fs.lstat(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.size <= 0 ||
    stat.size > maxBytes
  ) {
    throw new Error(`${label} must be a regular file`);
  }
  return fs.readFile(file);
}

function parseStatic(source, field) {
  const matches = Array.from(
    source.matchAll(
      new RegExp(`\\b${field}\\s*:\\s*(['"])([^'"\\r\\n]+)\\1`, 'gu'),
    ),
  );
  if (matches.length !== 1 || !matches[0]?.[2]) {
    throw new Error(`Generated E2E must contain exactly one static ${field}`);
  }
  return matches[0][2];
}

function parseOutput(output) {
  const trimmed = String(output || '').trim();
  const lines = trimmed.split(/\r?\n/u);
  for (const candidate of [
    trimmed,
    ...lines.map((_, index) => lines.slice(index).join('\n')),
  ]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next JSON candidate.
    }
  }
  throw new Error('Generated E2E returned invalid JSON');
}

function normalizedE2EResult(value, protocol, recordingSha256) {
  if (
    value?.schemaVersion !== 1 ||
    value.kind !== 'onekey-connect-button-desktop-e2e-result' ||
    value.source !== protocol.source ||
    value.protocolId !== protocol.id ||
    value.recordingSha256 !== recordingSha256 ||
    !Array.isArray(value.passes)
  ) {
    throw new Error('Generated E2E result does not match the latest recording');
  }
  const passes = value.passes.map((pass, index) => {
    if (
      pass?.name !== `clean-session-${String(index + 1)}` ||
      typeof pass.freshWebView !== 'boolean' ||
      typeof pass.passed !== 'boolean' ||
      typeof pass.repositoryIconDetected !== 'boolean' ||
      (pass.passed &&
        (!pass.freshWebView ||
          (!pass.repositoryIconDetected &&
            pass.oneKeyWalletIdDetected !== true)))
    ) {
      throw new Error('Generated E2E returned an invalid pass');
    }
    return {
      ...pass,
      oneKeyWalletIdDetected: pass.oneKeyWalletIdDetected === true,
      walletId: pass.walletId || null,
      iconKey: pass.iconKey || null,
      iconLabel: pass.iconLabel || null,
    };
  });
  return {
    ...value,
    passed: passes.some((pass) => pass.passed),
    passes,
  };
}

async function writeJson(file, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(file, content, { mode: 0o600 });
  return content;
}

async function e2eState(snapshot, identifier) {
  const protocol = findProtocol(snapshot, identifier);
  const directory = await dappDirectory(snapshot, protocol, false);
  if (!directory)
    return { recording: null, e2e: null, adapter: null, canValidate: false };
  const recordingFile = path.join(directory, 'recording.json');
  const recordingContent = await readIfExists(
    recordingFile,
    1024 * 1024,
    'recording',
  );
  let recording = null;
  if (recordingContent) {
    const value = JSON.parse(recordingContent.toString('utf8'));
    if (
      value.protocol?.source !== protocol.source ||
      value.protocol?.id !== protocol.id ||
      value.runtime?.privateSession !== true
    ) {
      throw new Error(
        'Custom injection recording does not match the selected protocol',
      );
    }
    recording = {
      relativeFile: relative(recordingFile),
      sha256: digest(recordingContent),
      stepCount: value.steps.length,
      finishedAt: value.finishedAt,
    };
  }
  const e2eFile = path.join(directory, 'e2e.mjs');
  const e2eContent = await readIfExists(e2eFile, 256 * 1024, 'Generated E2E');
  let e2e = null;
  if (e2eContent) {
    const source = e2eContent.toString('utf8');
    const sourceName = parseStatic(source, 'source');
    const protocolId = parseStatic(source, 'protocolId');
    const recordingSha256 = parseStatic(source, 'recordingSha256');
    parseStatic(source, 'site');
    if (sourceName !== protocol.source || protocolId !== protocol.id) {
      throw new Error('Generated E2E does not match the selected protocol');
    }
    e2e = {
      relativeFile: relative(e2eFile),
      recordingSha256,
      current: recording?.sha256 === recordingSha256,
    };
  }
  const resultFile = path.join(directory, 'e2e-result.json');
  const resultContent = await readIfExists(
    resultFile,
    256 * 1024,
    'Persisted E2E result',
  );
  let validation;
  if (resultContent) {
    const value = parseOutput(resultContent.toString('utf8'));
    const result = normalizedE2EResult(value, protocol, value.recordingSha256);
    validation = {
      relativeFile: relative(resultFile),
      recordingSha256: result.recordingSha256,
      passed: result.passed,
      current: Boolean(
        recording &&
        e2e?.current &&
        e2eContent &&
        value.e2eSha256 === digest(e2eContent) &&
        result.recordingSha256 === recording.sha256,
      ),
    };
  }
  const adapterFile = path.join(directory, 'adapter.ts');
  const adapter = await readIfExists(adapterFile, 1024 * 1024, 'adapter');
  return {
    recording,
    e2e,
    adapter: adapter ? { relativeFile: relative(adapterFile) } : null,
    ...(validation ? { validation } : {}),
    canValidate: Boolean(recording && e2e?.current),
  };
}

function processLog(e2eFile, processResult) {
  return [
    'OneKey Desktop E2E validation',
    `Script: ${e2eFile}`,
    `Exit code: ${String(processResult.exitCode)}`,
    ...(processResult.stdout?.trim()
      ? [`\n--- stdout ---\n${processResult.stdout.trim()}`]
      : []),
    ...(processResult.stderr?.trim()
      ? [`\n--- stderr ---\n${processResult.stderr.trim()}`]
      : []),
    ...(processResult.processError
      ? [`\n--- process error ---\n${processResult.processError}`]
      : []),
  ].join('\n');
}

try {
  const manifestFile = await workspaceFile(
    'onekey-app-custom-injected.json',
    'Custom injection manifest',
  );
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  const sourceManifests =
    manifest.schemaVersion === 2
      ? [
          {
            source: manifest.dappSource,
            protocolRegistry: manifest.protocolRegistry,
            registryUpdater: manifest.registryUpdater,
            registryRefresher: manifest.registryRefresher,
          },
        ]
      : manifest.protocolSources;
  const sourceNames = new Set();
  for (const sourceManifest of sourceManifests || []) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(sourceManifest?.source || '') ||
      sourceNames.has(sourceManifest.source)
    ) {
      throw new Error(
        'Custom injection manifest protocol source must be unique and normalized',
      );
    }
    sourceNames.add(sourceManifest.source);
  }
  const protocolSources = await Promise.all(
    sourceManifests.map(async (sourceManifest) => {
      const registryFile = await workspaceFile(
        sourceManifest.protocolRegistry,
        `${sourceManifest.source}.protocolRegistry`,
      );
      const updaterFile = await workspaceFile(
        sourceManifest.registryUpdater,
        `${sourceManifest.source}.registryUpdater`,
      );
      const refresherFile = sourceManifest.registryRefresher
        ? await workspaceFile(
            sourceManifest.registryRefresher,
            `${sourceManifest.source}.registryRefresher`,
          )
        : null;
      const registryText = await fs.readFile(registryFile, 'utf8');
      const registrySha256 = digest(registryText);
      return {
        source: sourceManifest.source,
        protocolRegistry: relative(registryFile),
        registryUpdater: relative(updaterFile),
        registryRefresher: refresherFile ? relative(refresherFile) : null,
        registrySha256,
        protocols: parseProtocols(
          registryText,
          sourceManifest.source,
          registrySha256,
        ),
      };
    }),
  );
  const preloadFile = await workspaceFile(
    manifest.desktopPreload,
    'desktopPreload',
  );
  const generatorFile = manifest.recordingE2EGenerator
    ? await workspaceFile(
        manifest.recordingE2EGenerator,
        'recordingE2EGenerator',
      )
    : null;
  const registrySha256 =
    protocolSources.length === 1
      ? protocolSources[0].registrySha256
      : digest(
          JSON.stringify(
            protocolSources.map((source) => [
              source.source,
              source.registrySha256,
            ]),
          ),
        );
  const snapshot = {
    schemaVersion: 1,
    kind: 'onekey-custom-injection-workspace-snapshot',
    workspace,
    manifest: relative(manifestFile),
    desktopPreload: relative(preloadFile),
    dappsDirectory: manifest.dappsDirectory,
    recordingE2EGenerator: generatorFile ? relative(generatorFile) : null,
    registrySha256,
    bundleSha256: digest(await fs.readFile(preloadFile)),
    protocolSources: protocolSources.map(
      ({ protocols: _protocols, ...source }) => source,
    ),
    protocols: protocolSources.flatMap((source) => source.protocols),
  };
  const action = arg('--action');
  let result = snapshot;
  if (action === 'e2e-state') {
    result = await e2eState(snapshot, arg('--protocol-id'));
  } else if (action === 'e2e-states') {
    const states = {};
    const errors = [];
    await Promise.all(
      snapshot.protocols.map(async (protocol) => {
        try {
          const state = await e2eState(snapshot, protocol.key);
          states[protocol.key] = {
            adapter: Boolean(state.adapter),
            recorded: Boolean(state.recording),
            generated: Boolean(state.e2e?.current),
            resultPresent: Boolean(state.validation),
            validated: Boolean(
              state.validation?.current && state.validation.passed,
            ),
          };
        } catch (error) {
          states[protocol.key] = {
            adapter: false,
            recorded: false,
            generated: false,
            resultPresent: false,
            validated: false,
          };
          errors.push({
            protocolId: protocol.key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
    result = { states, errors };
  } else if (action === 'recording-save') {
    const request = JSON.parse(
      await fs.readFile(arg('--request-file'), 'utf8'),
    );
    const protocol = findProtocol(snapshot, request.protocolId);
    if (request.bundleSha256 !== snapshot.bundleSha256) {
      throw new Error('Custom injection bundle has changed');
    }
    if (request.expectedRegistrySha256 !== protocol.registrySha256) {
      throw new Error('Custom injection registry has changed');
    }
    const directory = await dappDirectory(snapshot, protocol, true);
    const capture = request.recording;
    const persisted = {
      schemaVersion: 1,
      kind: 'onekey-connect-button-recording',
      protocol: {
        source: protocol.source,
        id: protocol.id,
        name: protocol.name,
        slug: protocol.slug,
        url: protocol.url,
      },
      runtime: { bundleSha256: snapshot.bundleSha256, privateSession: true },
      startedAt: capture.startedAt,
      finishedAt: capture.finishedAt,
      initialUrl: capture.initialUrl,
      finalUrl: capture.finalUrl,
      title: capture.title,
      viewport: capture.viewport,
      outcome: capture.outcome ?? null,
      steps: capture.steps,
    };
    const file = path.join(directory, 'recording.json');
    const content = await writeJson(file, persisted);
    await fs.unlink(path.join(directory, 'e2e-result.json')).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
    const entries = await fs.readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map((entry) =>
        entry.isFile() &&
        entry.name.startsWith('recording-') &&
        entry.name.endsWith('.json')
          ? fs.unlink(path.join(directory, entry.name))
          : undefined,
      ),
    );
    result = {
      schemaVersion: 1,
      kind: 'onekey-custom-injection-recording-save-result',
      relativeFile: relative(file),
      sha256: digest(content),
      stepCount: capture.steps.length,
    };
  } else if (action === 'protocol-update') {
    const request = JSON.parse(
      await fs.readFile(arg('--request-file'), 'utf8'),
    );
    const protocol = findProtocol(snapshot, request.protocolId);
    const source = protocolSources.find(
      (candidate) => candidate.source === protocol.source,
    );
    const args = [
      await workspaceFile(source.registryUpdater, 'registryUpdater'),
      '--file',
      await workspaceFile(source.protocolRegistry, 'protocolRegistry'),
      '--protocol-id',
      protocol.id,
      '--expected-sha256',
      request.expectedRegistrySha256,
      '--action',
      request.action,
    ];
    if (request.action === 'set-url') {
      args.push(request.url ? '--url' : '--clear-url');
      if (request.url) args.push(request.url);
    } else {
      args.push('--state', request.state);
      if (request.reviewedUrl) args.push('--reviewed-url', request.reviewedUrl);
      if (request.bundleSha256)
        args.push('--bundle-sha256', request.bundleSha256);
    }
    const processResult = await execFileAsync(process.execPath, args, {
      cwd: workspace,
      encoding: 'utf8',
      signal: abortController.signal,
    });
    const registryFile = await workspaceFile(
      source.protocolRegistry,
      'protocolRegistry',
    );
    const registryText = await fs.readFile(registryFile, 'utf8');
    const updatedDigest = digest(registryText);
    const updatedProtocol = parseProtocols(
      registryText,
      source.source,
      updatedDigest,
    ).find((candidate) => candidate.id === protocol.id);
    result = {
      schemaVersion: 1,
      kind: 'onekey-custom-injection-protocol-update-result',
      ok: true,
      protocol: updatedProtocol,
      process: {
        exitCode: 0,
        stdout: processResult.stdout,
        stderr: processResult.stderr,
      },
    };
  } else if (action === 'protocols-refresh') {
    const processes = [];
    for (const source of protocolSources.filter(
      ({ registryRefresher }) => registryRefresher,
    )) {
      const processResult = await execFileAsync(
        process.execPath,
        [
          await workspaceFile(source.registryRefresher, 'registryRefresher'),
          '--file',
          await workspaceFile(source.protocolRegistry, 'protocolRegistry'),
        ],
        { cwd: workspace, encoding: 'utf8', signal: abortController.signal },
      );
      processes.push({
        source: source.source,
        exitCode: 0,
        stdout: processResult.stdout,
        stderr: processResult.stderr,
      });
    }
    result = {
      schemaVersion: 1,
      kind: 'onekey-custom-injection-protocol-refresh-result',
      ok: true,
      processes,
    };
  } else if (action === 'e2e-generate') {
    const protocol = findProtocol(snapshot, arg('--protocol-id'));
    const state = await e2eState(snapshot, protocol.key);
    if (!state.recording || !generatorFile) {
      throw new Error('Save a recording before generating its E2E');
    }
    try {
      const processResult = await execFileAsync(
        process.execPath,
        [generatorFile, '--file', state.recording.relativeFile],
        { cwd: workspace, encoding: 'utf8', signal: abortController.signal },
      );
      result = {
        ...parseOutput(processResult.stdout),
        process: {
          exitCode: 0,
          stdout: processResult.stdout,
          stderr: processResult.stderr,
        },
      };
    } catch (error) {
      if (abortController.signal.aborted) {
        result = {
          ok: false,
          cancelled: true,
          error: 'E2E generation stopped by user',
        };
      } else {
        throw error;
      }
    }
  } else if (action === 'e2e-run') {
    const protocol = findProtocol(snapshot, arg('--protocol-id'));
    const state = await e2eState(snapshot, protocol.key);
    if (!state.recording || !state.e2e?.current) {
      throw new Error(
        'Generate an E2E script from the latest recording before validating',
      );
    }
    const directory = await dappDirectory(snapshot, protocol, false);
    const e2eFile = path.join(directory, 'e2e.mjs');
    const resultFile = path.join(directory, 'e2e-result.json');
    const e2eSha256 = digest(await fs.readFile(e2eFile));
    let latestProcessLog = '';
    try {
      const processLogs = [];
      const runPhase = async (adapterMode) => {
        let processResult;
        try {
          const output = await execFileAsync(process.execPath, [e2eFile], {
            cwd: workspace,
            encoding: 'utf8',
            signal: abortController.signal,
          });
          processResult = {
            exitCode: 0,
            stdout: output.stdout,
            stderr: output.stderr,
          };
        } catch (error) {
          if (abortController.signal.aborted) throw error;
          processResult = {
            exitCode: error.code ?? 'unknown',
            stdout: error.stdout || '',
            stderr: error.stderr || '',
            processError: error.message,
          };
        }
        processLogs.push(
          `[Adapter ${adapterMode}]\n${processLog(relative(e2eFile), processResult)}`,
        );
        latestProcessLog = processLogs.join('\n\n');
        const value = parseOutput(processResult.stdout || processResult.stderr);
        const phaseResult = normalizedE2EResult(
          value,
          protocol,
          state.recording.sha256,
        );
        return {
          ...phaseResult,
          passes: phaseResult.passes.map((pass, index) => ({
            ...pass,
            phaseAttempt: index + 1,
            adapterMode,
            adapterControlVerified: true,
            adapterExecuted: adapterMode === 'enabled',
          })),
        };
      };
      const nativeResult = await runPhase('disabled');
      const adapterResult = nativeResult.passed
        ? null
        : await runPhase('enabled');
      const nativePasses = nativeResult.passes;
      const adapterPasses = (adapterResult?.passes || []).map(
        (pass, index) => ({
          ...pass,
          name: `clean-session-${String(nativePasses.length + index + 1)}`,
        }),
      );
      const passed = nativeResult.passed || adapterResult?.passed === true;
      const validation = {
        ...(adapterResult || nativeResult),
        passed,
        validationMode: 'native-then-adapter',
        classification: nativeResult.passed
          ? 'native-onekey'
          : adapterResult?.passed
            ? 'adapter-required'
            : 'failed',
        maximumAttempts: 6,
        maximumAttemptsPerPhase: 3,
        nativeOneKeyAttempts: nativePasses.length,
        adapterEnabledAttempts: adapterPasses.length,
        passes: [...nativePasses, ...adapterPasses],
      };
      await writeJson(resultFile, { ...validation, e2eSha256 });
      result = {
        ok: true,
        result: validation,
        log: latestProcessLog,
      };
    } catch (error) {
      if (abortController.signal.aborted) {
        result = {
          ok: false,
          cancelled: true,
          error: 'E2E validation stopped by user',
          log: '',
        };
      } else {
        result = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          log: latestProcessLog,
        };
      }
    }
  }
  process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exitCode = 4;
} finally {
  process.off('SIGINT', abort);
  process.off('SIGTERM', abort);
}
