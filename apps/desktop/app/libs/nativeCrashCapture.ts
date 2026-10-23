import { app, crashReporter } from 'electron';

let directory: string | undefined;

// Keep this boot entry free of logger/wallet/native-addon dependencies so the
// reporter is installed before evaluating any of the application modules.
export function startNativeCrashCapture(): string | undefined {
  if (directory || process.mas) return directory;
  try {
    const crashDumpsDirectory = app.getPath('crashDumps');
    crashReporter.start({
      uploadToServer: false,
      ignoreSystemCrashHandler: false,
    });
    directory = crashDumpsDirectory;
  } catch {
    return undefined;
  }
  return directory;
}
