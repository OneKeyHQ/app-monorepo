import { execFile } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
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
const CUSTOM_INJECTED_RECORDING_MAX_BYTES = 1024 * 1024;
const CUSTOM_INJECTED_ADAPTER_MAX_BYTES = 1024 * 1024;
const CUSTOM_INJECTED_RECORDING_MAX_STEPS = 100;
const CUSTOM_INJECTED_E2E_MAX_BYTES = 256 * 1024;
const CUSTOM_INJECTED_E2E_RESULT_MAX_BYTES = 1024 * 1024;
const CUSTOM_INJECTED_E2E_RESULT_FILE_MAX_BYTES = 256 * 1024;
const CUSTOM_INJECTED_E2E_LOG_MAX_BYTES = 1024 * 1024;
const CUSTOM_INJECTED_E2E_MAX_ATTEMPTS = 5;
const CUSTOM_INJECTED_E2E_PROCESS_TIMEOUT_MS = 450_000;
const CUSTOM_INJECTED_WORKSPACE_CLI_OUTPUT_MAX_BYTES = 48 * 1024 * 1024;

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
  role?: string;
  name?: string;
};

export type ICustomInjectedRecordingTarget = {
  tag: string;
  text: string | null;
  role: string | null;
  ariaLabel: string | null;
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
  schemaVersion: 1;
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
  passes: Array<{
    name: string;
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

function boundedString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new OneKeyLocalError(`${label} must be a string`);
  }
  const result = value.trim();
  if (!result || result.length > maxLength) {
    throw new OneKeyLocalError(
      `${label} length must be between 1 and ${String(maxLength)}`,
    );
  }
  return result;
}

function nullableBoundedString(
  value: unknown,
  label: string,
  maxLength: number,
): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return boundedString(value, label, maxLength);
}

function boundedNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    throw new OneKeyLocalError(
      `${label} must be between ${String(minimum)} and ${String(maximum)}`,
    );
  }
  return result;
}

function isoTimestamp(value: unknown, label: string): string {
  const result = boundedString(value, label, 40);
  if (Number.isNaN(Date.parse(result))) {
    throw new OneKeyLocalError(`${label} must be an ISO timestamp`);
  }
  return result;
}

const CUSTOM_INJECTED_RECORDING_SELECTOR_KINDS = new Set<
  ICustomInjectedRecordingSelector['kind']
>(['testId', 'dataTest', 'dataCy', 'id', 'ariaLabel', 'role', 'text', 'css']);
const CUSTOM_INJECTED_RECORDING_KEYS = new Set([
  'Enter',
  'Escape',
  'Tab',
  ' ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

function normalizeRecordingSelector(
  value: unknown,
  index: number,
): ICustomInjectedRecordingSelector {
  if (!value || typeof value !== 'object') {
    throw new OneKeyLocalError(
      `recording selector ${String(index)} must be an object`,
    );
  }
  const selector = value as Partial<ICustomInjectedRecordingSelector>;
  if (
    !selector.kind ||
    !CUSTOM_INJECTED_RECORDING_SELECTOR_KINDS.has(selector.kind)
  ) {
    throw new OneKeyLocalError(
      `recording selector ${String(index)} has an unsupported kind`,
    );
  }
  const normalized: ICustomInjectedRecordingSelector = {
    kind: selector.kind,
    value: boundedString(
      selector.value,
      `recording selector ${String(index)} value`,
      512,
    ),
    unique: selector.unique === true,
  };
  if (selector.kind === 'role') {
    normalized.role = boundedString(
      selector.role,
      `recording selector ${String(index)} role`,
      80,
    );
    normalized.name = boundedString(
      selector.name,
      `recording selector ${String(index)} name`,
      240,
    );
  }
  return normalized;
}

function normalizeRecordingTarget(
  value: unknown,
  stepIndex: number,
): ICustomInjectedRecordingTarget {
  if (!value || typeof value !== 'object') {
    throw new OneKeyLocalError(
      `recording step ${String(stepIndex)} target must be an object`,
    );
  }
  const target = value as Partial<ICustomInjectedRecordingTarget>;
  if (!Array.isArray(target.selectors) || target.selectors.length === 0) {
    throw new OneKeyLocalError(
      `recording step ${String(stepIndex)} requires selectors`,
    );
  }
  if (target.selectors.length > 8) {
    throw new OneKeyLocalError(
      `recording step ${String(stepIndex)} has too many selectors`,
    );
  }
  const tag = boundedString(
    target.tag,
    `recording step ${String(stepIndex)} target tag`,
    40,
  ).toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/u.test(tag)) {
    throw new OneKeyLocalError(
      `recording step ${String(stepIndex)} target tag is invalid`,
    );
  }
  return {
    tag,
    text: nullableBoundedString(
      target.text,
      `recording step ${String(stepIndex)} target text`,
      240,
    ),
    role: nullableBoundedString(
      target.role,
      `recording step ${String(stepIndex)} target role`,
      80,
    ),
    ariaLabel: nullableBoundedString(
      target.ariaLabel,
      `recording step ${String(stepIndex)} target ariaLabel`,
      240,
    ),
    selectors: target.selectors.map(normalizeRecordingSelector),
  };
}

export function normalizeCustomInjectedRecordingCapture(
  value: unknown,
): ICustomInjectedRecordingCapture {
  const serialized = JSON.stringify(value);
  if (
    !serialized ||
    Buffer.byteLength(serialized) > CUSTOM_INJECTED_RECORDING_MAX_BYTES
  ) {
    throw new OneKeyLocalError('Custom injection recording is too large');
  }
  if (!value || typeof value !== 'object') {
    throw new OneKeyLocalError('Custom injection recording must be an object');
  }
  const capture = value as Partial<ICustomInjectedRecordingCapture>;
  if (
    capture.schemaVersion !== 1 ||
    capture.kind !== 'onekey-connect-button-recording-capture'
  ) {
    throw new OneKeyLocalError('Unsupported custom injection recording');
  }
  const startedAt = isoTimestamp(capture.startedAt, 'recording startedAt');
  const finishedAt = isoTimestamp(capture.finishedAt, 'recording finishedAt');
  const durationMs = Date.parse(finishedAt) - Date.parse(startedAt);
  if (durationMs < 0 || durationMs > 30 * 60 * 1000) {
    throw new OneKeyLocalError(
      'Custom injection recording duration is invalid',
    );
  }
  if (
    !Array.isArray(capture.steps) ||
    capture.steps.length === 0 ||
    capture.steps.length > CUSTOM_INJECTED_RECORDING_MAX_STEPS
  ) {
    throw new OneKeyLocalError(
      `Custom injection recording must contain 1-${String(
        CUSTOM_INJECTED_RECORDING_MAX_STEPS,
      )} steps`,
    );
  }
  let previousElapsedMs = -1;
  const steps = capture.steps.map((stepValue, index) => {
    if (!stepValue || typeof stepValue !== 'object') {
      throw new OneKeyLocalError(
        `recording step ${String(index)} must be an object`,
      );
    }
    const step = stepValue as Partial<ICustomInjectedRecordingStep>;
    if (step.action !== 'click' && step.action !== 'press') {
      throw new OneKeyLocalError(
        `recording step ${String(index)} has an unsupported action`,
      );
    }
    const elapsedMs = boundedNumber(
      step.elapsedMs,
      `recording step ${String(index)} elapsedMs`,
      0,
      30 * 60 * 1000,
    );
    if (elapsedMs < previousElapsedMs) {
      throw new OneKeyLocalError(
        `recording step ${String(index)} is out of order`,
      );
    }
    previousElapsedMs = elapsedMs;
    const normalizedStep: ICustomInjectedRecordingStep = {
      action: step.action,
      elapsedMs,
      pageUrl: boundedString(
        step.pageUrl,
        `recording step ${String(index)} pageUrl`,
        2048,
      ),
      target: normalizeRecordingTarget(step.target, index),
    };
    if (step.action === 'press') {
      const key = boundedString(
        step.key,
        `recording step ${String(index)} key`,
        20,
      );
      if (!CUSTOM_INJECTED_RECORDING_KEYS.has(key)) {
        throw new OneKeyLocalError(
          `recording step ${String(index)} key is not allowed`,
        );
      }
      normalizedStep.key = key;
    }
    return normalizedStep;
  });
  const viewport = capture.viewport;
  if (!viewport || typeof viewport !== 'object') {
    throw new OneKeyLocalError('recording viewport is required');
  }
  let outcome: ICustomInjectedRecordingCapture['outcome'] = null;
  if (capture.outcome !== null && capture.outcome !== undefined) {
    if (
      capture.outcome.kind !== 'repository-wallet-icon' ||
      !Number.isInteger(capture.outcome.afterStep) ||
      capture.outcome.afterStep < 1 ||
      capture.outcome.afterStep > steps.length
    ) {
      throw new OneKeyLocalError('recording wallet-picker outcome is invalid');
    }
    outcome = {
      kind: 'repository-wallet-icon',
      afterStep: capture.outcome.afterStep,
    };
  }
  return {
    schemaVersion: 1,
    kind: 'onekey-connect-button-recording-capture',
    startedAt,
    finishedAt,
    initialUrl: boundedString(capture.initialUrl, 'recording initialUrl', 2048),
    finalUrl: boundedString(capture.finalUrl, 'recording finalUrl', 2048),
    title: nullableBoundedString(capture.title, 'recording title', 256) || '',
    viewport: {
      width: boundedNumber(
        viewport.width,
        'recording viewport width',
        1,
        10_000,
      ),
      height: boundedNumber(
        viewport.height,
        'recording viewport height',
        1,
        10_000,
      ),
      deviceScaleFactor: boundedNumber(
        viewport.deviceScaleFactor,
        'recording viewport deviceScaleFactor',
        0.1,
        10,
      ),
    },
    outcome,
    steps,
  };
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

async function readRegularFileIfExists(
  file: string,
  maxBytes: number,
  label: string,
): Promise<Buffer | null> {
  let fileStat;
  try {
    fileStat = await fs.lstat(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
  if (
    fileStat.isSymbolicLink() ||
    !fileStat.isFile() ||
    fileStat.size <= 0 ||
    fileStat.size > maxBytes
  ) {
    throw new OneKeyLocalError(
      `${label} must be a regular file no larger than ${String(maxBytes)} bytes`,
    );
  }
  return fs.readFile(file);
}

function parseCustomInjectedE2EString(
  source: string,
  field: 'source' | 'protocolId' | 'recordingSha256' | 'site',
): string {
  const matcher = new RegExp(
    `\\b${field}\\s*:\\s*(['"])([^'"\\r\\n]+)\\1`,
    'gu',
  );
  const matches = Array.from(source.matchAll(matcher));
  if (matches.length !== 1 || !matches[0]?.[2]) {
    throw new OneKeyLocalError(
      `Generated E2E must contain exactly one static ${field}`,
    );
  }
  return matches[0][2];
}

async function getCustomInjectedE2EWorkflowStateForProtocol(
  customSession: ICustomInjectedWorkspaceSession,
  protocol: ICustomInjectedProtocol,
): Promise<ICustomInjectedE2EWorkflowState> {
  const dappDirectory = await resolveCustomInjectedDappDirectory(
    customSession,
    protocol,
    false,
  );
  if (!dappDirectory) {
    return {
      recording: null,
      e2e: null,
      adapter: null,
      canValidate: false,
    };
  }
  const recordingFile = path.join(dappDirectory, 'recording.json');
  const recordingContent = await readRegularFileIfExists(
    recordingFile,
    CUSTOM_INJECTED_RECORDING_MAX_BYTES,
    'Custom injection recording',
  );
  let recording: ICustomInjectedE2EWorkflowState['recording'] = null;
  if (recordingContent) {
    let value: {
      schemaVersion?: unknown;
      kind?: unknown;
      protocol?: { source?: unknown; id?: unknown };
      runtime?: { privateSession?: unknown };
      finishedAt?: unknown;
      steps?: unknown;
    };
    try {
      value = JSON.parse(recordingContent.toString('utf8')) as typeof value;
    } catch {
      throw new OneKeyLocalError(
        'Custom injection recording is not valid JSON',
      );
    }
    if (
      value.schemaVersion !== 1 ||
      value.kind !== 'onekey-connect-button-recording' ||
      value.protocol?.source !== protocol.source ||
      value.protocol?.id !== protocol.id ||
      value.runtime?.privateSession !== true ||
      typeof value.finishedAt !== 'string' ||
      Number.isNaN(Date.parse(value.finishedAt)) ||
      !Array.isArray(value.steps) ||
      value.steps.length === 0 ||
      value.steps.length > CUSTOM_INJECTED_RECORDING_MAX_STEPS
    ) {
      throw new OneKeyLocalError(
        'Custom injection recording does not match the selected protocol',
      );
    }
    recording = {
      relativeFile: workspaceRelativeFile(
        customSession.workspace,
        recordingFile,
      ),
      sha256: sha256(recordingContent),
      stepCount: value.steps.length,
      finishedAt: value.finishedAt,
    };
  }

  const e2eFile = path.join(dappDirectory, 'e2e.mjs');
  const e2eContent = await readRegularFileIfExists(
    e2eFile,
    CUSTOM_INJECTED_E2E_MAX_BYTES,
    'Generated E2E',
  );
  let e2e: ICustomInjectedE2EWorkflowState['e2e'] = null;
  if (e2eContent) {
    const source = e2eContent.toString('utf8');
    if (
      !source.includes('onekey-connect-button-desktop-e2e') ||
      !source.includes('../../../src/lib/desktop-recording-e2e.mjs')
    ) {
      throw new OneKeyLocalError(
        'Generated E2E does not use the shared driver',
      );
    }
    const dappSource = parseCustomInjectedE2EString(source, 'source');
    const protocolId = parseCustomInjectedE2EString(source, 'protocolId');
    const recordingSha256 = parseCustomInjectedE2EString(
      source,
      'recordingSha256',
    );
    parseCustomInjectedE2EString(source, 'site');
    if (
      dappSource !== protocol.source ||
      protocolId !== protocol.id ||
      !/^[a-f0-9]{64}$/u.test(recordingSha256)
    ) {
      throw new OneKeyLocalError(
        'Generated E2E does not match the selected protocol',
      );
    }
    e2e = {
      relativeFile: workspaceRelativeFile(customSession.workspace, e2eFile),
      recordingSha256,
      current: recording?.sha256 === recordingSha256,
    };
  }
  const validationFile = path.join(dappDirectory, 'e2e-result.json');
  const validationContent = await readRegularFileIfExists(
    validationFile,
    CUSTOM_INJECTED_E2E_RESULT_FILE_MAX_BYTES,
    'Persisted E2E result',
  );
  let validation: ICustomInjectedE2EWorkflowState['validation'];
  if (validationContent) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const value = parseCustomInjectedE2EOutput(
      validationContent.toString('utf8'),
    ) as {
      e2eSha256?: unknown;
      recordingSha256?: unknown;
    };
    if (
      typeof value.e2eSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(value.e2eSha256) ||
      typeof value.recordingSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(value.recordingSha256)
    ) {
      throw new OneKeyLocalError(
        'Persisted E2E result has invalid artifact SHA-256 values',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const result = normalizeCustomInjectedE2EResult(
      value,
      protocol.source,
      protocol,
      value.recordingSha256,
    );
    validation = {
      relativeFile: workspaceRelativeFile(
        customSession.workspace,
        validationFile,
      ),
      recordingSha256: result.recordingSha256,
      passed: result.passed,
      current: Boolean(
        recording &&
        e2e?.current &&
        e2eContent &&
        value.e2eSha256 === sha256(e2eContent) &&
        result.recordingSha256 === recording.sha256,
      ),
    };
  }
  const adapterFile = path.join(dappDirectory, 'adapter.ts');
  const adapterContent = await readRegularFileIfExists(
    adapterFile,
    CUSTOM_INJECTED_ADAPTER_MAX_BYTES,
    'Custom injection adapter',
  );
  return {
    recording,
    e2e,
    adapter: adapterContent
      ? {
          relativeFile: workspaceRelativeFile(
            customSession.workspace,
            adapterFile,
          ),
        }
      : null,
    ...(validation ? { validation } : {}),
    canValidate: Boolean(recording && e2e?.current),
  };
}

function emptyCustomInjectedE2EWorkflowSummary(): ICustomInjectedE2EWorkflowSummary {
  return {
    adapter: false,
    recorded: false,
    generated: false,
    resultPresent: false,
    validated: false,
  };
}

async function getCustomInjectedE2EWorkflowSummaries(
  customSession: ICustomInjectedWorkspaceSession,
): Promise<Record<string, ICustomInjectedE2EWorkflowSummary>> {
  const summaries = Object.fromEntries(
    customSession.protocols.map((protocol) => [
      protocol.key,
      emptyCustomInjectedE2EWorkflowSummary(),
    ]),
  );

  await Promise.all(
    customSession.protocolSources.map(async ({ source }) => {
      const sourceDirectory = await resolveCustomInjectedChildDirectory(
        customSession.dappsDirectory,
        source,
        false,
        'Custom injection DApp source path',
      );
      if (!sourceDirectory) return;
      const entries = await fs.readdir(sourceDirectory, {
        withFileTypes: true,
      });
      const existingDappDirectories = new Set(
        entries
          .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
          .map((entry) => entry.name),
      );
      const candidates = customSession.protocols.filter(
        (protocol) =>
          protocol.source === source &&
          existingDappDirectories.has(
            safeRecordingSlug(protocol.slug || protocol.id),
          ),
      );
      await Promise.all(
        candidates.map(async (protocol) => {
          try {
            const state = await getCustomInjectedE2EWorkflowStateForProtocol(
              customSession,
              protocol,
            );
            summaries[protocol.key] = {
              adapter: Boolean(state.adapter),
              recorded: Boolean(state.recording),
              generated: Boolean(state.e2e?.current),
              resultPresent: Boolean(state.validation),
              validated: Boolean(
                state.validation?.current && state.validation.passed,
              ),
            };
          } catch (error) {
            summaries[protocol.key] = emptyCustomInjectedE2EWorkflowSummary();
            await writeCustomInjectedOperationLog(customSession.workspace, {
              operationId: crypto.randomUUID(),
              operation: 'e2e.state.read',
              status: 'error',
              sessionId: customSession.sessionId,
              protocol: customInjectedOperationProtocol(protocol),
              input: { mode: 'summary' },
              error,
            });
          }
        }),
      );
    }),
  );

  return summaries;
}

function normalizeCustomInjectedE2EResult(
  value: unknown,
  protocolSource: string,
  protocol: ICustomInjectedProtocol,
  recordingSha256: string,
): ICustomInjectedE2EResult {
  if (!value || typeof value !== 'object') {
    throw new OneKeyLocalError('Generated E2E returned an invalid result');
  }
  const result = value as Partial<ICustomInjectedE2EResult>;
  if (
    result.schemaVersion !== 1 ||
    result.kind !== 'onekey-connect-button-desktop-e2e-result' ||
    typeof result.passed !== 'boolean' ||
    result.verdict !== 'deterministic-repository-icon-source' ||
    result.source !== protocolSource ||
    result.protocolId !== protocol.id ||
    result.recordingSha256 !== recordingSha256 ||
    typeof result.site !== 'string' ||
    !Array.isArray(result.passes) ||
    result.passes.length < 1 ||
    result.passes.length > CUSTOM_INJECTED_E2E_MAX_ATTEMPTS
  ) {
    throw new OneKeyLocalError(
      'Generated E2E result does not match the latest recording',
    );
  }
  const passes = result.passes.map((pass, index) => {
    const repositoryWalletDetected =
      pass?.repositoryIconDetected === true ||
      pass?.oneKeyWalletIdDetected === true;
    if (
      !pass ||
      pass.name !== `clean-session-${String(index + 1)}` ||
      typeof pass.freshWebView !== 'boolean' ||
      typeof pass.passed !== 'boolean' ||
      typeof pass.repositoryIconDetected !== 'boolean' ||
      (pass.oneKeyWalletIdDetected !== undefined &&
        typeof pass.oneKeyWalletIdDetected !== 'boolean') ||
      (pass.oneKeyWalletIdDetected === true &&
        (typeof pass.walletId !== 'string' ||
          !/^[a-z0-9]+-onekey-[a-z0-9-]+$/.test(pass.walletId))) ||
      (pass.passed && (!pass.freshWebView || !repositoryWalletDetected))
    ) {
      throw new OneKeyLocalError('Generated E2E returned an invalid pass');
    }
    return {
      name: pass.name,
      freshWebView: pass.freshWebView,
      passed: pass.passed,
      repositoryIconDetected: pass.repositoryIconDetected,
      oneKeyWalletIdDetected: pass.oneKeyWalletIdDetected === true,
      walletId:
        typeof pass.walletId === 'string' &&
        /^[a-z0-9]+-onekey-[a-z0-9-]+$/.test(pass.walletId)
          ? pass.walletId
          : null,
      iconKey: typeof pass.iconKey === 'string' ? pass.iconKey : null,
      iconLabel: typeof pass.iconLabel === 'string' ? pass.iconLabel : null,
    };
  });
  const passed = passes.some((pass) => pass.passed);
  return {
    schemaVersion: 1,
    kind: 'onekey-connect-button-desktop-e2e-result',
    passed,
    verdict: 'deterministic-repository-icon-source',
    source: protocolSource,
    protocolId: protocol.id,
    site: result.site,
    recordingSha256,
    passes,
  };
}

function parseCustomInjectedE2EOutput(output: string): unknown {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new OneKeyLocalError('Generated E2E returned no JSON output');
  }
  const lines = trimmed.split(/\r?\n/u);
  const candidates = [trimmed];
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith('{')) {
      candidates.push(lines.slice(index).join('\n'));
    }
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next root-level JSON candidate after process warnings.
    }
  }
  throw new OneKeyLocalError('Generated E2E returned invalid JSON');
}

function customInjectedE2EErrorFromOutput(output: string): string | undefined {
  try {
    const value = parseCustomInjectedE2EOutput(output) as {
      ok?: unknown;
      error?: unknown;
    };
    if (value.ok === false && typeof value.error === 'string') {
      return value.error.trim().slice(0, 2000) || undefined;
    }
  } catch {
    // The full unparsed output remains available in the process log.
  }
  return undefined;
}

function normalizeCustomInjectedE2EGenerationResult(
  value: unknown,
  protocol: ICustomInjectedProtocol,
  recordingSha256: string,
  expectedRelativeFile: string,
): Extract<ICustomInjectedE2EGenerationResult, { ok: true }> {
  if (!value || typeof value !== 'object') {
    throw new OneKeyLocalError('E2E generator returned an invalid result');
  }
  const result = value as {
    schemaVersion?: unknown;
    kind?: unknown;
    ok?: unknown;
    source?: unknown;
    protocolId?: unknown;
    recordingSha256?: unknown;
    actionCount?: unknown;
    validated?: unknown;
    validationPasses?: unknown;
    relativeFile?: unknown;
  };
  if (
    result.schemaVersion !== 1 ||
    result.kind !== 'onekey-connect-button-e2e-generation-result' ||
    result.ok !== true ||
    result.source !== protocol.source ||
    result.protocolId !== protocol.id ||
    result.recordingSha256 !== recordingSha256 ||
    result.relativeFile !== expectedRelativeFile ||
    result.validated !== true ||
    typeof result.validationPasses !== 'number' ||
    !Number.isSafeInteger(result.validationPasses) ||
    result.validationPasses < 1 ||
    result.validationPasses > CUSTOM_INJECTED_E2E_MAX_ATTEMPTS ||
    typeof result.actionCount !== 'number' ||
    !Number.isSafeInteger(result.actionCount) ||
    result.actionCount < 2 ||
    result.actionCount > CUSTOM_INJECTED_RECORDING_MAX_STEPS + 1
  ) {
    throw new OneKeyLocalError(
      'E2E generator result does not match the saved recording',
    );
  }
  return {
    ok: true,
    relativeFile: expectedRelativeFile,
    recordingSha256,
    actionCount: result.actionCount,
    validated: true,
    validationPasses: result.validationPasses,
  };
}

async function executeCustomInjectedE2EGenerator(
  customSession: ICustomInjectedWorkspaceSession,
  protocol: ICustomInjectedProtocol,
  recordingFile: string,
  recordingSha256: string,
  signal: AbortSignal,
  onProcessLog?: (processLog: {
    exitCode: number | string;
    signal?: string;
    stdout: string;
    stderr: string;
    processError?: string;
  }) => void,
): Promise<ICustomInjectedE2EGenerationResult> {
  if (!customSession.recordingE2EGeneratorFile) {
    return { ok: false, error: 'Recording E2E generator is not configured' };
  }
  const expectedRelativeFile = workspaceRelativeFile(
    customSession.workspace,
    path.join(path.dirname(recordingFile), 'e2e.mjs'),
  );
  try {
    await readLimitedFile(
      customSession.recordingE2EGeneratorFile,
      CUSTOM_INJECTED_E2E_GENERATOR_MAX_BYTES,
      'Custom injection recording E2E generator',
    );
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        customSession.recordingE2EGeneratorFile,
        '--file',
        workspaceRelativeFile(customSession.workspace, recordingFile),
      ],
      {
        cwd: customSession.workspace,
        encoding: 'utf8',
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        maxBuffer: CUSTOM_INJECTED_E2E_RESULT_MAX_BYTES,
        signal,
        timeout: CUSTOM_INJECTED_E2E_PROCESS_TIMEOUT_MS,
        windowsHide: true,
      },
    );
    onProcessLog?.({ exitCode: 0, stdout, stderr });
    return normalizeCustomInjectedE2EGenerationResult(
      parseCustomInjectedE2EOutput(stdout),
      protocol,
      recordingSha256,
      expectedRelativeFile,
    );
  } catch (error) {
    const failure = error as Error & {
      code?: number | string;
      signal?: string;
      stderr?: string;
      stdout?: string;
    };
    onProcessLog?.({
      exitCode: failure.code ?? 'unknown',
      ...(failure.signal ? { signal: failure.signal } : undefined),
      stdout: failure.stdout || '',
      stderr: failure.stderr || '',
      processError: failure.message,
    });
    if (signal.aborted) {
      return {
        ok: false,
        cancelled: true,
        error: 'E2E generation stopped by user',
      };
    }
    const detail =
      customInjectedE2EErrorFromOutput(failure.stderr || '') ||
      customInjectedE2EErrorFromOutput(failure.stdout || '') ||
      failure.message.split(/\r?\n/u).find(Boolean) ||
      'Unknown E2E generation failure';
    return { ok: false, error: detail.slice(0, 2000) };
  }
}

function formatCustomInjectedE2EProcessLog({
  e2eFile,
  exitCode,
  processError,
  signal,
  stderr,
  stdout,
}: {
  e2eFile: string;
  exitCode: number | string;
  processError?: string;
  signal?: string;
  stderr: string;
  stdout: string;
}): string {
  const sections = [
    'OneKey Desktop E2E validation',
    `Script: ${e2eFile}`,
    `Exit code: ${String(exitCode)}`,
    ...(signal ? [`Signal: ${signal}`] : []),
    ...(stdout.trim() ? [`\n--- stdout ---\n${stdout.trim()}`] : []),
    ...(stderr.trim() ? [`\n--- stderr ---\n${stderr.trim()}`] : []),
    ...(processError?.trim()
      ? [`\n--- process error ---\n${processError.trim()}`]
      : []),
  ];
  const log = `${sections.join('\n')}\n`;
  const buffer = Buffer.from(log, 'utf8');
  if (buffer.byteLength <= CUSTOM_INJECTED_E2E_LOG_MAX_BYTES) {
    return log;
  }
  const retained = buffer
    .subarray(buffer.byteLength - CUSTOM_INJECTED_E2E_LOG_MAX_BYTES)
    .toString('utf8');
  return `[Earlier log output truncated at ${String(
    CUSTOM_INJECTED_E2E_LOG_MAX_BYTES,
  )} bytes]\n${retained}`;
}

async function writeJsonAtomic(
  file: string,
  value: unknown,
  {
    label = 'Custom injection recording',
    maxBytes = CUSTOM_INJECTED_RECORDING_MAX_BYTES,
  }: { label?: string; maxBytes?: number } = {},
): Promise<string> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(content) > maxBytes) {
    throw new OneKeyLocalError(`${label} is too large`);
  }
  const temporaryFile = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryFile, content, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporaryFile, file);
  } catch (error) {
    await fs.unlink(temporaryFile).catch(() => undefined);
    throw error;
  }
  return content;
}

function parseCustomInjectedWorkspaceCliOutput(
  stdout: string,
): ICustomInjectedWorkspaceCliSnapshot {
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
  return value.result as ICustomInjectedWorkspaceCliSnapshot;
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
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      process.execPath,
      [workspaceCliFile, '--action', 'inspect', '--workspace', workspace],
      {
        cwd: workspace,
        encoding: 'utf8',
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        maxBuffer: CUSTOM_INJECTED_WORKSPACE_CLI_OUTPUT_MAX_BYTES,
        timeout: 60_000,
        windowsHide: true,
      },
    ));
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const message =
      typeof stderr === 'string' && stderr.trim()
        ? customInjectedE2EErrorFromOutput(stderr)
        : undefined;
    throw new OneKeyLocalError(
      message ||
        (error instanceof Error
          ? error.message
          : 'Custom injection workspace CLI failed'),
    );
  }
  const snapshot = parseCustomInjectedWorkspaceCliOutput(stdout);
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
        return getCustomInjectedE2EWorkflowStateForProtocol(
          customSession,
          protocol,
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
        return getCustomInjectedE2EWorkflowSummaries(customSession);
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
        let protocol = findCustomInjectedProtocol(customSession, protocolId);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        const state = await getCustomInjectedE2EWorkflowStateForProtocol(
          customSession,
          protocol,
        );
        if (!state.recording || !state.e2e?.current || !state.canValidate) {
          throw new OneKeyLocalError(
            'Generate an E2E script from the latest recording before validating',
          );
        }
        const recording = state.recording;
        await this.prepareCustomInjectedE2EValidation(sessionId, protocol.key);
        protocol = findCustomInjectedProtocol(customSession, protocol.key);
        if (!protocol) {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
        const dappDirectory = await resolveCustomInjectedDappDirectory(
          customSession,
          protocol,
          false,
        );
        if (!dappDirectory) {
          throw new OneKeyLocalError('Generated E2E directory is unavailable');
        }
        const e2eFile = path.join(dappDirectory, 'e2e.mjs');
        const resultFile = path.join(dappDirectory, 'e2e-result.json');
        const e2eSha256 = sha256(await fs.readFile(e2eFile));
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
        const normalizeAndPersistOutput = async (output: string) => {
          const value = parseCustomInjectedE2EOutput(output);
          const result = normalizeCustomInjectedE2EResult(
            value,
            protocol.source,
            protocol,
            recording.sha256,
          );
          await writeJsonAtomic(
            resultFile,
            { ...result, e2eSha256 },
            {
              label: 'Persisted E2E result',
              maxBytes: CUSTOM_INJECTED_E2E_RESULT_FILE_MAX_BYTES,
            },
          );
          return result;
        };
        try {
          await fs.unlink(resultFile).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          });
          const relativeE2EFile = workspaceRelativeFile(
            customSession.workspace,
            e2eFile,
          );
          try {
            const { stderr, stdout } = await execFileAsync(
              process.execPath,
              [e2eFile],
              {
                cwd: customSession.workspace,
                encoding: 'utf8',
                env: {
                  ...process.env,
                  ELECTRON_RUN_AS_NODE: '1',
                  ONEKEY_DESKTOP_CDP_ENDPOINT: 'http://127.0.0.1:9222',
                },
                maxBuffer: CUSTOM_INJECTED_E2E_RESULT_MAX_BYTES,
                signal: abortController.signal,
                timeout: CUSTOM_INJECTED_E2E_PROCESS_TIMEOUT_MS,
              },
            );
            const log = formatCustomInjectedE2EProcessLog({
              e2eFile: relativeE2EFile,
              exitCode: 0,
              stderr,
              stdout,
            });
            if (abortController.signal.aborted) {
              return {
                ok: false,
                cancelled: true,
                error: 'E2E validation stopped by user',
                log,
              };
            }
            try {
              return {
                ok: true,
                result: await normalizeAndPersistOutput(stdout),
                log,
              };
            } catch (error) {
              return {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
                log,
              };
            }
          } catch (error) {
            const processFailure = error as Error & {
              code?: number | string;
              signal?: string;
              stderr?: string;
              stdout?: string;
            };
            const stderr = processFailure.stderr || '';
            const stdout = processFailure.stdout || '';
            const log = formatCustomInjectedE2EProcessLog({
              e2eFile: relativeE2EFile,
              exitCode: processFailure.code ?? 'unknown',
              processError: processFailure.message,
              signal: processFailure.signal,
              stderr,
              stdout,
            });
            if (abortController.signal.aborted) {
              return {
                ok: false,
                cancelled: true,
                error: 'E2E validation stopped by user',
                log,
              };
            }
            for (const output of [stderr, stdout]) {
              if (output.trim()) {
                try {
                  return {
                    ok: true,
                    result: await normalizeAndPersistOutput(output),
                    log,
                  };
                } catch {
                  // A runner exception may emit an error envelope instead of a result.
                }
              }
            }
            const detail =
              customInjectedE2EErrorFromOutput(stderr) ||
              customInjectedE2EErrorFromOutput(stdout) ||
              processFailure.message.split(/\r?\n/u).find(Boolean) ||
              'Unknown E2E failure';
            return { ok: false, error: detail, log };
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

        const capture = normalizeCustomInjectedRecordingCapture(
          request.recording,
        );
        const currentUrl = guest.getURL();
        const expectedHostname = getCustomInjectedHostname(protocol.url);
        const recordingUrls = [
          request.pageUrl,
          currentUrl,
          capture.initialUrl,
          capture.finalUrl,
          ...capture.steps.map((step) => step.pageUrl),
        ];
        if (
          !expectedHostname ||
          recordingUrls.some(
            (url) => getCustomInjectedHostname(url) !== expectedHostname,
          )
        ) {
          throw new OneKeyLocalError(
            'Custom injection recording URL does not match the selected protocol',
          );
        }

        const persistedRecording = {
          schemaVersion: 1,
          kind: 'onekey-connect-button-recording',
          protocol: {
            source: protocol.source,
            id: protocol.id,
            name: protocol.name,
            slug: protocol.slug,
            url: protocol.url,
          },
          runtime: {
            bundleSha256: customSession.bundleSha256,
            privateSession: true,
          },
          startedAt: capture.startedAt,
          finishedAt: capture.finishedAt,
          initialUrl: capture.initialUrl,
          finalUrl: capture.finalUrl,
          title: capture.title,
          viewport: capture.viewport,
          outcome: capture.outcome,
          steps: capture.steps,
        } as const;
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
        const file = path.join(dappDirectory, 'recording.json');
        const content = await writeJsonAtomic(file, persistedRecording);
        const recordingSha256 = sha256(content);
        const recordingFiles = await fs.readdir(dappDirectory, {
          withFileTypes: true,
        });
        await Promise.all(
          recordingFiles.map(async (entry) => {
            if (
              entry.isFile() &&
              entry.name.startsWith('recording-') &&
              entry.name.endsWith('.json')
            ) {
              await fs.unlink(path.join(dappDirectory, entry.name));
            }
          }),
        );
        return {
          relativeFile: workspaceRelativeFile(customSession.workspace, file),
          sha256: recordingSha256,
          stepCount: capture.steps.length,
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
    let generatorProcessLog:
      | {
          exitCode: number | string;
          signal?: string;
          stdout: string;
          stderr: string;
          processError?: string;
        }
      | undefined;
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
          const state = await getCustomInjectedE2EWorkflowStateForProtocol(
            customSession,
            protocol,
          );
          if (!state.recording) {
            throw new OneKeyLocalError(
              'Save a recording before generating its E2E',
            );
          }
          const dappDirectory = await resolveCustomInjectedDappDirectory(
            customSession,
            protocol,
            false,
          );
          if (!dappDirectory) {
            throw new OneKeyLocalError(
              'Custom injection DApp directory is unavailable',
            );
          }
          await this.prepareCustomInjectedE2EValidation(
            sessionId,
            protocol.key,
          );
          if (abortController.signal.aborted) {
            return {
              ok: false,
              cancelled: true,
              error: 'E2E generation stopped by user',
            } as const;
          }
          const validationProtocol = findCustomInjectedProtocol(
            customSession,
            protocol.key,
          );
          if (!validationProtocol) {
            throw new OneKeyLocalError('Custom injection protocol not found');
          }
          return await executeCustomInjectedE2EGenerator(
            customSession,
            validationProtocol,
            path.join(dappDirectory, 'recording.json'),
            state.recording.sha256,
            abortController.signal,
            (processLog) => {
              generatorProcessLog = processLog;
            },
          );
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
    let updaterProcessLog:
      | {
          exitCode: number | string;
          signal?: string;
          stdout: string;
          stderr: string;
          processError?: string;
        }
      | undefined;
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
        const protocolSource = customSession.protocolSources.find(
          (candidate) => candidate.source === protocol.source,
        );
        if (!protocolSource) {
          throw new OneKeyLocalError(
            'Custom injection protocol source not found',
          );
        }
        if (update.expectedRegistrySha256 !== protocolSource.registrySha256) {
          throw new OneKeyLocalError('Custom injection registry has changed');
        }
        const args = [
          protocolSource.updaterFile,
          '--file',
          protocolSource.registryFile,
          '--protocol-id',
          protocol.id,
          '--expected-sha256',
          update.expectedRegistrySha256,
          '--action',
          update.action,
        ];
        if (update.action === 'set-url') {
          if (update.url) {
            if (!isAllowedWebViewUrl(update.url)) {
              throw new OneKeyLocalError(
                'Custom injection protocol URL must be a safe HTTPS URL',
              );
            }
            args.push('--url', update.url);
          } else {
            args.push('--clear-url');
          }
        } else {
          args.push('--state', update.state);
          if (update.state === 'processed') {
            if (!update.reviewedUrl || !update.bundleSha256) {
              throw new OneKeyLocalError(
                'Processed review requires reviewed URL and bundle SHA-256',
              );
            }
            args.push(
              '--reviewed-url',
              update.reviewedUrl,
              '--bundle-sha256',
              update.bundleSha256,
            );
          }
        }
        try {
          const { stderr, stdout } = await execFileAsync(
            process.execPath,
            args,
            {
              cwd: customSession.workspace,
              encoding: 'utf8',
              env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1',
              },
              maxBuffer: CUSTOM_INJECTED_UPDATER_MAX_BYTES,
              timeout: 30_000,
            },
          );
          updaterProcessLog = { exitCode: 0, stdout, stderr };
        } catch (error) {
          const failure = error as Error & {
            code?: number | string;
            signal?: string;
            stderr?: string;
            stdout?: string;
          };
          updaterProcessLog = {
            exitCode: failure.code ?? 'unknown',
            ...(failure.signal ? { signal: failure.signal } : undefined),
            stdout: failure.stdout || '',
            stderr: failure.stderr || '',
            processError: failure.message,
          };
          const detail = failure.stderr || failure.message;
          const wrappedError = new OneKeyLocalError(
            `Failed to update custom injection registry: ${detail}`,
          );
          Object.assign(wrappedError, { process: updaterProcessLog });
          throw wrappedError;
        }
        protocolSource.registryStamp = '';
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
    const refresherProcessLogs: Array<{
      source: string;
      exitCode: number | string;
      signal?: string;
      stdout: string;
      stderr: string;
      processError?: string;
    }> = [];
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
        const protocolSourcesToRefresh = customSession.protocolSources.filter(
          (protocolSource) => protocolSource.refresherFile,
        );
        await Promise.all(
          protocolSourcesToRefresh.map(async (protocolSource) => {
            try {
              const { stderr, stdout } = await execFileAsync(
                process.execPath,
                [
                  protocolSource.refresherFile as string,
                  '--file',
                  protocolSource.registryFile,
                ],
                {
                  cwd: customSession.workspace,
                  encoding: 'utf8',
                  env: {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: '1',
                  },
                  maxBuffer: CUSTOM_INJECTED_REFRESHER_MAX_BYTES,
                  timeout: 120_000,
                },
              );
              refresherProcessLogs.push({
                source: protocolSource.source,
                exitCode: 0,
                stdout,
                stderr,
              });
              protocolSource.registryStamp = '';
            } catch (error) {
              const failure = error as Error & {
                code?: number | string;
                signal?: string;
                stderr?: string;
                stdout?: string;
              };
              const processLog = {
                source: protocolSource.source,
                exitCode: failure.code ?? 'unknown',
                ...(failure.signal ? { signal: failure.signal } : undefined),
                stdout: failure.stdout || '',
                stderr: failure.stderr || '',
                processError: failure.message,
              };
              refresherProcessLogs.push(processLog);
              const detail = failure.stderr || failure.message;
              const wrappedError = new OneKeyLocalError(
                `Failed to refresh ${protocolSource.source} registry: ${detail}`,
              );
              Object.assign(wrappedError, { process: processLog });
              throw wrappedError;
            }
          }),
        );
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
        customInjectedSessions.delete(sessionId);
      },
      completion: () => ({ result: { closed: true } }),
    });
  }
}

export default DesktopApiNetwork;
