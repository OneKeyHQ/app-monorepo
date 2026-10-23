export const MAX_NATIVE_CRASH_REPORTS = 5;
export const NATIVE_CRASH_REPORT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_NATIVE_CRASH_REPORT_BYTES = 16 * 1024;
export const MAX_NATIVE_CRASH_FRAMES = 32;
export const MAX_NATIVE_DUMP_BYTES = 32 * 1024 * 1024;

export type INativeCrashReport = {
  source: 'electron-native';
  schemaVersion: 1;
  collectedAt: number;
  platform: 'windows' | 'macos' | 'linux';
  architecture: 'x64' | 'arm64';
  exceptionCode: number;
  stackMethod: 'frame-pointer';
  modules: {
    id: string;
    size: number;
    version: number[];
  }[];
  frames: {
    moduleIndex: number;
    offset: number;
    trust: 'context' | 'frame-pointer';
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUint32(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0xff_ff_ff_ff
  );
}

// Reconstruct at both IPC and export boundaries. Never forward arbitrary fields,
// filenames, annotations, strings, registers, or memory from a dump/JSON file.
export function sanitizeNativeCrashReport(
  value: unknown,
): INativeCrashReport | undefined {
  if (
    !isRecord(value) ||
    value.source !== 'electron-native' ||
    value.schemaVersion !== 1 ||
    typeof value.collectedAt !== 'number' ||
    !Number.isSafeInteger(value.collectedAt) ||
    value.collectedAt <= 0 ||
    (value.platform !== 'windows' &&
      value.platform !== 'macos' &&
      value.platform !== 'linux') ||
    (value.architecture !== 'x64' && value.architecture !== 'arm64') ||
    !isUint32(value.exceptionCode) ||
    value.stackMethod !== 'frame-pointer' ||
    !Array.isArray(value.modules) ||
    value.modules.length > MAX_NATIVE_CRASH_FRAMES ||
    !Array.isArray(value.frames) ||
    value.frames.length === 0 ||
    value.frames.length > MAX_NATIVE_CRASH_FRAMES
  ) {
    return undefined;
  }
  const modules: INativeCrashReport['modules'] = [];
  for (const module of value.modules) {
    if (
      !isRecord(module) ||
      typeof module.id !== 'string' ||
      !/^[a-f0-9]{64}$/.test(module.id) ||
      !isUint32(module.size) ||
      module.size === 0 ||
      !Array.isArray(module.version) ||
      module.version.length !== 4 ||
      !module.version.every(
        (part: unknown) => isUint32(part) && part <= 0xff_ff,
      )
    ) {
      return undefined;
    }
    modules.push({
      id: module.id,
      size: module.size,
      version: [...module.version] as number[],
    });
  }
  const frames: INativeCrashReport['frames'] = [];
  for (const frame of value.frames) {
    if (
      !isRecord(frame) ||
      !isUint32(frame.moduleIndex) ||
      frame.moduleIndex >= modules.length ||
      !isUint32(frame.offset) ||
      frame.offset >= modules[frame.moduleIndex].size ||
      (frame.trust !== 'context' && frame.trust !== 'frame-pointer')
    )
      return undefined;
    frames.push({
      moduleIndex: frame.moduleIndex,
      offset: frame.offset,
      trust: frame.trust,
    });
  }
  return {
    source: 'electron-native',
    schemaVersion: 1,
    collectedAt: value.collectedAt,
    platform: value.platform as INativeCrashReport['platform'],
    architecture: value.architecture as INativeCrashReport['architecture'],
    exceptionCode: value.exceptionCode,
    stackMethod: 'frame-pointer',
    modules,
    frames,
  };
}
