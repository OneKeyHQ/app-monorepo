import RNFS from '../modules3rdParty/react-native-fs';
import {
  HEARTBEAT_LOG_RELATIVE_PATH,
  FUNCTION_LOG_RELATIVE_PATH,
  FUNCTION_STACK_FRAMES_DEFAULT,
} from './heartbeatLogger.const';

const heartbeatLogFilePath = `${RNFS.DocumentDirectoryPath}/${HEARTBEAT_LOG_RELATIVE_PATH}`;
const functionLogFilePath = `${RNFS.DocumentDirectoryPath}/${FUNCTION_LOG_RELATIVE_PATH}`;
const logDirPath = heartbeatLogFilePath.slice(
  0,
  heartbeatLogFilePath.lastIndexOf('/'),
);

let timer: ReturnType<typeof setInterval> | null = null;

const perfThresholdMs = Number.parseInt(
  process.env.RN_PROFILER_THRESHOLD_MS || '100',
  10,
);
const perfWarnMs = Number.parseInt(
  process.env.RN_PROFILER_WARN_MS || '300',
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

function captureStack() {
  const err = new Error('fn-perf');
  if (!err.stack) return undefined;
  const lines = err.stack
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter(
      (line) =>
        line &&
        !line.includes('heartbeatLogger') &&
        !line.includes('node_modules'),
    )
    .slice(0, stackFrameLimit);
  return lines.length ? lines : undefined;
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
  return {
    meta,
    start: typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now(),
  };
}

export async function recordFunctionPerfEnd(token?: {
  meta: {
    name: string;
    file: string;
    line?: number;
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
  if (duration < perfThresholdMs) {
    return;
  }
  const stack = captureStack();
  const payload = JSON.stringify({
    ts: Date.now(),
    iso: new Date().toISOString(),
    duration,
    ...token.meta,
    stack,
  });
  try {
    await ensureLogFile(functionLogFilePath);
    await RNFS.appendFile(functionLogFilePath, `${payload}\n`, 'utf8');
    if (duration >= perfWarnMs) {
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
  return logFunctionHit;
}
