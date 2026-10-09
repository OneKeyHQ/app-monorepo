import { parseNativeMinidump } from './libs/nativeCrashMinidump';

// This entry runs in an OS process with a small heap and no inherited app env.
// Neither successful nor failed parsing writes raw data/path/error text to logs.
try {
  const filePath = process.argv[2];
  if (!filePath || !process.parentPort) process.exit(1);
  process.parentPort.postMessage(parseNativeMinidump(filePath));
} catch {
  process.exit(1);
}
