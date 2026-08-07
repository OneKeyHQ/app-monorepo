import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { promisify } from 'util';

import { dialog, webContents } from 'electron';
import logger from 'electron-log/main';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

import {
  appendCustomInjectedOperationLog,
  getCustomInjectedOperationLogFile,
  readCustomInjectedOperationLogs,
  selectCustomInjectedRecentOperationLogs,
} from './customInjectedOperationLog';
import DesktopApiWebviewBase from './DesktopApiWebviewBase';

import type { ICustomInjectedOperationLogRecord } from './customInjectedOperationLog';

export type { ICustomInjectedOperationLogRecord } from './customInjectedOperationLog';
export {
  getFiatPaySiteWhitelistDomainKeys,
  getFiatPaySiteWhitelistOrigins,
  getOriginDomainKey,
  getTemplatePhishingUrls,
} from './DesktopApiWebviewBase';

const execFileAsync = promisify(execFile);
const CUSTOM_INJECTED_OPERATION_LOG_APP_STARTED_AT =
  Date.now() - Math.floor(process.uptime() * 1000);
const CUSTOM_INJECTED_WORKSPACE_CLI =
  'packages/connect-button-workbench/src/cli/custom-injected-workspace.mjs';
const CUSTOM_INJECTED_REGISTRY_MAX_BYTES = 32 * 1024 * 1024;
const CUSTOM_INJECTED_PRELOAD_MAX_BYTES = 64 * 1024 * 1024;
const CUSTOM_INJECTED_UPDATER_MAX_BYTES = 1024 * 1024;
const CUSTOM_INJECTED_REFRESHER_MAX_BYTES = 1024 * 1024;
const CUSTOM_INJECTED_E2E_GENERATOR_MAX_BYTES = 1024 * 1024;
const CUSTOM_INJECTED_RECORDING_MAX_STEPS = 100;
const CUSTOM_INJECTED_E2E_PROCESS_TIMEOUT_MS = 450_000;
const CUSTOM_INJECTED_WORKSPACE_CLI_OUTPUT_MAX_BYTES = 48 * 1024 * 1024;
const CUSTOM_INJECTED_WORKSPACE_CLI_REQUEST_MAX_BYTES = 2 * 1024 * 1024;
const CUSTOM_INJECTED_E2E_PRELOAD_CONTROL_KEY =
  '__ONEKEY_CONNECT_BUTTON_HACK_PRELOAD_CONTROL__';

export type ICustomInjectedRecordingSelector = {
  kind:
    | 'testId'
    | 'dataTest'
    | 'dataCy'
    | 'id'
    | 'ariaLabel'
    | 'role'
    | 'text'
    | 'css';
  value: string;
  unique: boolean;
  matchCount?: number;
  visibleMatchCount?: number;
  strength?: 'stable' | 'anchored' | 'class' | 'semantic' | 'structural';
  role?: string;
  name?: string;
};

export type ICustomInjectedRecordingScope = {
  relation: 'ancestor';
  tag: string;
  locator: ICustomInjectedRecordingSelector;
};

export type ICustomInjectedRecordingShadowHost = {
  tag: string;
  selectors: ICustomInjectedRecordingSelector[];
};

export type ICustomInjectedRecordingTarget = {
  tag: string;
  text: string | null;
  role: string | null;
  ariaLabel: string | null;
  inputType?: string | null;
  stableClassTokens?: string[];
  scopes?: ICustomInjectedRecordingScope[];
  shadowHosts?: ICustomInjectedRecordingShadowHost[];
  geometry?: {
    centerXRatio: number;
    centerYRatio: number;
    widthRatio: number;
    heightRatio: number;
  } | null;
  selectors: ICustomInjectedRecordingSelector[];
};

export type ICustomInjectedRecordingStep = {
  action: 'click' | 'press';
  elapsedMs: number;
  pageUrl: string;
  target: ICustomInjectedRecordingTarget;
  key?: string;
};

export type ICustomInjectedRecordingCapture = {
  schemaVersion: 1 | 2;
  kind: 'onekey-connect-button-recording-capture';
  startedAt: string;
  finishedAt: string;
  initialUrl: string;
  finalUrl: string;
  title: string;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  outcome?: {
    kind: 'repository-wallet-icon';
    afterStep: number;
  } | null;
  steps: ICustomInjectedRecordingStep[];
};

export type ICustomInjectedSaveRecordingRequest = {
  sessionId: string;
  protocolId: string;
  pageUrl: string;
  webContentsId: number;
  bundleSha256: string;
  expectedRegistrySha256: string;
  devSettingsEnabled: boolean;
  customInjectionEnabled: boolean;
  recording: ICustomInjectedRecordingCapture;
};

export type ICustomInjectedSaveRecordingResult = {
  relativeFile: string;
  sha256: string;
  stepCount: number;
};

export type ICustomInjectedE2EGenerationResult =
  | {
      ok: true;
      relativeFile: string;
      recordingSha256: string;
      actionCount: number;
      validated: true;
      validationPasses: number;
    }
  | {
      ok: false;
      error: string;
      cancelled?: boolean;
    };

export type ICustomInjectedE2EWorkflowState = {
  recording: {
    relativeFile: string;
    sha256: string;
    stepCount: number;
    finishedAt: string;
  } | null;
  e2e: {
    relativeFile: string;
    recordingSha256: string;
    current: boolean;
  } | null;
  adapter: {
    relativeFile: string;
  } | null;
  validation?: {
    relativeFile: string;
    recordingSha256: string;
    passed: boolean;
    current: boolean;
  };
  canValidate: boolean;
};

export type ICustomInjectedE2EWorkflowSummary = {
  adapter: boolean;
  recorded: boolean;
  generated: boolean;
  resultPresent: boolean;
  validated: boolean;
};

export type ICustomInjectedE2EResult = {
  schemaVersion: 1;
  kind: 'onekey-connect-button-desktop-e2e-result';
  passed: boolean;
  verdict: 'deterministic-repository-icon-source';
  source: string;
  protocolId: string;
  site: string;
  recordingSha256: string;
  validationMode: 'native-then-adapter';
  classification: 'native-onekey' | 'adapter-required' | 'failed';
  maximumAttempts: 6;
  maximumAttemptsPerPhase: 3;
  nativeOneKeyAttempts: number;
  adapterEnabledAttempts: number;
  passes: Array<{
    name: string;
    phaseAttempt: number;
    adapterMode: 'disabled' | 'enabled';
    adapterControlVerified: boolean;
    adapterExecuted: boolean | null;
    freshWebView: boolean;
    passed: boolean;
    repositoryIconDetected: boolean;
    oneKeyWalletIdDetected?: boolean;
    walletId?: string | null;
    iconKey: string | null;
    iconLabel: string | null;
  }>;
};

export type ICustomInjectedE2ERunOutcome =
  | {
      ok: true;
      result: ICustomInjectedE2EResult;
      log: string;
    }
  | {
      ok: false;
      error: string;
      log: string;
      cancelled?: boolean;
    };

export type ICustomInjectedE2EStopResult = {
  stopped: boolean;
};

export type ICustomInjectedE2EAdapterControl = {
  mode: 'enabled' | 'disabled';
  token: string;
};

export type ICustomInjectedE2EPreloadRequest =
  ICustomInjectedE2EAdapterControl & {
    sessionId: string;
    bundleSha256: string;
  };

export type ICustomInjectedE2EPreloadResult =
  ICustomInjectedE2EAdapterControl & {
    preloadUrl: string;
  };

export type ICustomInjectedE2EFocusRequest = {
  sessionId: string;
  protocolId: string;
  pageUrl: string;
  webContentsId: number;
};

export type ICustomInjectedE2EFocusResult = {
  focused: true;
  webContentsId: number;
};

export type ICustomInjectedProtocol = {
  key: string;
  source: string;
  id: string;
  name: string;
  slug: string;
  url: string;
  urlSource: 'override' | 'resolved' | 'registry';
  registryUrl: string | null;
  registrySha256: string;
  totalTvl: number;
  bestRank: number | null;
  manualReview: {
    state: 'pending' | 'processed' | 'unsupported';
    reviewedAt: string | null;
    reviewedUrl: string | null;
    injectedBundleSha256: string | null;
  };
};

export type ICustomInjectedSession = {
  sessionId: string;
  workspace: string;
  registrySha256: string;
  bundleSha256: string;
  preloadUrl: string;
  sources: string[];
  dappsDirectory: string;
  protocols: ICustomInjectedProtocol[];
};

export type ICustomInjectedWorkspacePreview = {
  sessionId: string;
  workspace: string;
  protocolSources: Array<{
    source: string;
    protocolRegistry: string;
    registryRefresher: string | null;
  }>;
  desktopPreload: string;
  dappsDirectory: string;
  protocolCount: number;
  pendingCount: number;
  bundleSha256: string;
};

export type ICustomInjectedProtocolUpdate =
  | {
      action: 'set-url';
      sessionId: string;
      protocolId: string;
      expectedRegistrySha256: string;
      url: string | null;
    }
  | {
      action: 'set-review';
      sessionId: string;
      protocolId: string;
      expectedRegistrySha256: string;
      state: 'pending' | 'processed' | 'unsupported';
      reviewedUrl?: string;
      bundleSha256?: string;
    };

export type ICustomInjectedAutoReviewRequest = {
  sessionId: string;
  protocolId: string;
  pageUrl: string;
  webContentsId: number;
  bundleSha256: string;
  expectedRegistrySha256: string;
  devSettingsEnabled: boolean;
  customInjectionEnabled: boolean;
};

export type ICustomInjectedAutoReviewResult = {
  session: ICustomInjectedSession;
  updated: boolean;
};

export type ICustomInjectedClientOperationLogRequest = {
  sessionId: string;
  protocolId?: string;
  operationId: string;
  operation:
    | 'dapp.reload'
    | 'e2e.batch.validate'
    | 'e2e.clean-session.prepare'
    | 'e2e.generate.prepare'
    | 'e2e.runtime.restore'
    | 'e2e.validate.orchestrate'
    | 'protocol.redirect'
    | 'protocol.redirect.update'
    | 'protocol.select'
    | 'protocol.update'
    | 'recording.recorder'
    | 'recording.start'
    | 'recording.stop'
    | 'webview.url.read'
    | 'workflow.open'
    | 'workspace.progress.persist'
    | 'workspace.settings.apply'
    | 'workspace.settings.select';
  status: 'error' | 'result' | 'start';
  durationMs?: number;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
};

type ICustomInjectedWorkspaceSession = {
  sessionId: string;
  workspace: string;
  workspaceCliFile: string;
  protocolSources: Array<{
    source: string;
    registryFile: string;
    updaterFile: string;
    refresherFile: string | null;
    registryStamp: string;
    registrySha256: string;
    protocols: ICustomInjectedProtocol[];
  }>;
  preloadFile: string;
  dappsDirectory: string;
  recordingE2EGeneratorFile: string | null;
  preloadStamp: string;
  registrySha256: string;
  bundleSha256: string;
  protocols: ICustomInjectedProtocol[];
  e2ePreloadDirectories: Set<string>;
  active: boolean;
};

type ICustomInjectedWorkspaceCliSnapshot = {
  schemaVersion: 1;
  kind: 'onekey-custom-injection-workspace-snapshot';
  workspace: string;
  manifest: string;
  desktopPreload: string;
  dappsDirectory: string;
  recordingE2EGenerator: string | null;
  registrySha256: string;
  bundleSha256: string;
  protocolSources: Array<{
    source: string;
    protocolRegistry: string;
    registryUpdater: string;
    registryRefresher: string | null;
    registrySha256: string;
  }>;
  protocols: ICustomInjectedProtocol[];
};

type ICustomInjectedWorkspaceCliProcess = {
  exitCode: number | string;
  signal?: string;
  stdout: string;
  stderr: string;
  processError?: string;
};

type ICustomInjectedWorkspaceCliProtocolUpdateResult = {
  schemaVersion: 1;
  kind: 'onekey-custom-injection-protocol-update-result';
  ok: boolean;
  error?: string;
  protocol?: ICustomInjectedProtocol;
  process?: ICustomInjectedWorkspaceCliProcess;
};

type ICustomInjectedWorkspaceCliProtocolRefreshResult = {
  schemaVersion: 1;
  kind: 'onekey-custom-injection-protocol-refresh-result';
  ok: boolean;
  error?: string;
  processes: Array<ICustomInjectedWorkspaceCliProcess & { source: string }>;
};

type ICustomInjectedWorkspaceCliRecordingSaveResult =
  ICustomInjectedSaveRecordingResult & {
    schemaVersion: 1;
    kind: 'onekey-custom-injection-recording-save-result';
  };

type ICustomInjectedWorkspaceCliE2EGenerationResult =
  ICustomInjectedE2EGenerationResult & {
    process?: ICustomInjectedWorkspaceCliProcess;
  };

type ICustomInjectedWorkspaceCliE2EStatesResult = {
  states: Record<string, ICustomInjectedE2EWorkflowSummary>;
  errors: Array<{ protocolId: string; error: string }>;
};

const customInjectedSessions = new Map<
  string,
  ICustomInjectedWorkspaceSession
>();
const customInjectedE2ERuns = new Set<string>();
const customInjectedE2ERunAbortControllers = new Map<string, AbortController>();
const customInjectedE2EGenerations = new Set<string>();
const customInjectedE2EGenerationAbortControllers = new Map<
  string,
  AbortController
>();
const CUSTOM_INJECTED_CLIENT_LOG_OPERATIONS = new Set<
  ICustomInjectedClientOperationLogRequest['operation']
>([
  'dapp.reload',
  'e2e.batch.validate',
  'e2e.clean-session.prepare',
  'e2e.generate.prepare',
  'e2e.runtime.restore',
  'e2e.validate.orchestrate',
  'protocol.redirect',
  'protocol.redirect.update',
  'protocol.select',
  'protocol.update',
  'recording.recorder',
  'recording.start',
  'recording.stop',
  'webview.url.read',
  'workflow.open',
  'workspace.progress.persist',
  'workspace.settings.apply',
  'workspace.settings.select',
]);
let activeCustomInjectedSessionId: string | undefined;

type ICustomInjectedLoggedOperationCompletion = {
  result?: Record<string, unknown>;
  error?: unknown;
};

function customInjectedOperationProtocol(
  protocol: ICustomInjectedProtocol | undefined,
) {
  return protocol
    ? {
        key: protocol.key,
        source: protocol.source,
        id: protocol.id,
        name: protocol.name,
      }
    : undefined;
}

async function writeCustomInjectedOperationLog(
  workspace: string,
  event: Parameters<typeof appendCustomInjectedOperationLog>[1],
): Promise<void> {
  try {
    await appendCustomInjectedOperationLog(workspace, event);
  } catch (error) {
    logger.warn?.('Unable to write Custom Injection operation log', error);
  }
}

async function runCustomInjectedLoggedOperation<T>({
  workspace,
  sessionId,
  protocol,
  operation,
  input,
  run,
  completion,
}: {
  workspace: string;
  sessionId?: string;
  protocol?: ICustomInjectedProtocol;
  operation: string;
  input?: Record<string, unknown>;
  run: () => Promise<T>;
  completion?: (value: T) => ICustomInjectedLoggedOperationCompletion;
}): Promise<T> {
  const operationId = crypto.randomUUID();
  const startedAt = Date.now();
  const common = {
    operationId,
    operation,
    ...(sessionId ? { sessionId } : undefined),
    ...(protocol
      ? { protocol: customInjectedOperationProtocol(protocol) }
      : undefined),
  };
  await writeCustomInjectedOperationLog(workspace, {
    ...common,
    status: 'start',
    ...(input ? { input } : undefined),
  });
  try {
    const value = await run();
    const completed = completion?.(value) || {};
    await writeCustomInjectedOperationLog(workspace, {
      ...common,
      status: completed.error ? 'error' : 'result',
      durationMs: Date.now() - startedAt,
      ...(completed.result ? { result: completed.result } : undefined),
      ...(completed.error ? { error: completed.error } : undefined),
    });
    return value;
  } catch (error) {
    await writeCustomInjectedOperationLog(workspace, {
      ...common,
      status: 'error',
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}

async function runCustomInjectedErrorLoggedOperation<T>({
  workspace,
  sessionId,
  protocol,
  operation,
  input,
  run,
}: {
  workspace: string;
  sessionId?: string;
  protocol?: ICustomInjectedProtocol;
  operation: string;
  input?: Record<string, unknown>;
  run: () => Promise<T>;
}): Promise<T> {
  const startedAt = Date.now();
  try {
    return await run();
  } catch (error) {
    await writeCustomInjectedOperationLog(workspace, {
      operationId: crypto.randomUUID(),
      operation,
      status: 'error',
      ...(sessionId ? { sessionId } : undefined),
      ...(protocol
        ? { protocol: customInjectedOperationProtocol(protocol) }
        : undefined),
      durationMs: Date.now() - startedAt,
      ...(input ? { input } : undefined),
      error,
    });
    throw error;
  }
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ensureCustomInjectedEnabled(devSettingsEnabled: boolean) {
  if (devSettingsEnabled !== true) {
    throw new OneKeyLocalError(
      'Custom injection requires enabled developer settings',
    );
  }
}

async function statLimitedFile(
  file: string,
  maxBytes: number,
  label: string,
): Promise<{ stamp: string }> {
  const stat = await fs.stat(file, { bigint: true });
  if (!stat.isFile()) {
    throw new OneKeyLocalError(`${label} must be a regular file`);
  }
  if (stat.size <= 0 || stat.size > BigInt(maxBytes)) {
    throw new OneKeyLocalError(
      `${label} size must be between 1 and ${String(maxBytes)} bytes`,
    );
  }
  return { stamp: `${String(stat.mtimeNs)}:${String(stat.size)}` };
}

async function readLimitedFile(
  file: string,
  maxBytes: number,
  label: string,
): Promise<{ content: Buffer; stamp: string }> {
  const { stamp } = await statLimitedFile(file, maxBytes, label);
  return { content: await fs.readFile(file), stamp };
}

async function resolveWorkspaceFile(
  workspace: string,
  relativePath: string,
  label: string,
): Promise<string> {
  if (
    typeof relativePath !== 'string' ||
    !relativePath ||
    path.isAbsolute(relativePath)
  ) {
    throw new OneKeyLocalError(`${label} must be a relative path`);
  }
  const resolved = await fs.realpath(path.resolve(workspace, relativePath));
  const relative = path.relative(workspace, resolved);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new OneKeyLocalError(`${label} escapes the selected workspace`);
  }
  return resolved;
}

async function resolveWorkspaceOutputDirectory(
  workspace: string,
  relativePath: string,
  label: string,
): Promise<string> {
  if (
    typeof relativePath !== 'string' ||
    !relativePath ||
    path.isAbsolute(relativePath)
  ) {
    throw new OneKeyLocalError(`${label} must be a relative path`);
  }
  const components = relativePath.split(/[\\/]+/u);
  if (
    components.length === 0 ||
    components.some(
      (component) => !component || component === '.' || component === '..',
    )
  ) {
    throw new OneKeyLocalError(`${label} escapes the selected workspace`);
  }

  let current = workspace;
  for (const component of components) {
    current = path.join(current, component);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new OneKeyLocalError(
          `${label} must contain only regular directories`,
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      await fs.mkdir(current, { mode: 0o700 });
    }
  }

  const resolved = await fs.realpath(current);
  const relative = path.relative(workspace, resolved);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new OneKeyLocalError(`${label} escapes the selected workspace`);
  }
  return resolved;
}

function safeRecordingSlug(value: string): string {
  const result = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 100);
  return result || 'protocol';
}

async function resolveCustomInjectedChildDirectory(
  parentDirectory: string,
  segment: string,
  create: boolean,
  label: string,
): Promise<string | null> {
  const directory = path.join(parentDirectory, segment);
  let directoryStat;
  try {
    directoryStat = await fs.lstat(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    if (!create) {
      return null;
    }
    try {
      await fs.mkdir(directory, { mode: 0o700 });
    } catch (mkdirError) {
      if ((mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw mkdirError;
      }
    }
    directoryStat = await fs.lstat(directory);
  }
  if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
    throw new OneKeyLocalError(`${label} must be a regular directory`);
  }
  const resolved = await fs.realpath(directory);
  const resolvedParent = await fs.realpath(parentDirectory);
  if (path.relative(resolvedParent, resolved) !== segment) {
    throw new OneKeyLocalError(`${label} escapes dappsDirectory`);
  }
  return resolved;
}

async function resolveCustomInjectedDappDirectory(
  customSession: ICustomInjectedWorkspaceSession,
  protocol: ICustomInjectedProtocol,
  create: boolean,
): Promise<string | null> {
  const sourceDirectory = await resolveCustomInjectedChildDirectory(
    customSession.dappsDirectory,
    protocol.source,
    create,
    'Custom injection DApp source path',
  );
  if (!sourceDirectory) {
    return null;
  }
  const slug = safeRecordingSlug(protocol.slug || protocol.id);
  return resolveCustomInjectedChildDirectory(
    sourceDirectory,
    slug,
    create,
    'Custom injection DApp path',
  );
}

function workspaceRelativeFile(workspace: string, file: string): string {
  return path.relative(workspace, file).split(path.sep).join('/');
}

function customInjectedWorkspaceCliErrorFromOutput(
  output: string,
): string | undefined {
  try {
    const value = JSON.parse(output.trim()) as {
      ok?: unknown;
      error?: unknown;
    };
    return value.ok === false && typeof value.error === 'string'
      ? value.error.trim().slice(0, 2000) || undefined
      : undefined;
  } catch {
    return undefined;
  }
}

function parseCustomInjectedWorkspaceCliOutput<T>(stdout: string): T {
  let value: {
    ok?: unknown;
    result?: unknown;
    error?: unknown;
  };
  try {
    value = JSON.parse(stdout.trim()) as typeof value;
  } catch {
    throw new OneKeyLocalError(
      'Custom injection workspace CLI returned invalid JSON',
    );
  }
  if (value.ok !== true || !value.result || typeof value.result !== 'object') {
    throw new OneKeyLocalError(
      typeof value.error === 'string'
        ? value.error
        : 'Custom injection workspace CLI failed',
    );
  }
  return value.result as T;
}

async function runCustomInjectedWorkspaceCliAction<T>({
  action,
  args = [],
  maxBuffer = CUSTOM_INJECTED_WORKSPACE_CLI_OUTPUT_MAX_BYTES,
  request,
  signal,
  timeout,
  workspace,
  workspaceCliFile,
}: {
  action: string;
  args?: string[];
  maxBuffer?: number;
  request?: unknown;
  signal?: AbortSignal;
  timeout: number;
  workspace: string;
  workspaceCliFile: string;
}): Promise<T> {
  let requestDirectory: string | undefined;
  const cliArgs = [
    workspaceCliFile,
    '--action',
    action,
    '--workspace',
    workspace,
    ...args,
  ];
  try {
    if (request !== undefined) {
      const content = `${JSON.stringify(request)}\n`;
      if (
        Buffer.byteLength(content) >
        CUSTOM_INJECTED_WORKSPACE_CLI_REQUEST_MAX_BYTES
      ) {
        throw new OneKeyLocalError(
          'Custom injection workspace CLI request is too large',
        );
      }
      requestDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'onekey-custom-injection-request-'),
      );
      const requestFile = path.join(requestDirectory, 'request.json');
      await fs.writeFile(requestFile, content, { mode: 0o600 });
      cliArgs.push('--request-file', requestFile);
    }
    const { stdout } = await execFileAsync(process.execPath, cliArgs, {
      cwd: workspace,
      encoding: 'utf8',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      maxBuffer,
      signal,
      timeout,
      windowsHide: true,
    });
    return parseCustomInjectedWorkspaceCliOutput<T>(stdout);
  } catch (error) {
    if (signal?.aborted) throw error;
    const failure = error as Error & {
      code?: number | string;
      signal?: string;
      stderr?: string;
      stdout?: string;
    };
    const message =
      customInjectedWorkspaceCliErrorFromOutput(failure.stderr || '') ||
      failure.message ||
      'Custom injection workspace CLI failed';
    const wrappedError = new OneKeyLocalError(message);
    Object.assign(wrappedError, {
      process: {
        exitCode: failure.code ?? 'unknown',
        ...(failure.signal ? { signal: failure.signal } : undefined),
        stderr: failure.stderr || '',
        stdout: failure.stdout || '',
        processError: failure.message,
      },
    });
    throw wrappedError;
  } finally {
    if (requestDirectory) {
      await fs
        .rm(requestDirectory, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }
}

async function inspectCustomInjectedWorkspaceWithCli({
  workspace,
  workspaceCliFile,
}: {
  workspace: string;
  workspaceCliFile: string;
}): Promise<
  Pick<
    ICustomInjectedWorkspaceSession,
    | 'protocolSources'
    | 'preloadFile'
    | 'dappsDirectory'
    | 'recordingE2EGeneratorFile'
    | 'preloadStamp'
    | 'registrySha256'
    | 'bundleSha256'
    | 'protocols'
  >
> {
  const snapshot =
    await runCustomInjectedWorkspaceCliAction<ICustomInjectedWorkspaceCliSnapshot>(
      {
        action: 'inspect',
        timeout: 60_000,
        workspace,
        workspaceCliFile,
      },
    );
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.kind !== 'onekey-custom-injection-workspace-snapshot' ||
    path.resolve(snapshot.workspace || '') !== workspace ||
    !Array.isArray(snapshot.protocolSources) ||
    snapshot.protocolSources.length < 1 ||
    snapshot.protocolSources.length > 20 ||
    !Array.isArray(snapshot.protocols) ||
    snapshot.protocols.length === 0 ||
    !/^[a-f0-9]{64}$/u.test(snapshot.registrySha256 || '') ||
    !/^[a-f0-9]{64}$/u.test(snapshot.bundleSha256 || '')
  ) {
    throw new OneKeyLocalError(
      'Custom injection workspace CLI returned an invalid snapshot',
    );
  }
  const sourceNames = new Set<string>();
  const protocolSources = await Promise.all(
    snapshot.protocolSources.map(async (sourceSnapshot) => {
      if (
        typeof sourceSnapshot?.source !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(sourceSnapshot.source) ||
        sourceNames.has(sourceSnapshot.source) ||
        !/^[a-f0-9]{64}$/u.test(sourceSnapshot.registrySha256 || '')
      ) {
        throw new OneKeyLocalError(
          'Custom injection workspace CLI returned an invalid protocol source',
        );
      }
      sourceNames.add(sourceSnapshot.source);
      const [registryFile, updaterFile, refresherFile] = await Promise.all([
        resolveWorkspaceFile(
          workspace,
          sourceSnapshot.protocolRegistry,
          `${sourceSnapshot.source}.protocolRegistry`,
        ),
        resolveWorkspaceFile(
          workspace,
          sourceSnapshot.registryUpdater,
          `${sourceSnapshot.source}.registryUpdater`,
        ),
        sourceSnapshot.registryRefresher
          ? resolveWorkspaceFile(
              workspace,
              sourceSnapshot.registryRefresher,
              `${sourceSnapshot.source}.registryRefresher`,
            )
          : Promise.resolve(null),
      ]);
      const registryContent = await readLimitedFile(
        registryFile,
        CUSTOM_INJECTED_REGISTRY_MAX_BYTES,
        `${sourceSnapshot.source} protocol registry`,
      );
      if (sha256(registryContent.content) !== sourceSnapshot.registrySha256) {
        throw new OneKeyLocalError(
          `${sourceSnapshot.source} protocol registry changed during workspace inspection`,
        );
      }
      await readLimitedFile(
        updaterFile,
        CUSTOM_INJECTED_UPDATER_MAX_BYTES,
        `${sourceSnapshot.source} registry updater`,
      );
      if (refresherFile) {
        await readLimitedFile(
          refresherFile,
          CUSTOM_INJECTED_REFRESHER_MAX_BYTES,
          `${sourceSnapshot.source} registry refresher`,
        );
      }
      return {
        source: sourceSnapshot.source,
        registryFile,
        updaterFile,
        refresherFile,
        registryStamp: registryContent.stamp,
        registrySha256: sourceSnapshot.registrySha256,
        protocols: [] as ICustomInjectedProtocol[],
      };
    }),
  );
  const sourceDigests = new Map(
    protocolSources.map(({ source, registrySha256 }) => [
      source,
      registrySha256,
    ]),
  );
  const protocolKeys = new Set<string>();
  const protocols = snapshot.protocols.map((protocol) => {
    if (
      !protocol ||
      typeof protocol.key !== 'string' ||
      protocol.key !== `${protocol.source}:${protocol.id}` ||
      protocolKeys.has(protocol.key) ||
      !sourceDigests.has(protocol.source) ||
      protocol.registrySha256 !== sourceDigests.get(protocol.source) ||
      !isAllowedWebViewUrl(protocol.url) ||
      (protocol.registryUrl !== null &&
        !isAllowedWebViewUrl(protocol.registryUrl)) ||
      !['override', 'resolved', 'registry'].includes(protocol.urlSource) ||
      !['pending', 'processed', 'unsupported'].includes(
        protocol.manualReview?.state,
      )
    ) {
      throw new OneKeyLocalError(
        'Custom injection workspace CLI returned an invalid protocol',
      );
    }
    protocolKeys.add(protocol.key);
    return protocol;
  });
  for (const protocolSource of protocolSources) {
    protocolSource.protocols = protocols.filter(
      (protocol) => protocol.source === protocolSource.source,
    );
  }
  const expectedRegistrySha256 =
    protocolSources.length === 1
      ? protocolSources[0]?.registrySha256 || ''
      : sha256(
          JSON.stringify(
            protocolSources.map(({ source, registrySha256: digest }) => [
              source,
              digest,
            ]),
          ),
        );
  if (snapshot.registrySha256 !== expectedRegistrySha256) {
    throw new OneKeyLocalError(
      'Custom injection workspace CLI returned an invalid registry digest',
    );
  }
  const preloadFile = await resolveWorkspaceFile(
    workspace,
    snapshot.desktopPreload,
    'desktopPreload',
  );
  const preload = await readLimitedFile(
    preloadFile,
    CUSTOM_INJECTED_PRELOAD_MAX_BYTES,
    'Desktop preload',
  );
  if (sha256(preload.content) !== snapshot.bundleSha256) {
    throw new OneKeyLocalError(
      'Desktop preload changed during workspace inspection',
    );
  }
  const dappsDirectory = await resolveWorkspaceOutputDirectory(
    workspace,
    snapshot.dappsDirectory,
    'dappsDirectory',
  );
  const recordingE2EGeneratorFile = snapshot.recordingE2EGenerator
    ? await resolveWorkspaceFile(
        workspace,
        snapshot.recordingE2EGenerator,
        'recordingE2EGenerator',
      )
    : null;
  if (recordingE2EGeneratorFile) {
    await readLimitedFile(
      recordingE2EGeneratorFile,
      CUSTOM_INJECTED_E2E_GENERATOR_MAX_BYTES,
      'Custom injection recording E2E generator',
    );
  }
  return {
    protocolSources,
    preloadFile,
    dappsDirectory,
    recordingE2EGeneratorFile,
    preloadStamp: preload.stamp,
    registrySha256: snapshot.registrySha256,
    bundleSha256: snapshot.bundleSha256,
    protocols,
  };
}

function findCustomInjectedProtocol(
  customSession: ICustomInjectedWorkspaceSession,
  identifier: string,
): ICustomInjectedProtocol | undefined {
  const keyed = customSession.protocols.find(
    (candidate) => candidate.key === identifier,
  );
  if (keyed) return keyed;
  const idMatches = customSession.protocols.filter(
    (candidate) => candidate.id === identifier,
  );
  return idMatches.length === 1 ? idMatches[0] : undefined;
}

async function refreshCustomInjectedSession(
  customSession: ICustomInjectedWorkspaceSession,
): Promise<void> {
  Object.assign(
    customSession,
    await inspectCustomInjectedWorkspaceWithCli({
      workspace: customSession.workspace,
      workspaceCliFile: customSession.workspaceCliFile,
    }),
  );
}

async function cleanupCustomInjectedE2EPreloads(
  customSession: ICustomInjectedWorkspaceSession,
): Promise<void> {
  const directories = [...customSession.e2ePreloadDirectories];
  customSession.e2ePreloadDirectories.clear();
  await Promise.all(
    directories.map((directory) =>
      fs.rm(directory, { force: true, recursive: true }).catch(() => undefined),
    ),
  );
}

function publicCustomInjectedSession(
  customSession: ICustomInjectedWorkspaceSession,
): ICustomInjectedSession {
  return {
    sessionId: customSession.sessionId,
    workspace: customSession.workspace,
    registrySha256: customSession.registrySha256,
    bundleSha256: customSession.bundleSha256,
    preloadUrl: `${pathToFileURL(customSession.preloadFile).href}?sha256=${
      customSession.bundleSha256
    }`,
    sources: customSession.protocolSources.map(({ source }) => source),
    dappsDirectory: path.relative(
      customSession.workspace,
      customSession.dappsDirectory,
    ),
    protocols: customSession.protocols,
  };
}

function getCustomInjectedHostname(url: string): string {
  if (!isAllowedWebViewUrl(url)) {
    return '';
  }
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
  } catch {
    return '';
  }
}

class DesktopApiNetwork extends DesktopApiWebviewBase {
  override async toggleDevTools(
    webContentsId: number,
    devSettingsEnabled: boolean,
  ): Promise<'closed' | 'opened'> {
    const toggle = async (): Promise<'closed' | 'opened'> => {
      if (devSettingsEnabled !== true) {
        throw new OneKeyLocalError(
          'WebView DevTools require enabled developer settings',
        );
      }
      const guest = webContents.fromId(webContentsId);
      if (!guest || guest.isDestroyed() || guest.getType() !== 'webview') {
        throw new OneKeyLocalError('WebView is not available');
      }

      if (guest.isDevToolsOpened()) {
        guest.closeDevTools();
        return 'closed';
      }

      guest.openDevTools({ mode: 'detach', activate: true });
      guest.devToolsWebContents?.focus();
      return 'opened';
    };
    const customSession = activeCustomInjectedSessionId
      ? customInjectedSessions.get(activeCustomInjectedSessionId)
      : undefined;
    if (!customSession) return toggle();
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId: customSession.sessionId,
      operation: 'webview.devtools.toggle',
      input: { webContentsId },
      run: toggle,
      completion: (state) => ({ result: { state } }),
    });
  }

  async selectCustomInjectedWorkspace(
    defaultPath: string | undefined,
    devSettingsEnabled: boolean,
  ): Promise<string | null> {
    ensureCustomInjectedEnabled(devSettingsEnabled);
    const result = await dialog.showOpenDialog({
      title: 'Select cross-inpage-provider workspace',
      ...(defaultPath && path.isAbsolute(defaultPath)
        ? { defaultPath }
        : undefined),
      properties: ['openDirectory'],
    });
    const selected = result.canceled ? null : result.filePaths[0] || null;
    if (!selected) return null;
    return runCustomInjectedLoggedOperation({
      workspace: selected,
      operation: 'workspace.select',
      run: async () => selected,
      completion: (workspace) => ({ result: { workspace } }),
    });
  }

  async prepareCustomInjectedWorkspace(
    workspacePath: string,
    devSettingsEnabled: boolean,
  ): Promise<ICustomInjectedWorkspacePreview> {
    ensureCustomInjectedEnabled(devSettingsEnabled);
    if (typeof workspacePath !== 'string' || !path.isAbsolute(workspacePath)) {
      throw new OneKeyLocalError(
        'Custom injection workspace must be an absolute path',
      );
    }
    const workspace = await fs.realpath(workspacePath);
    const workspaceStat = await fs.stat(workspace);
    if (!workspaceStat.isDirectory()) {
      throw new OneKeyLocalError(
        'Custom injection workspace must be a directory',
      );
    }
    return runCustomInjectedLoggedOperation({
      workspace,
      operation: 'workspace.prepare',
      input: { workspaceCli: CUSTOM_INJECTED_WORKSPACE_CLI },
      run: async () => {
        const workspaceCliFile = await resolveWorkspaceFile(
          workspace,
          CUSTOM_INJECTED_WORKSPACE_CLI,
          'workspace CLI',
        );
        await readLimitedFile(
          workspaceCliFile,
          CUSTOM_INJECTED_E2E_GENERATOR_MAX_BYTES,
          'Custom injection workspace CLI',
        );
        const snapshot = await inspectCustomInjectedWorkspaceWithCli({
          workspace,
          workspaceCliFile,
        });
        const customSession: ICustomInjectedWorkspaceSession = {
          sessionId: crypto.randomUUID(),
          workspace,
          workspaceCliFile,
          ...snapshot,
          e2ePreloadDirectories: new Set(),
          active: false,
        };
        customInjectedSessions.set(customSession.sessionId, customSession);
        return {
          sessionId: customSession.sessionId,
          workspace,
          protocolSources: customSession.protocolSources.map(
            ({ source, registryFile, refresherFile }) => ({
              source,
              protocolRegistry: path.relative(workspace, registryFile),
              registryRefresher: refresherFile
                ? path.relative(workspace, refresherFile)
                : null,
            }),
          ),
          desktopPreload: path.relative(workspace, customSession.preloadFile),
          dappsDirectory: path.relative(
            workspace,
            customSession.dappsDirectory,
          ),
          protocolCount: customSession.protocols.length,
          pendingCount: customSession.protocols.filter(
            (protocol) => protocol.manualReview.state === 'pending',
          ).length,
          bundleSha256: customSession.bundleSha256,
        };
      },
      completion: (preview) => ({
        result: {
          sessionId: preview.sessionId,
          sources: preview.protocolSources.map(({ source }) => source),
          protocolCount: preview.protocolCount,
          pendingCount: preview.pendingCount,
          bundleSha256: preview.bundleSha256,
        },
      }),
    });
  }

  async activateCustomInjectedWorkspace(
    sessionId: string,
  ): Promise<ICustomInjectedSession> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session not found');
    }
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      operation: 'workspace.activate',
      run: async () => {
        await refreshCustomInjectedSession(customSession);
        if (
          activeCustomInjectedSessionId &&
          activeCustomInjectedSessionId !== sessionId
        ) {
          const previousSession = customInjectedSessions.get(
            activeCustomInjectedSessionId,
          );
          if (previousSession) {
            previousSession.active = false;
            await cleanupCustomInjectedE2EPreloads(previousSession);
          }
          customInjectedSessions.delete(activeCustomInjectedSessionId);
        }
        customSession.active = true;
        activeCustomInjectedSessionId = sessionId;
        return publicCustomInjectedSession(customSession);
      },
      completion: (sessionValue) => ({
        result: {
          protocolCount: sessionValue.protocols.length,
          registrySha256: sessionValue.registrySha256,
          bundleSha256: sessionValue.bundleSha256,
        },
      }),
    });
  }

  async getActiveCustomInjectedWorkspace(): Promise<ICustomInjectedSession | null> {
    if (!activeCustomInjectedSessionId) {
      return null;
    }
    const customSession = customInjectedSessions.get(
      activeCustomInjectedSessionId,
    );
    if (!customSession?.active) {
      activeCustomInjectedSessionId = undefined;
      return null;
    }
    return runCustomInjectedErrorLoggedOperation({
      workspace: customSession.workspace,
      sessionId: customSession.sessionId,
      operation: 'workspace.read',
      input: { active: true },
      run: async () => {
        await refreshCustomInjectedSession(customSession);
        return publicCustomInjectedSession(customSession);
      },
    });
  }

  async getCustomInjectedWorkspace(
    sessionId: string,
  ): Promise<ICustomInjectedSession> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    return runCustomInjectedErrorLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      operation: 'workspace.read',
      run: async () => {
        if (!customSession.active) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        await refreshCustomInjectedSession(customSession);
        return publicCustomInjectedSession(customSession);
      },
    });
  }

  async prepareCustomInjectedE2EPreload(
    request: ICustomInjectedE2EPreloadRequest,
  ): Promise<ICustomInjectedE2EPreloadResult> {
    const customSession = customInjectedSessions.get(request.sessionId);
    if (
      !customSession?.active ||
      activeCustomInjectedSessionId !== request.sessionId
    ) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    if (
      (request.mode !== 'enabled' && request.mode !== 'disabled') ||
      typeof request.token !== 'string' ||
      request.token.length < 16 ||
      request.token.length > 128
    ) {
      throw new OneKeyLocalError('Custom injection E2E adapter control is invalid');
    }
    await refreshCustomInjectedSession(customSession);
    if (
      !/^[a-f0-9]{64}$/u.test(request.bundleSha256) ||
      request.bundleSha256 !== customSession.bundleSha256
    ) {
      throw new OneKeyLocalError('Custom injection bundle has changed');
    }
    const preload = await readLimitedFile(
      customSession.preloadFile,
      CUSTOM_INJECTED_PRELOAD_MAX_BYTES,
      'Desktop preload',
    );
    if (sha256(preload.content) !== customSession.bundleSha256) {
      throw new OneKeyLocalError('Custom injection bundle has changed');
    }

    await cleanupCustomInjectedE2EPreloads(customSession);
    const temporaryRoot = await fs.realpath(os.tmpdir());
    const directory = await fs.mkdtemp(
      path.join(temporaryRoot, 'onekey-custom-injection-e2e-'),
    );
    customSession.e2ePreloadDirectories.add(directory);
    const file = path.join(directory, 'injectedDesktopPreload.js');
    const bootstrap = Buffer.from(
      `Object.defineProperty(globalThis, ${JSON.stringify(
        CUSTOM_INJECTED_E2E_PRELOAD_CONTROL_KEY,
      )}, { configurable: false, enumerable: false, writable: false, value: Object.freeze(${JSON.stringify(
        {
          version: 1,
          mode: request.mode,
          token: request.token,
        },
      )}) });\n`,
      'utf8',
    );
    const controlledPreload = Buffer.concat([bootstrap, preload.content]);
    await fs.writeFile(file, controlledPreload, { flag: 'wx', mode: 0o600 });
    return {
      mode: request.mode,
      token: request.token,
      preloadUrl: `${pathToFileURL(file).href}?sha256=${sha256(
        controlledPreload,
      )}`,
    };
  }

  async focusCustomInjectedE2EWebView(
    request: ICustomInjectedE2EFocusRequest,
  ): Promise<ICustomInjectedE2EFocusResult> {
    const customSession = customInjectedSessions.get(request.sessionId);
    if (
      !customSession?.active ||
      activeCustomInjectedSessionId !== request.sessionId
    ) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    if (
      !Number.isSafeInteger(request.webContentsId) ||
      request.webContentsId <= 0
    ) {
      throw new OneKeyLocalError('Custom injection WebView is not available');
    }
    await refreshCustomInjectedSession(customSession);
    const protocol = findCustomInjectedProtocol(
      customSession,
      request.protocolId,
    );
    if (!protocol) {
      throw new OneKeyLocalError('Custom injection protocol not found');
    }
    const guest = webContents.fromId(request.webContentsId);
    if (!guest || guest.isDestroyed() || guest.getType() !== 'webview') {
      throw new OneKeyLocalError('Custom injection WebView is not available');
    }
    if (guest.session.isPersistent()) {
      throw new OneKeyLocalError(
        'Custom injection E2E focus requires a private WebView session',
      );
    }
    const partition = guest.session.getPartition();
    if (!/^onekey-custom-e2e-[a-z0-9]+$/u.test(partition)) {
      throw new OneKeyLocalError(
        'Custom injection E2E focus requires a clean-session partition',
      );
    }
    const currentHostname = getCustomInjectedHostname(guest.getURL());
    const reportedHostname = getCustomInjectedHostname(request.pageUrl);
    const protocolHostname = getCustomInjectedHostname(protocol.url);
    if (
      !currentHostname ||
      currentHostname !== reportedHostname ||
      currentHostname !== protocolHostname
    ) {
      throw new OneKeyLocalError(
        `Custom injection E2E focus hostname mismatch for "${protocol.key}"`,
      );
    }
    guest.focus();
    if (!guest.isFocused()) {
      throw new OneKeyLocalError('Custom injection E2E WebView did not receive focus');
    }
    return { focused: true, webContentsId: request.webContentsId };
  }

  async getCustomInjectedE2EState(
    sessionId: string,
    protocolId: string,
  ): Promise<ICustomInjectedE2EWorkflowState> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(customSession, protocolId);
    return runCustomInjectedErrorLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      protocol: logProtocol,
      operation: 'e2e.state.read',
      input: { protocolId },
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const protocol = findCustomInjectedProtocol(customSession, protocolId);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        return runCustomInjectedWorkspaceCliAction<ICustomInjectedE2EWorkflowState>(
          {
            action: 'e2e-state',
            args: ['--protocol-id', protocol.key],
            timeout: 60_000,
            workspace: customSession.workspace,
            workspaceCliFile: customSession.workspaceCliFile,
          },
        );
      },
    });
  }

  async getCustomInjectedE2EStates(
    sessionId: string,
  ): Promise<Record<string, ICustomInjectedE2EWorkflowSummary>> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    return runCustomInjectedErrorLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      operation: 'e2e.states.read',
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        await refreshCustomInjectedSession(customSession);
        const result =
          await runCustomInjectedWorkspaceCliAction<ICustomInjectedWorkspaceCliE2EStatesResult>(
            {
              action: 'e2e-states',
              timeout: 120_000,
              workspace: customSession.workspace,
              workspaceCliFile: customSession.workspaceCliFile,
            },
          );
        await Promise.all(
          result.errors.map(async ({ error, protocolId }) => {
            const protocol = findCustomInjectedProtocol(
              customSession,
              protocolId,
            );
            await writeCustomInjectedOperationLog(customSession.workspace, {
              operationId: crypto.randomUUID(),
              operation: 'e2e.state.read',
              status: 'error',
              sessionId: customSession.sessionId,
              protocol: protocol
                ? customInjectedOperationProtocol(protocol)
                : undefined,
              input: { mode: 'summary' },
              error: new Error(error),
            });
          }),
        );
        return result.states;
      },
    });
  }

  async getCustomInjectedDappDirectory(
    sessionId: string,
    protocolId: string,
  ): Promise<string> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(customSession, protocolId);
    return runCustomInjectedErrorLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      protocol: logProtocol,
      operation: 'dapp-directory.resolve',
      input: { protocolId },
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const protocol = findCustomInjectedProtocol(customSession, protocolId);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        const dappDirectory = await resolveCustomInjectedDappDirectory(
          customSession,
          protocol,
          true,
        );
        if (!dappDirectory) {
          throw new OneKeyLocalError(
            'Custom injection DApp directory is unavailable',
          );
        }
        return dappDirectory;
      },
    });
  }

  async openCustomInjectedDappDirectory(
    sessionId: string,
    protocolId: string,
  ): Promise<void> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(customSession, protocolId);
    await runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      protocol: logProtocol,
      operation: 'dapp-directory.open',
      input: { protocolId },
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const protocol = findCustomInjectedProtocol(customSession, protocolId);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        const dappDirectory = await resolveCustomInjectedDappDirectory(
          customSession,
          protocol,
          true,
        );
        if (!dappDirectory) {
          throw new OneKeyLocalError(
            'Custom injection DApp directory is unavailable',
          );
        }
        try {
          await execFileAsync('code', [dappDirectory], {
            cwd: customSession.workspace,
            env: { ...process.env },
            timeout: 15_000,
            windowsHide: true,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new OneKeyLocalError(
            `Failed to open DApp directory in VS Code: ${detail}`,
          );
        }
        return workspaceRelativeFile(customSession.workspace, dappDirectory);
      },
      completion: (relativeDirectory) => ({
        result: { opened: true, relativeDirectory },
      }),
    });
  }

  async runCustomInjectedE2E(
    sessionId: string,
    protocolId: string,
  ): Promise<ICustomInjectedE2ERunOutcome> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(customSession, protocolId);
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      protocol: logProtocol,
      operation: 'e2e.validate',
      input: { protocolId },
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const protocol = findCustomInjectedProtocol(customSession, protocolId);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        await this.prepareCustomInjectedE2EValidation(sessionId, protocol.key);
        const runKey = `${sessionId}:${protocol.key}`;
        if (
          customInjectedE2ERuns.has(runKey) ||
          customInjectedE2EGenerations.has(runKey)
        ) {
          throw new OneKeyLocalError(
            'E2E generation or validation is already running',
          );
        }
        const abortController = new AbortController();
        customInjectedE2ERuns.add(runKey);
        customInjectedE2ERunAbortControllers.set(runKey, abortController);
        try {
          try {
            return await runCustomInjectedWorkspaceCliAction<ICustomInjectedE2ERunOutcome>(
              {
                action: 'e2e-run',
                args: ['--protocol-id', protocol.key],
                signal: abortController.signal,
                timeout: CUSTOM_INJECTED_E2E_PROCESS_TIMEOUT_MS + 30_000,
                workspace: customSession.workspace,
                workspaceCliFile: customSession.workspaceCliFile,
              },
            );
          } catch (error) {
            if (abortController.signal.aborted) {
              return {
                ok: false,
                cancelled: true,
                error: 'E2E validation stopped by user',
                log: '',
              };
            }
            throw error;
          }
        } finally {
          customInjectedE2ERuns.delete(runKey);
          if (
            customInjectedE2ERunAbortControllers.get(runKey) === abortController
          ) {
            customInjectedE2ERunAbortControllers.delete(runKey);
          }
        }
      },
      completion: (outcome) => {
        if (outcome.ok) {
          const result = {
            passed: outcome.result.passed,
            recordingSha256: outcome.result.recordingSha256,
            passes: outcome.result.passes,
            processLog: outcome.log,
          };
          if (!outcome.result.passed) {
            const attemptCount = outcome.result.passes.length;
            return {
              error: new Error(
                `E2E validation failed after ${String(attemptCount)} ${
                  attemptCount === 1 ? 'attempt' : 'attempts'
                }`,
              ),
              result,
            };
          }
          return {
            result,
          };
        }
        if (outcome.cancelled) {
          return {
            result: {
              cancelled: true,
              message: 'E2E validation stopped by user',
              processLog: outcome.log,
            },
          };
        }
        return {
          error: new Error(outcome.error),
          result: { processLog: outcome.log },
        };
      },
    });
  }

  async stopCustomInjectedE2E(
    sessionId: string,
    protocolId: string,
  ): Promise<ICustomInjectedE2EStopResult> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(customSession, protocolId);
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      protocol: logProtocol,
      operation: 'e2e.validate.stop',
      input: { protocolId },
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const protocol = findCustomInjectedProtocol(customSession, protocolId);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        const runKey = `${sessionId}:${protocol.key}`;
        const abortController =
          customInjectedE2ERunAbortControllers.get(runKey);
        if (!abortController || abortController.signal.aborted) {
          return { stopped: false };
        }
        abortController.abort();
        return { stopped: true };
      },
      completion: ({ stopped }) => {
        const result = {
          stopped,
          message: stopped
            ? 'E2E validation stop requested'
            : 'E2E validation was no longer running',
        };
        return stopped
          ? { result }
          : { error: new Error(result.message), result };
      },
    });
  }

  async saveCustomInjectedRecording(
    request: ICustomInjectedSaveRecordingRequest,
  ): Promise<ICustomInjectedSaveRecordingResult> {
    const customSession = customInjectedSessions.get(request.sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(
      customSession,
      request.protocolId,
    );
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId: request.sessionId,
      protocol: logProtocol,
      operation: 'recording.save',
      input: {
        protocolId: request.protocolId,
        webContentsId: request.webContentsId,
        bundleSha256: request.bundleSha256,
        expectedRegistrySha256: request.expectedRegistrySha256,
        stepCount: request.recording?.steps?.length,
      },
      run: async () => {
        ensureCustomInjectedEnabled(request.devSettingsEnabled);
        if (request.customInjectionEnabled !== true) {
          throw new OneKeyLocalError('Custom injection is not enabled');
        }
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== request.sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        if (
          !Number.isSafeInteger(request.webContentsId) ||
          request.webContentsId <= 0
        ) {
          throw new OneKeyLocalError(
            'Custom injection WebView is not available',
          );
        }
        await refreshCustomInjectedSession(customSession);
        if (
          !/^[a-f0-9]{64}$/u.test(request.bundleSha256) ||
          request.bundleSha256 !== customSession.bundleSha256
        ) {
          throw new OneKeyLocalError('Custom injection bundle has changed');
        }

        const protocol = findCustomInjectedProtocol(
          customSession,
          request.protocolId,
        );
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        if (request.expectedRegistrySha256 !== protocol.registrySha256) {
          throw new OneKeyLocalError(
            `Custom injection protocol registry changed before recording save for "${protocol.key}"`,
          );
        }
        const guest = webContents.fromId(request.webContentsId);
        if (!guest || guest.isDestroyed() || guest.getType() !== 'webview') {
          throw new OneKeyLocalError(
            'Custom injection WebView is not available',
          );
        }
        if (guest.session.isPersistent()) {
          throw new OneKeyLocalError(
            'Custom injection recording requires a private WebView session',
          );
        }

        const currentUrl = guest.getURL();
        const result =
          await runCustomInjectedWorkspaceCliAction<ICustomInjectedWorkspaceCliRecordingSaveResult>(
            {
              action: 'recording-save',
              request: {
                bundleSha256: request.bundleSha256,
                currentUrl,
                expectedRegistrySha256: request.expectedRegistrySha256,
                pageUrl: request.pageUrl,
                privateSession: true,
                protocolId: protocol.key,
                recording: request.recording,
              },
              timeout: 60_000,
              workspace: customSession.workspace,
              workspaceCliFile: customSession.workspaceCliFile,
            },
          );
        if (
          result.schemaVersion !== 1 ||
          result.kind !== 'onekey-custom-injection-recording-save-result' ||
          !/^[a-f0-9]{64}$/u.test(result.sha256) ||
          !Number.isSafeInteger(result.stepCount) ||
          result.stepCount < 1 ||
          result.stepCount > CUSTOM_INJECTED_RECORDING_MAX_STEPS ||
          typeof result.relativeFile !== 'string' ||
          !result.relativeFile.endsWith('/recording.json')
        ) {
          throw new OneKeyLocalError(
            'Custom injection workspace CLI returned an invalid recording result',
          );
        }
        return {
          relativeFile: result.relativeFile,
          sha256: result.sha256,
          stepCount: result.stepCount,
        };
      },
      completion: (result) => ({ result }),
    });
  }

  async generateCustomInjectedE2E(
    sessionId: string,
    protocolId: string,
  ): Promise<ICustomInjectedE2EGenerationResult> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(customSession, protocolId);
    let generatorProcessLog: ICustomInjectedWorkspaceCliProcess | undefined;
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      protocol: logProtocol,
      operation: 'e2e.generate',
      input: { protocolId },
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const initialProtocol = findCustomInjectedProtocol(
          customSession,
          protocolId,
        );
        if (!initialProtocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        const runKey = `${sessionId}:${initialProtocol.key}`;
        if (
          customInjectedE2EGenerations.has(runKey) ||
          customInjectedE2ERuns.has(runKey)
        ) {
          throw new OneKeyLocalError(
            'E2E generation or validation is already running',
          );
        }
        const abortController = new AbortController();
        customInjectedE2EGenerations.add(runKey);
        customInjectedE2EGenerationAbortControllers.set(
          runKey,
          abortController,
        );
        try {
          await refreshCustomInjectedSession(customSession);
          if (abortController.signal.aborted) {
            return {
              ok: false,
              cancelled: true,
              error: 'E2E generation stopped by user',
            } as const;
          }
          const protocol = findCustomInjectedProtocol(
            customSession,
            initialProtocol.key,
          );
          if (!protocol) {
            throw new OneKeyLocalError('Custom injection protocol not found');
          }
          await this.prepareCustomInjectedE2EValidation(
            sessionId,
            protocol.key,
          );
          try {
            const result =
              await runCustomInjectedWorkspaceCliAction<ICustomInjectedWorkspaceCliE2EGenerationResult>(
                {
                  action: 'e2e-generate',
                  args: ['--protocol-id', protocol.key],
                  signal: abortController.signal,
                  timeout: CUSTOM_INJECTED_E2E_PROCESS_TIMEOUT_MS + 30_000,
                  workspace: customSession.workspace,
                  workspaceCliFile: customSession.workspaceCliFile,
                },
              );
            generatorProcessLog = result.process;
            return result.ok
              ? {
                  ok: true,
                  relativeFile: result.relativeFile,
                  recordingSha256: result.recordingSha256,
                  actionCount: result.actionCount,
                  validated: result.validated,
                  validationPasses: result.validationPasses,
                }
              : {
                  ok: false,
                  ...(result.cancelled ? { cancelled: true } : undefined),
                  error: result.error,
                };
          } catch (error) {
            if (abortController.signal.aborted) {
              return {
                ok: false,
                cancelled: true,
                error: 'E2E generation stopped by user',
              } as const;
            }
            throw error;
          }
        } finally {
          customInjectedE2EGenerations.delete(runKey);
          if (
            customInjectedE2EGenerationAbortControllers.get(runKey) ===
            abortController
          ) {
            customInjectedE2EGenerationAbortControllers.delete(runKey);
          }
        }
      },
      completion: (result) => {
        if (result.ok) {
          return { result: { ...result, process: generatorProcessLog } };
        }
        if (result.cancelled) {
          return {
            result: {
              cancelled: true,
              message: result.error,
              promoted: false,
              process: generatorProcessLog,
            },
          };
        }
        return {
          error: new Error(result.error),
          result: { promoted: false, process: generatorProcessLog },
        };
      },
    });
  }

  async stopCustomInjectedE2EGeneration(
    sessionId: string,
    protocolId: string,
  ): Promise<ICustomInjectedE2EStopResult> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(customSession, protocolId);
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      protocol: logProtocol,
      operation: 'e2e.generate.stop',
      input: { protocolId },
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const protocol = findCustomInjectedProtocol(customSession, protocolId);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        const runKey = `${sessionId}:${protocol.key}`;
        const abortController =
          customInjectedE2EGenerationAbortControllers.get(runKey);
        if (!abortController || abortController.signal.aborted) {
          return { stopped: false };
        }
        abortController.abort();
        return { stopped: true };
      },
      completion: ({ stopped }) => {
        const result = {
          stopped,
          message: stopped
            ? 'E2E generation stop requested'
            : 'E2E generation was no longer running',
        };
        return stopped
          ? { result }
          : { error: new Error(result.message), result };
      },
    });
  }

  async processCustomInjectedAutoReview(
    request: ICustomInjectedAutoReviewRequest,
  ): Promise<ICustomInjectedAutoReviewResult> {
    const customSession = customInjectedSessions.get(request.sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(
      customSession,
      request.protocolId,
    );
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId: request.sessionId,
      protocol: logProtocol,
      operation: 'auto-review.process',
      input: {
        protocolId: request.protocolId,
        pageUrl: request.pageUrl,
        webContentsId: request.webContentsId,
        bundleSha256: request.bundleSha256,
      },
      run: async () => {
        ensureCustomInjectedEnabled(request.devSettingsEnabled);
        if (request.customInjectionEnabled !== true) {
          throw new OneKeyLocalError('Custom injection is not enabled');
        }
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== request.sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        if (
          !Number.isSafeInteger(request.webContentsId) ||
          request.webContentsId <= 0
        ) {
          throw new OneKeyLocalError(
            'Custom injection WebView is not available',
          );
        }
        await refreshCustomInjectedSession(customSession);
        if (
          !/^[a-f0-9]{64}$/u.test(request.bundleSha256) ||
          request.bundleSha256 !== customSession.bundleSha256
        ) {
          throw new OneKeyLocalError('Custom injection bundle has changed');
        }

        const protocol = findCustomInjectedProtocol(
          customSession,
          request.protocolId,
        );
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        const guest = webContents.fromId(request.webContentsId);
        if (!guest || guest.isDestroyed() || guest.getType() !== 'webview') {
          throw new OneKeyLocalError(
            'Custom injection WebView is not available',
          );
        }
        const currentUrl = guest.getURL();
        const currentHostname = getCustomInjectedHostname(currentUrl);
        const reportedHostname = getCustomInjectedHostname(request.pageUrl);
        const protocolHostname = getCustomInjectedHostname(protocol.url);
        if (!currentHostname) {
          throw new OneKeyLocalError(
            `Custom injection review active WebView hostname is invalid for "${protocol.key}": actual="<invalid>", expected an allowed WebView hostname`,
          );
        }
        if (currentHostname !== reportedHostname) {
          throw new OneKeyLocalError(
            `Custom injection review page hostname mismatch for "${protocol.key}": actual="${
              reportedHostname || '<invalid>'
            }" (reported page), expected="${currentHostname}" (active WebView)`,
          );
        }
        if (currentHostname !== protocolHostname) {
          throw new OneKeyLocalError(
            `Custom injection review protocol hostname mismatch for "${
              protocol.key
            }": actual="${currentHostname}" (active WebView and reported page), expected="${
              protocolHostname || '<invalid>'
            }" (selected protocol)`,
          );
        }
        if (protocol.manualReview.state === 'processed') {
          return {
            session: publicCustomInjectedSession(customSession),
            updated: false,
          };
        }
        if (request.expectedRegistrySha256 !== protocol.registrySha256) {
          throw new OneKeyLocalError(
            `Custom injection review registry changed before auto-review for "${protocol.key}": actual="${protocol.registrySha256}", expected="${request.expectedRegistrySha256}"`,
          );
        }

        const updatedSession = await this.updateCustomInjectedProtocolRegistry(
          {
            action: 'set-review',
            sessionId: request.sessionId,
            protocolId: request.protocolId,
            expectedRegistrySha256: protocol.registrySha256,
            state: 'processed',
            reviewedUrl: currentUrl,
            bundleSha256: customSession.bundleSha256,
          },
          true,
        );
        return { session: updatedSession, updated: true };
      },
      completion: (result) => ({
        result: {
          updated: result.updated,
          registrySha256: result.session.registrySha256,
        },
      }),
    });
  }

  async updateCustomInjectedProtocol(
    update: ICustomInjectedProtocolUpdate,
  ): Promise<ICustomInjectedSession> {
    return this.updateCustomInjectedProtocolRegistry(update);
  }

  async prepareCustomInjectedE2EValidation(
    sessionId: string,
    protocolId: string,
  ): Promise<ICustomInjectedSession> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(customSession, protocolId);
    return runCustomInjectedErrorLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      protocol: logProtocol,
      operation: 'e2e.validate.prepare',
      input: { protocolId },
      run: async () => {
        if (
          !customSession.active ||
          activeCustomInjectedSessionId !== sessionId
        ) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const protocol = findCustomInjectedProtocol(customSession, protocolId);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        if (protocol.manualReview.state === 'pending') {
          return publicCustomInjectedSession(customSession);
        }
        return this.updateCustomInjectedProtocolRegistry({
          action: 'set-review',
          sessionId,
          protocolId: protocol.key,
          expectedRegistrySha256: protocol.registrySha256,
          state: 'pending',
        });
      },
    });
  }

  private async updateCustomInjectedProtocolRegistry(
    update: ICustomInjectedProtocolUpdate,
    allowProcessedReview = false,
  ): Promise<ICustomInjectedSession> {
    const customSession = customInjectedSessions.get(update.sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    const logProtocol = findCustomInjectedProtocol(
      customSession,
      update.protocolId,
    );
    let updatedProtocolKey = logProtocol?.key;
    let updaterProcessLog: ICustomInjectedWorkspaceCliProcess | undefined;
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId: update.sessionId,
      protocol: logProtocol,
      operation: 'protocol.update',
      input:
        update.action === 'set-url'
          ? { action: update.action, url: update.url }
          : { action: update.action, state: update.state },
      run: async () => {
        if (!customSession.active) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        if (
          update.action === 'set-review' &&
          update.state === 'processed' &&
          !allowProcessedReview
        ) {
          throw new OneKeyLocalError(
            'Processed review can only be set by OneKey icon auto-detection',
          );
        }
        const protocol = findCustomInjectedProtocol(
          customSession,
          update.protocolId,
        );
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        updatedProtocolKey = protocol.key;
        if (update.expectedRegistrySha256 !== protocol.registrySha256) {
          throw new OneKeyLocalError('Custom injection registry has changed');
        }
        if (update.action === 'set-url') {
          if (update.url && !isAllowedWebViewUrl(update.url)) {
            throw new OneKeyLocalError(
              'Custom injection protocol URL must be a safe HTTPS URL',
            );
          }
        } else if (
          update.state === 'processed' &&
          (!update.reviewedUrl || !update.bundleSha256)
        ) {
          throw new OneKeyLocalError(
            'Processed review requires reviewed URL and bundle SHA-256',
          );
        }
        const result =
          await runCustomInjectedWorkspaceCliAction<ICustomInjectedWorkspaceCliProtocolUpdateResult>(
            {
              action: 'protocol-update',
              request: { ...update, protocolId: protocol.key },
              timeout: 60_000,
              workspace: customSession.workspace,
              workspaceCliFile: customSession.workspaceCliFile,
            },
          );
        if (
          result.schemaVersion !== 1 ||
          result.kind !== 'onekey-custom-injection-protocol-update-result'
        ) {
          throw new OneKeyLocalError(
            'Custom injection workspace CLI returned an invalid protocol update result',
          );
        }
        updaterProcessLog = result.process;
        if (!result.ok) {
          const wrappedError = new OneKeyLocalError(
            result.error || 'Failed to update custom injection registry',
          );
          if (updaterProcessLog) {
            Object.assign(wrappedError, { process: updaterProcessLog });
          }
          throw wrappedError;
        }
        if (
          !result.protocol ||
          result.protocol.key !== protocol.key ||
          !/^[a-f0-9]{64}$/u.test(result.protocol.registrySha256)
        ) {
          throw new OneKeyLocalError(
            'Custom injection workspace CLI returned an invalid updated protocol',
          );
        }
        await refreshCustomInjectedSession(customSession);
        return publicCustomInjectedSession(customSession);
      },
      completion: (sessionValue) => ({
        result: {
          registrySha256: sessionValue.registrySha256,
          protocol: sessionValue.protocols.find(
            (candidate) => candidate.key === updatedProtocolKey,
          ),
          process: updaterProcessLog,
        },
      }),
    });
  }

  async refreshCustomInjectedProtocols(
    sessionId: string,
  ): Promise<ICustomInjectedSession> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    let refresherProcessLogs: Array<
      ICustomInjectedWorkspaceCliProcess & { source: string }
    > = [];
    return runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      operation: 'protocols.refresh',
      input: {
        sources: customSession.protocolSources
          .filter((protocolSource) => protocolSource.refresherFile)
          .map((protocolSource) => protocolSource.source),
      },
      run: async () => {
        if (!customSession.active) {
          throw new OneKeyLocalError('Custom injection session is not active');
        }
        const result =
          await runCustomInjectedWorkspaceCliAction<ICustomInjectedWorkspaceCliProtocolRefreshResult>(
            {
              action: 'protocols-refresh',
              timeout: 150_000,
              workspace: customSession.workspace,
              workspaceCliFile: customSession.workspaceCliFile,
            },
          );
        if (
          result.schemaVersion !== 1 ||
          result.kind !== 'onekey-custom-injection-protocol-refresh-result' ||
          !Array.isArray(result.processes)
        ) {
          throw new OneKeyLocalError(
            'Custom injection workspace CLI returned an invalid protocol refresh result',
          );
        }
        refresherProcessLogs = result.processes;
        if (!result.ok) {
          const wrappedError = new OneKeyLocalError(
            result.error || 'Failed to refresh custom injection protocols',
          );
          const failedProcess = refresherProcessLogs.find(
            ({ exitCode }) => exitCode !== 0,
          );
          if (failedProcess) {
            Object.assign(wrappedError, { process: failedProcess });
          }
          throw wrappedError;
        }
        await refreshCustomInjectedSession(customSession);
        return publicCustomInjectedSession(customSession);
      },
      completion: (sessionValue) => ({
        result: {
          registrySha256: sessionValue.registrySha256,
          protocolCount: sessionValue.protocols.length,
          processes: refresherProcessLogs.toSorted((a, b) =>
            a.source.localeCompare(b.source),
          ),
        },
      }),
    });
  }

  async logCustomInjectedClientOperation(
    request: ICustomInjectedClientOperationLogRequest,
  ): Promise<void> {
    const customSession = customInjectedSessions.get(request.sessionId);
    if (!customSession?.active) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    if (
      typeof request.operationId !== 'string' ||
      request.operationId.length < 8 ||
      request.operationId.length > 128 ||
      !/^[a-z0-9-]+$/iu.test(request.operationId) ||
      !CUSTOM_INJECTED_CLIENT_LOG_OPERATIONS.has(request.operation) ||
      !['start', 'result', 'error'].includes(request.status)
    ) {
      throw new OneKeyLocalError(
        'Custom injection client operation log is invalid',
      );
    }
    if (
      request.durationMs !== null &&
      request.durationMs !== undefined &&
      (!Number.isSafeInteger(request.durationMs) ||
        request.durationMs < 0 ||
        request.durationMs > 24 * 60 * 60 * 1000)
    ) {
      throw new OneKeyLocalError(
        'Custom injection client operation duration is invalid',
      );
    }
    const protocol = request.protocolId
      ? findCustomInjectedProtocol(customSession, request.protocolId)
      : undefined;
    await writeCustomInjectedOperationLog(customSession.workspace, {
      operationId: request.operationId,
      operation: request.operation,
      status: request.status,
      sessionId: request.sessionId,
      ...(protocol
        ? { protocol: customInjectedOperationProtocol(protocol) }
        : undefined),
      ...(request.durationMs !== null && request.durationMs !== undefined
        ? { durationMs: request.durationMs }
        : undefined),
      ...(request.input ? { input: request.input } : undefined),
      ...(request.result ? { result: request.result } : undefined),
      ...(request.error
        ? {
            error: {
              name: 'ClientOperationError',
              message: request.error.slice(0, 64 * 1024),
            },
          }
        : undefined),
    });
  }

  async getCustomInjectedRecentOperationLogs(
    sessionId: string,
  ): Promise<ICustomInjectedOperationLogRecord[]> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession?.active) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    return selectCustomInjectedRecentOperationLogs(
      (
        await readCustomInjectedOperationLogs(customSession.workspace, 1000)
      ).filter((record) => !record.operation.startsWith('logs.')),
    );
  }

  getCustomInjectedOperationLogAppStartedAt(): number {
    return CUSTOM_INJECTED_OPERATION_LOG_APP_STARTED_AT;
  }

  async openCustomInjectedOperationLogFile(sessionId: string): Promise<void> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession?.active) {
      throw new OneKeyLocalError('Custom injection session is not active');
    }
    await runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      operation: 'logs.open',
      run: async () => {
        const logFile = await getCustomInjectedOperationLogFile(
          customSession.workspace,
        );
        try {
          await execFileAsync('code', [logFile], {
            cwd: customSession.workspace,
            env: { ...process.env },
            timeout: 15_000,
            windowsHide: true,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new OneKeyLocalError(
            `Failed to open operation log in VS Code: ${detail}`,
          );
        }
        return workspaceRelativeFile(customSession.workspace, logFile);
      },
      completion: (relativeFile) => ({
        result: { opened: true, relativeFile },
      }),
    });
  }

  async closeCustomInjectedWorkspace(sessionId: string): Promise<void> {
    const customSession = customInjectedSessions.get(sessionId);
    if (!customSession) return;
    await runCustomInjectedLoggedOperation({
      workspace: customSession.workspace,
      sessionId,
      operation: 'workspace.close',
      run: async () => {
        if (activeCustomInjectedSessionId === sessionId) {
          activeCustomInjectedSessionId = undefined;
        }
        await cleanupCustomInjectedE2EPreloads(customSession);
        customInjectedSessions.delete(sessionId);
      },
      completion: () => ({ result: { closed: true } }),
    });
  }
}

export default DesktopApiNetwork;
