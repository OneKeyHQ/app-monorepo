import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const boot = Date.now();

export function debugPerpsChain(phase: string, data?: unknown) {
  if (process.env.NODE_ENV === 'production' || !platformEnv.isNative) return;
  let value: string;
  try {
    value = JSON.stringify(data ?? {});
  } catch {
    value = '{"stringifyError":true}';
  }
  NativeLogger.write(
    LogLevel.Info,
    `[PERPS-CHAIN] t=${Date.now()} boot=${boot} runtime=main ${phase} ${value}`,
  );
}
