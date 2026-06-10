/* eslint-disable */
// TEMPORARY debug instrumentation for the Perps->Swap white-screen race.
// Writes through NativeLogger so it is captured in the on-device exported logs
// (release builds suppress console.log; NativeLogger is the file-logger sink).
// Each line is prefixed with a global monotonic seq so sub-second events can be
// ordered precisely (the file log timestamps are only second-granularity).
// Remove before merging.
import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

let okRaceSeq = 0;

export function okRaceLog(msg: string) {
  okRaceSeq += 1;
  try {
    NativeLogger.write(LogLevel.Info, `OKRACE#${okRaceSeq} ${msg}`);
  } catch {
    // best-effort debug log
  }
}
