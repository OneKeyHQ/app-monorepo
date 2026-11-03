import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const boot = Date.now();

export function debugHomeVisual(
  phase: string,
  geometry: Record<string, number | boolean | string | null>,
) {
  if (process.env.NODE_ENV !== 'development' || !platformEnv.isNativeIOS) {
    return;
  }
  try {
    const finiteGeometry = Object.fromEntries(
      Object.entries(geometry).map(([key, value]) => [
        key,
        typeof value === 'number' && !Number.isFinite(value) ? null : value,
      ]),
    );
    NativeLogger.write(
      LogLevel.Info,
      `[IOS-HOME-VISUAL] epochMs=${Date.now()} bootEpochMs=${boot} runtime=main ${phase} ${JSON.stringify(finiteGeometry)}`,
    );
  } catch {
    // Diagnostics must never affect Home layout or refresh.
  }
}
