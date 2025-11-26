export function startProfilerHeartbeat(_intervalMs = 2000) {
  return null;
}

export function stopProfilerHeartbeat() {
  return null;
}

export async function logFunctionHit(_meta: {
  name: string;
  file: string;
  line?: number;
}) {
  return null;
}

export default {
  startProfilerHeartbeat,
  stopProfilerHeartbeat,
  logFunctionHit,
  recordFunctionPerfStart: (_meta: {
    name: string;
    file: string;
    line?: number;
  }) => null,
  recordFunctionPerfEnd: (_token: unknown) => null,
};

export function installFunctionHitLogger() {
  // noop on non-native
  // @ts-ignore
  globalThis.__logFunctionHit = logFunctionHit;
  // @ts-ignore
  globalThis.__recordFunctionStart = () => null;
  // @ts-ignore
  globalThis.__recordFunctionEnd = () => null;
  return logFunctionHit;
}
