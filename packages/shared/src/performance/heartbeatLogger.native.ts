import RNFS from '../modules3rdParty/react-native-fs';
import {
  HEARTBEAT_LOG_RELATIVE_PATH,
  FUNCTION_LOG_RELATIVE_PATH,
  FUNCTION_STACK_FRAMES_DEFAULT,
  FUNCTION_THRESHOLD_DEFAULT_MS,
  FUNCTION_WARN_DEFAULT_MS,
  FUNCTION_THRESHOLD_REQUEST_MS,
  FUNCTION_WARN_REQUEST_MS,
  FUNCTION_SAMPLE_REQUEST_DEFAULT,
} from './heartbeatLogger.const';

const heartbeatLogFilePath = `${RNFS.DocumentDirectoryPath}/${HEARTBEAT_LOG_RELATIVE_PATH}`;
const functionLogFilePath = `${RNFS.DocumentDirectoryPath}/${FUNCTION_LOG_RELATIVE_PATH}`;
const logDirPath = heartbeatLogFilePath.slice(
  0,
  heartbeatLogFilePath.lastIndexOf('/'),
);

let timer: ReturnType<typeof setInterval> | null = null;
let globalTraceId =
  process.env.RN_PROFILER_TRACE_ID ||
  `trace-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const perfThresholdMs = Number.parseInt(
  process.env.RN_PROFILER_THRESHOLD_MS ||
    `${FUNCTION_THRESHOLD_DEFAULT_MS}`,
  10,
);
const perfWarnMs = Number.parseInt(
  process.env.RN_PROFILER_WARN_MS || `${FUNCTION_WARN_DEFAULT_MS}`,
  10,
);
const stackFrameLimit = Number.parseInt(
  process.env.RN_PROFILER_STACK_FRAMES ||
    `${FUNCTION_STACK_FRAMES_DEFAULT}`,
  10,
);

async function ensureLogFile(filePath: string) {
  const exists = await RNFS.exists(logDirPath);
  if (!exists) {
    await RNFS.mkdir(logDirPath);
  }
  const fileExists = await RNFS.exists(filePath);
  if (!fileExists) {
    await RNFS.writeFile(filePath, '', 'utf8');
  }
}

async function appendHeartbeat() {
  const payload = JSON.stringify({
    ts: Date.now(),
    iso: new Date().toISOString(),
  });
  try {
    await ensureLogFile(heartbeatLogFilePath);
    await RNFS.appendFile(heartbeatLogFilePath, `${payload}\n`, 'utf8');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('heartbeatLogger: failed to append', err);
  }
}

export function startProfilerHeartbeat(intervalMs = 2000) {
  if (timer) {
    return timer;
  }
  // eslint-disable-next-line no-console
  console.warn(
    `[RN-HEARTBEAT] enabled interval=${intervalMs}ms -> ${heartbeatLogFilePath}`,
  );
  void ensureLogFile(heartbeatLogFilePath).then(appendHeartbeat);
  timer = setInterval(() => {
    void appendHeartbeat();
  }, intervalMs);
  return timer;
}

export function stopProfilerHeartbeat() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export { HEARTBEAT_LOG_RELATIVE_PATH };

function pickModule(file: string) {
  if (!file) return 'unknown';
  if (file.includes('packages/kit/src/views/')) return 'kit/views';
  if (file.includes('packages/shared/src/engine/')) return 'shared/engine';
  if (file.includes('packages/shared/src/request/')) return 'shared/request';
  const parts = file.split('/');
  const idx = parts.indexOf('packages');
  if (idx >= 0 && parts[idx + 1]) {
    return parts.slice(idx + 1, idx + 3).join('/');
  }
  return 'other';
}

function pickPage(file: string) {
  if (!file) return undefined;
  const parts = file.split('/');
  const pagesIdx = parts.indexOf('pages');
  if (pagesIdx >= 0 && parts[pagesIdx + 1]) {
    return parts[pagesIdx + 1].replace(/\.(tsx|ts|js|jsx)$/, '');
  }
  const viewsIdx = parts.indexOf('views');
  if (viewsIdx >= 0 && parts[viewsIdx + 1]) {
    return parts[viewsIdx + 1];
  }
  return undefined;
}

function getModuleConfig(module: string) {
  if (module === 'shared/request') {
    const threshold = Number.parseInt(
      process.env.RN_PROFILER_THRESHOLD_REQUEST_MS ||
        `${FUNCTION_THRESHOLD_REQUEST_MS}`,
      10,
    );
    const warn = Number.parseInt(
      process.env.RN_PROFILER_WARN_REQUEST_MS ||
        `${FUNCTION_WARN_REQUEST_MS}`,
      10,
    );
    const sample = Number.parseInt(
      process.env.RN_PROFILER_SAMPLE_REQUEST ||
        `${FUNCTION_SAMPLE_REQUEST_DEFAULT}`,
      10,
    );
    return { threshold, warn, sample };
  }
  return { threshold: perfThresholdMs, warn: perfWarnMs, sample: 1 };
}

function captureStack(meta: { file: string; line?: number }) {
  // For now, just return file:line to keep logs lean and consistent.
  if (meta?.file) {
    return [`${meta.file}:${meta.line || 0}`];
  }
  return undefined;
}

export async function logFunctionHit(meta: {
  name: string;
  file: string;
  line?: number;
}) {
  await ensureLogFile(heartbeatLogFilePath);
  const payload = JSON.stringify({
    ts: Date.now(),
    iso: new Date().toISOString(),
    ...meta,
  });
  try {
    await RNFS.appendFile(heartbeatLogFilePath, `${payload}\n`, 'utf8');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('heartbeatLogger: failed to append hit', err);
  }
}

export function recordFunctionPerfStart(meta: {
  name: string;
  file: string;
  line?: number;
}) {
  const module = pickModule(meta.file);
  const page = pickPage(meta.file);
  return {
    meta: {
      ...meta,
      module,
      page,
      traceId: globalThis.__profilerTraceId,
    },
    start: typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now(),
    config: getModuleConfig(module),
  };
}

export async function recordFunctionPerfEnd(token?: {
  meta: {
    name: string;
    file: string;
    line?: number;
    module?: string;
    page?: string;
    traceId?: string;
  };
  config?: {
    threshold: number;
    warn: number;
    sample: number;
  };
  start: number;
}) {
  if (!token) {
    return;
  }
  const duration =
    (typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now()) - token.start;
  const config = token.config || getModuleConfig(token.meta.module || 'other');
  if (config.sample > 1) {
    const r = Math.floor(Math.random() * config.sample);
    if (r !== 0) {
      return;
    }
  }
  if (duration < config.threshold) {
    return;
  }
  const stack = captureStack(token.meta);
  const payload = JSON.stringify({
    ts: Date.now(),
    iso: new Date().toISOString(),
    duration,
    ...token.meta,
    module: token.meta.module || pickModule(token.meta.file),
    stack,
  });
  try {
    await ensureLogFile(functionLogFilePath);
    await RNFS.appendFile(functionLogFilePath, `${payload}\n`, 'utf8');
    if (duration >= config.warn) {
      // eslint-disable-next-line no-console
      console.warn(
        `[RN-FUNC-PERF] ${duration.toFixed(
          2,
        )}ms ${token.meta.name} ${token.meta.file}:${token.meta.line || 0}`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('heartbeatLogger: failed to append perf', err);
  }
}

export default {
  startProfilerHeartbeat,
  stopProfilerHeartbeat,
  logFunctionHit,
  recordFunctionPerfStart,
  recordFunctionPerfEnd,
  HEARTBEAT_LOG_RELATIVE_PATH,
};

export function installFunctionHitLogger() {
  // eslint-disable-next-line no-console
  console.warn('[RN-HEARTBEAT] install global __logFunctionHit');
  // @ts-ignore
  globalThis.__logFunctionHit = logFunctionHit;
  // @ts-ignore
  globalThis.__recordFunctionStart = recordFunctionPerfStart;
  // @ts-ignore
  globalThis.__recordFunctionEnd = recordFunctionPerfEnd;
  // @ts-ignore
  globalThis.__profilerTraceId = globalTraceId;
  // @ts-ignore
  globalThis.__setProfilerTraceId = (id: string) => {
    if (id) {
      globalTraceId = id;
      // @ts-ignore
      globalThis.__profilerTraceId = globalTraceId;
    }
    return globalTraceId;
  };
  return logFunctionHit;
}
