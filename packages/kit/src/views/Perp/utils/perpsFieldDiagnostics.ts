import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// OK-59100 / OK-59102 field diagnostics.
//
// Unlike `tracePerpsMobileLayout`, this stays live in production bundles: both
// bugs only reproduce on a real device running a release build, where
// `babel-plugin-transform-remove-console` strips every console call and
// `isPerpsMobileLayoutTraceEnabled()` short-circuits on NODE_ENV. Writing
// through NativeLogger puts the records in the same file the in-app
// "export logs" action ships, which is how these get back off the device.
//
// Remove together with its call sites once both tickets are closed.
const PERPS_FIELD_DIAGNOSTICS_PREFIX = '[PerpsDiag]';

export type IPerpsFieldDiagnosticsDetail = Record<string, unknown>;

export function perpsFieldDiagnostics(
  label: string,
  detail?: IPerpsFieldDiagnosticsDetail,
) {
  const payload = detail ?? {};

  if (!platformEnv.isNative) {
    console.log(PERPS_FIELD_DIAGNOSTICS_PREFIX, label, payload);
    return;
  }

  try {
    NativeLogger.write(
      LogLevel.Info,
      `${PERPS_FIELD_DIAGNOSTICS_PREFIX} ${label} ${JSON.stringify(payload)}`,
    );
  } catch {
    // Diagnostics must never be able to affect the UI they observe.
  }
}
